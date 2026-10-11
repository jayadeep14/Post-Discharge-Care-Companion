import asyncio
import logging
from datetime import datetime, timedelta
import threading
import time

from backend.database.connection import supabase
from backend.routes.calle import trigger_patient_call  # Adjust import path based on your folder structure
from backend.services.scheduler_service import process_automated_calls

logger = logging.getLogger("realtime_listener")
FOLLOW_UP_SELECT = "id, patient_id, reason, date_to_call, status, created_at"
POLL_INTERVAL_SECONDS = 5


def _fetch_follow_ups():
    response = (
        supabase.table("follow_up_schedule")
        .select(FOLLOW_UP_SELECT)
        .execute()
    )
    return response.data or []


class AlarmManager:

  def __init__(self):
    self.alarms = {}  # Stores alarms: {name: {"target_dt": datetime, "raw_str": str, "message": str, "patient_id": str}}
    self._lock = threading.Lock()
    self._running = True

    # Start a single background coordinator thread
    self.thread = threading.Thread(target=self._alarm_coordinator, daemon=True)
    self.thread.start()

  def _parse_target_time(self, time_str):
    """Parses either 'YYYY-MM-DD HH:MM:SS' or 'HH:MM:SS' (defaulting to today/tomorrow)."""
    # 1. Try parsing full datetime first (handling ISO format with 'T' if present)
    cleaned_time_str = str(time_str).strip().replace("T", " ")
    try:
      return datetime.strptime(cleaned_time_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
      pass

    # 2. Try parsing time only (HH:MM:SS)
    try:
      t = datetime.strptime(cleaned_time_str, "%H:%M:%S").time()
      now = datetime.now()
      target_dt = datetime.combine(now.date(), t)
      # If time already passed today, set it for tomorrow
      if now > target_dt:
        target_dt += timedelta(days=1)
      return target_dt
    except ValueError:
      raise ValueError("Invalid format. Use 'YYYY-MM-DD HH:MM:SS' or 'HH:MM:SS'.")

  def set_alarm(self, name, target_str, message="Alarm!", patient_id=None):
    """Sets or updates a named alarm with optional patient metadata, ignoring past times."""
    try:
      target_dt = self._parse_target_time(target_str)
    except ValueError:
      print(
          f"Error: Invalid format for alarm '{name}' with value '{target_str}'. "
          "Use 'YYYY-MM-DD HH:MM:SS' or 'HH:MM:SS'."
      )
      return

    # Skip setting alarm if the date and time have already passed
    if target_dt <= datetime.now():
      print(f"[Alarm Skipped] '{name}' for {target_dt.strftime('%Y-%m-%d %H:%M:%S')} is in the past.")
      return

    with self._lock:
      self.alarms[name] = {
          "target_dt": target_dt,
          "raw_str": target_str,
          "message": message,
          "patient_id": patient_id,
      }
    print(f"[Alarm Set] '{name}' for {target_dt.strftime('%Y-%m-%d %H:%M:%S')}")

  def update_alarm(self, name, new_target_str=None, new_message=None, new_patient_id=None):
    """Updates an existing alarm's time/date, message, or patient ID by its name."""
    with self._lock:
      if name not in self.alarms:
        self._lock.release()
        self.set_alarm(name, new_target_str, new_message or "Time for patient follow-up call!", new_patient_id)
        return

      if new_target_str:
        try:
          new_dt = self._parse_target_time(new_target_str)
          if new_dt <= datetime.now():
            print(f"[Alarm Update Skipped] '{name}' -> New target {new_dt.strftime('%Y-%m-%d %H:%M:%S')} is in the past.")
            return
          self.alarms[name]["target_dt"] = new_dt
          self.alarms[name]["raw_str"] = new_target_str
        except ValueError:
          print(
              f"Error: Invalid format for '{name}'. Use 'YYYY-MM-DD HH:MM:SS' or"
              " 'HH:MM:SS'."
          )
          return

      if new_message:
        self.alarms[name]["message"] = new_message

      if new_patient_id:
        self.alarms[name]["patient_id"] = new_patient_id

      current_dt_str = self.alarms[name]["target_dt"].strftime(
          "%Y-%m-%d %H:%M:%S"
      )
      print(
          f"[Alarm Updated] '{name}' -> Target: {current_dt_str} | Msg:"
          f" {self.alarms[name]['message']}"
      )

  def cancel_alarm(self, name):
    """Removes/cancels an alarm by its name."""
    with self._lock:
      if name in self.alarms:
        del self.alarms[name]
        print(f"[Alarm Canceled] '{name}' removed.")
      else:
        print(f"Error: Alarm '{name}' not found.")

  def _alarm_coordinator(self):
    """Background worker that continuously monitors all active alarms."""
    while self._running:
      with self._lock:
        current_alarms = list(self.alarms.items())

      now = datetime.now()
      triggered_alarms = []

      for name, data in current_alarms:
        # Check if current time has reached or passed the target datetime
        if (data["target_dt"] - now).total_seconds() <= 0:
          triggered_alarms.append((name, data["message"], data.get("patient_id")))

      # Trigger alarms outside the main lock
      for name, message, patient_id in triggered_alarms:
        print(f"\n🔔 [ALARM RINGING: '{name}'] {message}")
        target_id = patient_id if patient_id else name
        try:
            result = trigger_patient_call(target_id)
            print(f"Successfully triggered call! DB ID: {result.get('db_call_id', 'N/A')}")
        except Exception as e:
            print(f"Error triggering call for ID '{target_id}': {e}")
        self.cancel_alarm(name)

      time.sleep(1)  # Check every second


def _sync_and_log_follow_up_differences(previous, current, manager):
    has_new_or_rescheduled_follow_up = False
    previous_by_id = {row.get("id"): row for row in previous if row.get("id")}
    current_by_id = {row.get("id"): row for row in current if row.get("id")}

    # 1. Handle Deleted Follow-ups
    for schedule_id, old_row in previous_by_id.items():
        if schedule_id not in current_by_id:
            logger.info("Follow-up deleted: %s", old_row)
            manager.cancel_alarm(schedule_id)

    # 2. Handle Added & Updated Follow-ups
    for schedule_id, new_row in current_by_id.items():
        old_row = previous_by_id.get(schedule_id)
        date_to_call = new_row.get("date_to_call")
        patient_id = new_row.get("patient_id")

        if old_row is None:
            logger.info("Follow-up added: %s", new_row)
            if date_to_call:
                manager.set_alarm(schedule_id, str(date_to_call), "Time for patient follow-up call!", patient_id=patient_id)
            if (new_row.get("status") or "").lower() == "scheduled":
                has_new_or_rescheduled_follow_up = True
            continue

        changed_fields = old_row.keys() | new_row.keys()
        changes = {
            key: {"from": old_row.get(key), "to": new_row.get(key)}
            for key in changed_fields
            if old_row.get(key) != new_row.get(key)
        }
        if changes:
            logger.info(
                "Follow-up updated: schedule_id=%s patient_id=%s changes=%s",
                schedule_id,
                patient_id,
                changes,
            )
            
            # Sync Alarm if date_to_call or patient_id was modified
            if "date_to_call" in changes or "patient_id" in changes:
                if date_to_call:
                    manager.update_alarm(schedule_id, new_target_str=str(date_to_call), new_patient_id=patient_id)
                else:
                    manager.cancel_alarm(schedule_id)

            if (new_row.get("status") or "").lower() == "scheduled":
                has_new_or_rescheduled_follow_up = True

    return has_new_or_rescheduled_follow_up


async def start_realtime_listener():
    """Poll follow_up_schedule and synchronize database changes with alarms."""
    logger.info("Watching follow_up_schedule for database changes")
    follow_ups = None
    manager = AlarmManager()

    while True:
        try:
            current_follow_ups = await asyncio.to_thread(_fetch_follow_ups)
            if follow_ups is None:
                # Treat the first result as the startup snapshot.
                follow_ups = current_follow_ups
                for idx, record in enumerate(follow_ups, start=1):
                    print(f"\n[Follow-up #{idx}]")
                    print(f"  • ID:           {record.get('id')}")
                    print(f"  • Patient UUID: {record.get('patient_id')}")
                    print(f"  • Reason:       {record.get('reason') or 'N/A'}")
                    print(f"  • Date to Call: {record.get('date_to_call') or 'N/A'}")
                    print(f"  • Status:       {record.get('status') or 'N/A'}")
                    print(f"  • Created At:   {record.get('created_at') or 'N/A'}")
                    
                    schedule_id = record.get('id')
                    date_to_call = record.get('date_to_call')
                    patient_id = record.get('patient_id')
                    if schedule_id and date_to_call:
                        manager.set_alarm(schedule_id, str(date_to_call), "Time for patient follow-up call!", patient_id=patient_id)
            else:
                should_process_calls = _sync_and_log_follow_up_differences(
                    follow_ups, current_follow_ups, manager
                )
                # Replace the snapshot only after all changes have been logged and synced.
                follow_ups = current_follow_ups
                if should_process_calls:
                    await process_automated_calls()
        except asyncio.CancelledError:
            logger.info("Stopped watching follow_up_schedule")
            raise
        except Exception:
            logger.exception("Unable to check follow_up_schedule for changes")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
