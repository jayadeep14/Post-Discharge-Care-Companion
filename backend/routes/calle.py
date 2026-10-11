import os
import json
import uuid
import logging
import re
import inspect
from dotenv import load_dotenv

load_dotenv()
import os
from dotenv import load_dotenv

# Load variables from the .env file located in the backend folder
load_dotenv()

# Retrieve the API key from environment variables
CALLE_API_KEY = os.getenv("CALLE_API_KEY")

# Optional: Add a check to ensure it's loaded correctly
if not CALLE_API_KEY:
    raise ValueError("CALLE_API_KEY is missing from environment variables or .env file.")
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from backend.services.calle_integration import calle_client
from backend.services.prompt_generator import generate_call_task
from backend.database.repository import (
    get_patient_by_id, 
    create_pending_call, 
    update_call_with_calle_id,
    update_call_status,
    save_patient_state,
    get_call_event,
    create_or_update_issue,
    get_patient_diagnoses,
    get_patient_medications,
    get_patient_open_issues,
    get_recent_patient_states,
    get_recent_readmission_predictions,
    get_recent_medication_adherence,
    insert_adherence_tracking,
    update_issue_status
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/calle", tags=["CALL-E"])

WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://example.com/api/v1/calle/webhook")


def normalize_e164_phone(value: object) -> str:
    """Normalize common separators and require an international E.164 number."""
    raw_phone = str(value or "").strip()
    phone = re.sub(r"[\s().-]", "", raw_phone)
    if phone.startswith("00"):
        phone = f"+{phone[2:]}"
    if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
        raise ValueError(
            "Patient phone number must include its country code in E.164 format, "
            "for example +14155552671. Update the patient's phone number and retry."
        )
    return phone
import os
import requests
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# 1. Fetcher function
def get_call_events(call_id: str, api_key: str):
    url = f"https://api.heycall-e.com/v1/calls/{call_id}/events"
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"CALL-E API failed with status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Networking error fetching call events: {e}")
        return None


# 2. Database upsert function
def save_call_event_to_db(
    supabase_client, 
    call_id: str, 
    patient_id: str, 
    event_data: Dict[str, Any]
) -> Optional[str]:
    try:
        record = {
            "call_id": call_id,
            "patient_id": patient_id,
            "call_number": event_data.get("call_number"),
            "call_date": event_data.get("call_date", datetime.utcnow().isoformat()),
            "audio_url": event_data.get("audio_url"),
            "call_status": event_data.get("call_status", "completed"),
            "call_success": event_data.get("call_success", True),
            "created_at": datetime.utcnow().isoformat()
        }

        response = supabase_client.table("call_events").upsert(record).execute()
        if response.data:
            return call_id
        return None
    except Exception as e:
        logger.error(f"Failed to save call event to database: {e}")
        return None


# 3. Automated Orchestrator
def sync_calle_event_to_database(
    call_id: str, 
    patient_id: str, 
    api_key: str, 
    supabase_client
) -> Optional[str]:
    raw_response = get_call_events(call_id, api_key)
    if not raw_response:
        return None
        
    event_payload = raw_response.get("data", raw_response) if isinstance(raw_response, dict) else {}
    
    return save_call_event_to_db(
        supabase_client=supabase_client,
        call_id=call_id,
        patient_id=patient_id,
        event_data=event_payload
    )
class TriggerCallResponse(BaseModel):
    message: str
    call_id: str
    calle_call_id: str


def trigger_patient_call(patient_id: str, schedule_id: str | None = None) -> dict:
    """
    Reusable core logic to initiate a CALL-E call for a given patient.
    Can be called by FastAPI route handlers or background schedulers.
    """
    if not calle_client:
        raise ValueError("CALLE_API_KEY is not configured")
        
    patient = get_patient_by_id(patient_id)
    if not patient:
        raise ValueError(f"Patient with ID '{patient_id}' not found in database")
        
    phone = normalize_e164_phone(patient.get("phone_number"))
    name = patient.get("name", "there")
    
    # 1. Gather Context
    diagnoses = get_patient_diagnoses(patient_id)
    medications = get_patient_medications(patient_id)
    issues = get_patient_open_issues(patient_id)
    recent_states = get_recent_patient_states(patient_id)
    risk_history = get_recent_readmission_predictions(patient_id)
    adherence_history = get_recent_medication_adherence(patient_id)
    
    # 2. Build prompt with Gemini
    gemini_instructions = generate_call_task(
        name,
        diagnoses,
        medications,
        issues,
        recent_states,
        readmission_risk_history=risk_history,
        medication_adherence=adherence_history,
    )
    task_prompt = gemini_instructions
    
    # 3. Create database records
    db_call_id = create_pending_call(patient_id)
    idempotency_key = f"call_init_{db_call_id}"
    
    # 4. Construct Option B Schema
    result_schema = {
        "type": "object",
        "required": ["recovery_status", "has_new_symptoms", "medication_adherence", "summary"],
        "properties": {
            "recovery_status": {
                "type": "string",
                "enum": ["improving", "stable", "worsening", "unknown"]
            },
            "has_new_symptoms": {
                "type": "string",
                "enum": ["yes", "no", "unknown"]
            },
            "medication_adherence": {
                "type": "string",
                "enum": ["taking_all", "missing_some", "not_taking", "unknown"]
            },
            "summary": {
                "type": "string",
                "description": "A very brief summary of how the patient is currently doing."
            }
        },
        "additionalProperties": False,
    }
    
    for issue in issues:
        issue_id = issue.get("id")
        key = f"issue_{issue_id}_status"
        result_schema["properties"][key] = {
            "type": "string",
            "enum": ["resolved", "worsening", "stable", "unknown"],
            "description": f"Evaluate if the patient's previously reported issue '{issue.get('description')}' is resolved, worse, or stable."
        }
        
    for med in medications:
        drug_name = med.get("drug_name")
        safe_name = drug_name.replace(" ", "_").replace("-", "_").lower()
        key = f"adherence_med_{safe_name}"
        result_schema["properties"][key] = {
            "type": "string",
            "enum": ["taking_all", "missing_some", "not_taking", "unknown"],
            "description": f"Is the patient exactly taking their prescribed {drug_name}?"
        }

    try:
        create_call = calle_client.calls.create
        create_parameters = inspect.signature(create_call).parameters
        call_request = {
            "task": task_prompt,
            "result_schema": result_schema,
            "metadata": {"db_call_id": db_call_id, **({"schedule_id": schedule_id} if schedule_id else {})},
            "webhook_url": WEBHOOK_URL,
            "idempotency_key": idempotency_key,
        }
        # CALL-E SDK 0.7.x takes an explicit recipient object; newer SDK releases
        # take a phone argument. Supply a structured recipient so the API does
        # not have to guess the destination from natural-language task text.
        if "recipient" in create_parameters:
            call_request["recipient"] = {"phone": phone}
        elif "phone" in create_parameters:
            call_request["phone"] = phone
        elif "recipients" in create_parameters:
            call_request["recipients"] = [{"phones": [phone]}]
        else:
            raise RuntimeError("Installed CALL-E SDK does not support explicit recipients")

        call = create_call(**call_request)
        update_call_with_calle_id(db_call_id, call["id"])
        
        return {
            "db_call_id": db_call_id,
            "calle_call_id": call["id"]
        }
    except Exception as e:
        update_call_status(db_call_id, "failed_init")
        raise e


