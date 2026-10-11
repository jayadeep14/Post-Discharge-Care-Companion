from datetime import datetime, timedelta
import threading
import time


class AlarmManager:

  def __init__(self):
    self.alarms = {}  # Stores alarms: {name: {"target_dt": datetime, "raw_str": str, "message": str}}
    self._lock = threading.Lock()
    self._running = True

    # Start a single background coordinator thread
    self.thread = threading.Thread(target=self._alarm_coordinator, daemon=True)
    self.thread.start()

  def _parse_target_time(self, time_str):
    """Parses either 'YYYY-MM-DD HH:MM:SS' or 'HH:MM:SS' (defaulting to today/tomorrow)."""
    # 1. Try parsing full datetime first
    try:
      return datetime.strptime(time_str.strip(), "%Y-%m-%d %H:%M:%S")
    except ValueError:
      pass

    # 2. Try parsing time only (HH:MM:SS)
    try:
      t = datetime.strptime(time_str.strip(), "%H:%M:%S").time()
      now = datetime.now()
      target_dt = datetime.combine(now.date(), t)
      # If time already passed today, set it for tomorrow
      if now > target_dt:
        target_dt += timedelta(days=1)
      return target_dt
    except ValueError:
      raise ValueError("Invalid format. Use 'YYYY-MM-DD HH:MM:SS' or 'HH:MM:SS'.")

  def set_alarm(self, name, target_str, message="Alarm!"):
    """Sets or updates a named alarm (supports date+time or time-only)."""
    try:
      target_dt = self._parse_target_time(target_str)
    except ValueError:
      print(
          f"Error: Invalid format for '{name}'. Use 'YYYY-MM-DD HH:MM:SS' or"
          " 'HH:MM:SS'."
      )
      return

    with self._lock:
      self.alarms[name] = {
          "target_dt": target_dt,
          "raw_str": target_str,
          "message": message,
      }
    print(f"[Alarm Set] '{name}' for {target_dt.strftime('%Y-%m-%d %H:%M:%S')}")

  def update_alarm(self, name, new_target_str=None, new_message=None):
    """Updates an existing alarm's time/date or message by its name."""
    with self._lock:
      if name not in self.alarms:
        print(f"Error: Alarm '{name}' not found.")
        return

      if new_target_str:
        try:
          new_dt = self._parse_target_time(new_target_str)
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
          triggered_alarms.append((name, data["message"]))

      # Trigger alarms outside the main lock
      for name, message in triggered_alarms:
        print(f"\n🔔 [ALARM RINGING: '{name}'] {message}")
        self.cancel_alarm(name)

      time.sleep(1)  # Check every second


# ==========================================
# Example Usage
# ==========================================
if __name__ == "__main__":
  manager = AlarmManager()

  # 1. Setting an alarm using just time (HH:MM:SS) - defaults to today/tomorrow
  manager.set_alarm("daily_water", "14:35:00", "Time to drink water!")

  # 2. Setting an alarm using a specific date and time (YYYY-MM-DD HH:MM:SS)
  manager.set_alarm(
      "project_deadline", "2026-10-01 09:00:00", "Submit final report!"
  )

  print("\nMain program is running smoothly... Doing other tasks.")

  for i in range(1, 4):
    print(f"Main loop iteration {i}/3")
    time.sleep(2)

  # ---- LATER IN YOUR CODE: Update an alarm to a specific date/time ----
  print("\n...Updating the 'daily_water' alarm to a specific date...")
  manager.update_alarm(
      "daily_water",
      new_target_str="2026-09-30 18:00:00",
      new_message="Evening hydration check!",
  )

  # Keep main program running to allow background monitoring
  time.sleep(5)
