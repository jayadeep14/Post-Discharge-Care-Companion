import os
from dotenv import load_dotenv
from calle import CalleClient
from backend.config import env_path

load_dotenv(dotenv_path=env_path)

api_key = os.getenv("CALLE_API_KEY")
calle_client = CalleClient(api_key=api_key) if api_key else None


# ✅ CORRECT:
import json
import logging
from datetime import datetime
from backend.services.calle_integration import calle_client
from backend.database.connection import get_supabase_client

logger = logging.getLogger(__name__)
supabase = get_supabase_client()

supabase = get_supabase_client()

def fetch_and_save_call_report(calle_call_id: str, db_call_id: str, patient_id: str):
    """
    Directly queries CALL-E API for a completed call report and persists structured data to Supabase.
    """
    # 1. Fetch Call payload directly from CALL-E SDK
    call_data = calle_client.calls.get(calle_call_id)
    
    status = call_data.get("status")
    transcript = call_data.get("transcript", "")
    structured_result = call_data.get("structured_result") or call_data.get("result", {})

    if status != "completed":
        logger.warning(f"Call {calle_call_id} not completed yet. Current status: {status}")
        return

    # 2. Parse structured dynamic keys
    recovery_status = structured_result.get("recovery_status", "stable")
    summary = structured_result.get("call_summary", "Follow-up check completed.")
    has_new_symptoms = structured_result.get("has_new_symptoms", "no") == "yes"

    # 3. Store snapshot state in patient_states table
    supabase.table("patient_states").insert({
        "patient_id": patient_id,
        "call_id": db_call_id,
        "recovery_status": recovery_status,
        "summary": summary,
        "raw_json": structured_result,
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    # 4. Handle unresolved/new symptoms
    if has_new_symptoms:
        new_issue_desc = structured_result.get("new_symptoms_description", "New reported symptoms after call.")
        supabase.table("issues").insert({
            "patient_id": patient_id,
            "description": new_issue_desc,
            "status": "open",
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        
    logger.info(f"Successfully processed and stored call report for call_id: {db_call_id}")
