import asyncio
import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from backend.database.repository import (
    get_due_scheduled_followups,
    get_patients_for_7day_followup,
    get_patient_by_id,
    claim_scheduled_followup,
    has_call_today,
    update_schedule_status,
)
from backend.routes.calle import trigger_patient_call

logger = logging.getLogger("scheduler")
LOCAL_TZ = ZoneInfo("Asia/Kolkata")
_scheduler_lock = asyncio.Lock()


def is_within_calling_window(now=None) -> bool:
    now = now or datetime.now(LOCAL_TZ)
    return time(10, 0) <= now.timetz().replace(tzinfo=None) < time(23, 0)


async def process_automated_calls():
    """Dispatch due scheduled calls; run seven-day checks only during call hours."""
    async with _scheduler_lock:
        await _process_automated_calls()


async def _process_automated_calls():
    now = datetime.now(LOCAL_TZ)

    # Explicit appointments honor their date_to_call, including evening test times.
    try:
        scheduled_calls = get_due_scheduled_followups(now)
        for record in scheduled_calls:
            schedule_id = record.get("id")
            patient_id = record.get("patient_id")
            try:
                logger.info("Processing schedule %s for patient %s", schedule_id, patient_id)
                patient = get_patient_by_id(patient_id) if patient_id else None
                if not patient or not patient.get("phone_number"):
                    logger.warning("Skipping follow-up %s: patient or phone number missing", schedule_id)
                    if schedule_id:
                        update_schedule_status(schedule_id, "failed")
                    continue
                if not claim_scheduled_followup(schedule_id):
                    logger.info("Schedule %s was already claimed by another worker", schedule_id)
                    continue
                result = trigger_patient_call(patient_id, schedule_id=schedule_id)
                logger.info(
                    "Dispatched scheduled call: schedule_id=%s call_id=%s",
                    schedule_id,
                    result.get("db_call_id"),
                )
            except Exception:
                logger.exception("Failed to dispatch scheduled follow-up %s", schedule_id)
                if schedule_id:
                    update_schedule_status(schedule_id, "failed")
    except Exception:
        logger.exception("Unable to fetch scheduled follow-ups")

    # Automatic seven-day calls remain within the configured daily window.
    if not is_within_calling_window(now):
        return

    try:
        for patient in get_patients_for_7day_followup(now):
            patient_id = patient.get("patient_id")
            try:
                if has_call_today(patient_id, now):
                    continue
                if patient.get("phone_number"):
                    trigger_patient_call(patient_id)
                else:
                    logger.warning("Skipping seven-day follow-up for %s: phone number missing", patient_id)
            except Exception:
                logger.exception("Failed to dispatch seven-day follow-up for %s", patient_id)
    except Exception:
        logger.exception("Unable to fetch seven-day follow-ups")
