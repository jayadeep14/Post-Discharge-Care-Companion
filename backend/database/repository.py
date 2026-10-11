import uuid
from datetime import datetime, time, timedelta
from typing import Any, Dict, List

from backend.database.connection import supabase


def get_patients_for_7day_followup(now=None) -> List[Dict[str, Any]]:
    """Return patients discharged on the calendar date seven days before now."""
    now = now or datetime.now()
    target_day = now.date() - timedelta(days=7)
    start = datetime.combine(target_day, time.min).isoformat()
    end = datetime.combine(target_day, time.max).isoformat()
    response = (supabase.table("patients").select("*")
        .gte("discharge_date", start).lte("discharge_date", end).execute())
    return response.data or []


def get_due_scheduled_followups(now=None) -> List[Dict[str, Any]]:
    """Fetch scheduled entries whose date_to_call has arrived."""
    now = now or datetime.now()
    response = (supabase.table("follow_up_schedule")
        .select("id, patient_id, reason, date_to_call, status, created_at")
        .eq("status", "scheduled").lte(
            "date_to_call", now.replace(tzinfo=None).isoformat()
        ).execute())
    return response.data or []


def get_scheduled_followup(schedule_id: str):
    response = (supabase.table("follow_up_schedule").select(
        "id, patient_id, date_to_call, created_at"
    ).eq("id", schedule_id).limit(1).execute())
    return response.data[0] if response.data else None


def count_call_attempts(patient_id: str, since: str) -> int:
    """Count recorded calls for a follow-up since its scheduled time."""
    response = (supabase.table("call_events").select("call_id")
        .eq("patient_id", patient_id).gte("call_date", since).execute())
    return len(response.data or [])


def update_schedule_status(schedule_id: str, status: str):
    """Updates the schedule item status (e.g., 'completed', 'calling', 'failed')."""
    supabase.table("follow_up_schedule").update({"status": status}).eq(
        "id", schedule_id
    ).execute()


def has_call_today(patient_id: str, now=None) -> bool:
    """Prevent the hourly scheduler from calling the same patient repeatedly."""
    now = now or datetime.now()
    start = datetime.combine(now.date(), time.min).isoformat()
    end = datetime.combine(now.date(), time.max).isoformat()
    response = (supabase.table("call_events").select("call_id")
        .eq("patient_id", patient_id).gte("call_date", start)
        .lte("call_date", end).limit(1).execute())
    return bool(response.data)


def claim_scheduled_followup(schedule_id: str) -> bool:
    """Atomically claim a scheduled row so concurrent workers cannot call twice."""
    response = (supabase.table("follow_up_schedule")
        .update({"status": "calling"})
        .eq("id", schedule_id)
        .eq("status", "scheduled")
        .select("id")
        .execute())
    return bool(response.data)


def get_patient_by_id(patient_id: str):
    response = (
        supabase.table("patients")
        .select("*")
        .eq("patient_id", patient_id)
        .execute()
    )
    return response.data[0] if response.data else None


def create_pending_call(patient_id: str):
    call_id = str(uuid.uuid4())
    data = {
        "call_id": call_id,
        "patient_id": patient_id,
        "call_date": datetime.now().isoformat(),
        "call_status": "pending",
    }
    supabase.table("call_events").insert([data]).execute()
    return call_id


def update_call_with_calle_id(db_call_id: str, calle_call_id: str):
    supabase.table("call_events").update({"calle_call_id": calle_call_id}).eq(
        "call_id", db_call_id
    ).execute()


def update_call_status(db_call_id: str, status: str):
    data = {"call_status": status}
    supabase.table("call_events").update(data).eq(
        "call_id", db_call_id
    ).execute()


def get_call_event(db_call_id: str):
    resp = (
        supabase.table("call_events")
        .select("*")
        .eq("call_id", db_call_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def save_patient_state(patient_id: str, call_id: str, result: dict):
    data = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "call_id": call_id,
        "recovery_status": result.get("recovery_status"),
        "has_new_symptoms": result.get("has_new_symptoms") == "yes",
        "medication_adherence": result.get("medication_adherence"),
        "summary": result.get("summary"),
        "structured_result": result,
        "created_at": datetime.now().isoformat(),
    }
    supabase.table("patient_states").insert([data]).execute()


def create_or_update_issue(patient_id: str, call_id: str, description: str):
    # Check for an existing open issue for this patient to prevent blind duplication
    resp = (
        supabase.table("issues")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("status", "open")
        .execute()
    )
    if resp.data:
        # Update existing issue
        issue_id = resp.data[0]["id"]
        supabase.table("issues").update(
            {"last_updated_at": datetime.now().isoformat()}
        ).eq("id", issue_id).execute()
        return issue_id
    else:
        # Create genuinely new issue tracking longitudinal problem
        data = {
            "id": str(uuid.uuid4()),
            "patient_id": patient_id,
            "call_id": call_id,
            "issue_type": "reported_symptoms",
            "description": description,
            "severity": "medium",
            "status": "open",
            "last_updated_at": datetime.now().isoformat(),
        }
        supabase.table("issues").insert([data]).execute()
        return data["id"]


def get_patient_medications(patient_id: str):
    resp = (
        supabase.table("medications_prescribed")
        .select("*")
        .eq("patient_id", patient_id)
        .execute()
    )
    return resp.data


def get_patient_diagnoses(patient_id: str):
    resp = (
        supabase.table("diagnoses")
        .select("*")
        .eq("patient_id", patient_id)
        .execute()
    )
    return resp.data


def get_patient_open_issues(patient_id: str):
    resp = (
        supabase.table("issues")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("status", "open")
        .execute()
    )
    return resp.data


def get_recent_patient_states(patient_id: str, limit: int = 3):
    resp = (
        supabase.table("patient_states")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data if resp.data else []


def get_recent_readmission_predictions(patient_id: str, limit: int = 2):
    """Return the latest saved model scores for call prompt context."""
    response = (supabase.table("readmission_predictions")
        .select("readmission_risk_pct, risk_category, prediction_date")
        .eq("patient_id", patient_id)
        .order("prediction_date", desc=True)
        .limit(limit).execute())
    return response.data or []


def get_recent_medication_adherence(patient_id: str, limit: int = 20):
    """Return recent reported adherence entries, newest first."""
    response = (supabase.table("adherence_tracking")
        .select("medication_name, adherence_status, reason_if_missed, call_date, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .limit(limit).execute())
    return response.data or []


def insert_adherence_tracking(
    patient_id: str, call_id: str, med_name: str, status: str
):
    data = {
        "adherence_id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "call_id": call_id,
        "medication_name": med_name,
        "adherence_status": status,
        "created_at": datetime.now().isoformat(),
    }
    supabase.table("adherence_tracking").insert([data]).execute()


def update_issue_status(issue_id: str, status: str):
    supabase.table("issues").update(
        {"status": status, "last_updated_at": datetime.now().isoformat()}
    ).eq("id", issue_id).execute()