@router.post("/call/{patient_id}", response_model=TriggerCallResponse)
def trigger_call(patient_id: str):
    """API Endpoint wrapper around trigger_patient_call core function."""
    try:
        res = trigger_patient_call(patient_id)
        print(f"Successfully triggered")
        return TriggerCallResponse(
            message="Call elegantly dispatched dynamically!",
            call_id=res["db_call_id"],
            calle_call_id=res["calle_call_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error communicating with CALL-E: {str(e)}"
        )


@router.post("/webhook")
async def calle_webhook(request: Request):
    raw_body = await request.body()
    try:
        event = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_json")
        
    event_id = request.headers.get("CALL-E-Event-Id")
    if not event_id or event_id != event.get("id"):
        return {"error": "invalid_event_id"}
        
    event_type = event.get("type", "")
    data = event.get("data", {})
    with open("webhook_logs.txt", "a") as f:
        import datetime
        f.write(f"[{datetime.datetime.now().isoformat()}] Received {event_type} - DB_CALL_ID: {data.get('metadata', {}).get('db_call_id')}\nPAYLOAD: {json.dumps(event)}\n\n")

    metadata = data.get("metadata", {})
    db_call_id = metadata.get("db_call_id")
    
    if not db_call_id:
        return {"ok": True}
        
    call_record = get_call_event(db_call_id)
    if not call_record:
        return {"ok": True} 
    if call_record.get("call_status") in ["completed", "failed", "failed_validation"]:
        return {"ok": True}
    
    print(f"\n=== WEBHOOK DISCOVERED: {event_type} - DB_CALL_ID: {db_call_id} ===")
    patient_id = call_record.get("patient_id")
    schedule_id = metadata.get("schedule_id")
    
    if event_type == "call.completed":
        structured_result = data.get("structured_result")

        update_call_status(db_call_id, "completed")
        if schedule_id:
            from backend.database.repository import update_schedule_status
            update_schedule_status(schedule_id, "completed")
        if structured_result:
            save_patient_state(patient_id, db_call_id, structured_result)

            for key, value in structured_result.items():
                if key.startswith("issue_") and key.endswith("_status"):
                    issue_id = key[len("issue_"):-len("_status")]
                    if value == "resolved":
                        update_issue_status(issue_id, "resolved")
                    else:
                        update_issue_status(issue_id, "open")
                elif key.startswith("adherence_med_"):
                    med_id = key[len("adherence_med_"):]
                    insert_adherence_tracking(patient_id, db_call_id, med_id, value)

            if structured_result.get("has_new_symptoms") == "yes":
                desc = structured_result.get("summary") or "Patient reported worsening state natively."
                create_or_update_issue(patient_id, db_call_id, desc)

            print(f"Captured structured evaluation inside Supabase efficiently!")
        
    elif event_type == "call.failed":
        update_call_status(db_call_id, "failed")
        if schedule_id:
            from backend.database.repository import (
                count_call_attempts,
                get_scheduled_followup,
                update_schedule_status,
            )
            schedule = get_scheduled_followup(schedule_id)
            attempts = count_call_attempts(
                patient_id,
                (schedule or {}).get("date_to_call") or (schedule or {}).get("created_at"),
            ) if schedule else 2
            if schedule and attempts < 2:
                # Re-queue the same follow-up. Realtime will trigger the retry,
                # with the periodic scheduler as a fallback.
                update_schedule_status(schedule_id, "scheduled")
            else:
                update_schedule_status(schedule_id, "failed")
                patient = get_patient_by_id(patient_id) if patient_id else None
                logger.warning(
                    "Call failed after 2 attempts for patient name=%s patient_id=%s",
                    (patient or {}).get("name", "unknown"),
                    patient_id,
                )
        
    elif event_type == "call.result_validation_failed":
        update_call_status(db_call_id, "failed_validation")
        if schedule_id:
            from backend.database.repository import update_schedule_status
            update_schedule_status(schedule_id, "failed")
        
    return {"ok": True}
