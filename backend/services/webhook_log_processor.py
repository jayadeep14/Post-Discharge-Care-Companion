"""Tail webhook_logs.txt and persist Gemini call summaries to existing tables.

Run alongside the API with:
    python -m backend.services.webhook_log_processor
"""

import json
import logging
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.config import GEMINI_API_KEY
from backend.database.connection import supabase

logger = logging.getLogger("webhook_log_processor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

LOG_PATH = Path.cwd() / "webhook_logs.txt"
POLL_SECONDS = 1

EXTRACTION_SCHEMA = {
    "recovery_status": "improving|stable|worsening|unknown",
    "has_new_symptoms": "boolean",
    "summary": "brief call summary or empty string",
    "symptoms": [{
        "symptom_name": "string explicitly mentioned",
        "severity_score": "integer 1-10 or null",
        "trend": "improving|stable|worsening|unknown",
    }],
    "medication_adherence": [{
        "medication_name": "exact prescribed medication name",
        "adherence_status": "taking_all|missing_some|not_taking|unknown",
        "reason_if_missed": "string or null",
    }],
    "prescription_updates": [{
        "drug_name": "string",
        "dosage": "string or null",
        "frequency": "string or null",
        "start_date": "YYYY-MM-DD or null",
        "end_date": "YYYY-MM-DD or null",
        "active_now": "boolean or null",
        "clinician_order_confirmed": "boolean",
    }],
    "mood_score": "integer 1-10 or null",
    "anxiety_level": "none|low|moderate|high|unknown or null",
    "motivation_score": "integer 1-10 or null",
    "living_situation": "string or null",
    "has_caregiver": "boolean or null",
    "barriers": "string or null",
}


def _extract_with_gemini(event: dict, medications: list[dict]) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required to process completed-call logs")
    from google import genai

    data = event.get("data") or {}
    source = {
        "transcript": data.get("transcript") or data.get("transcription"),
        "structured_result": data.get("structured_result") or data.get("result"),
    }
    if not source["transcript"] and not source["structured_result"]:
        raise ValueError("Webhook has no transcript or structured call result")
    medication_context = [
        {key: row.get(key) for key in ("drug_name", "dosage", "frequency")}
        for row in medications
    ]
    prompt = (
        "Extract only what the call explicitly says. Do not infer clinical facts or prescriptions. "
        "Set clinician_order_confirmed=true only for a prescription explicitly ordered by a clinician. "
        "Use null and empty arrays for facts not stated. Return JSON matching this schema: "
        + json.dumps(EXTRACTION_SCHEMA)
        + "\nCurrent prescribed medications: " + json.dumps(medication_context)
        + "\nCall data: " + json.dumps(source, ensure_ascii=False, default=str)
    )
    response = genai.Client(api_key=GEMINI_API_KEY).models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"},
    )
    output = (getattr(response, "text", None) or "").strip()
    if output.startswith("```"):
        output = re.sub(r"^```(?:json)?\s*|\s*```$", "", output, flags=re.IGNORECASE)
    parsed = json.loads(output)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response was not a JSON object")
    return parsed


def _already_processed(patient_id: str, call_id: str) -> bool:
    response = (supabase.table("ml_feature_sets")
        .select("feature_set_id").eq("patient_id", patient_id)
        .contains("call_features_json", {"call_id": call_id})
        .limit(1).execute())
    return bool(response.data)


def _insert_adherence(patient_id: str, call_id: str, call_day: str, result: dict):
    for item in result.get("medication_adherence") or []:
        name = str(item.get("medication_name") or "").strip()
        status = item.get("adherence_status")
        if not name or status not in {"taking_all", "missing_some", "not_taking", "unknown"}:
            continue
        exists = (supabase.table("adherence_tracking").select("adherence_id")
            .eq("call_id", call_id).eq("medication_name", name).limit(1).execute())
        if exists.data:
            continue
        supabase.table("adherence_tracking").insert({
            "adherence_id": str(uuid4()), "patient_id": patient_id,
            "call_id": call_id, "medication_name": name,
            "adherence_status": status,
            "reason_if_missed": item.get("reason_if_missed"), "call_date": call_day,
        }).execute()


def _insert_symptoms(patient_id: str, call_id: str, call_day: str, result: dict):
    for item in result.get("symptoms") or []:
        name = str(item.get("symptom_name") or "").strip()
        if not name:
            continue
        exists = (supabase.table("symptom_progression").select("symptom_id")
            .eq("call_id", call_id).eq("symptom_name", name).limit(1).execute())
        if exists.data:
            continue
        severity = item.get("severity_score")
        if not isinstance(severity, int) or not 1 <= severity <= 10:
            severity = None
        trend = item.get("trend")
        if trend not in {"improving", "stable", "worsening", "unknown"}:
            trend = "unknown"
        supabase.table("symptom_progression").insert({
            "symptom_id": str(uuid4()), "patient_id": patient_id,
            "call_id": call_id, "symptom_name": name,
            "severity_score": severity, "trend": trend, "call_date": call_day,
        }).execute()


def _save_wellbeing_support(patient_id: str, call_id: str, call_day: str, result: dict):
    mood, motivation = result.get("mood_score"), result.get("motivation_score")
    anxiety = result.get("anxiety_level")
    if anxiety not in {"none", "low", "moderate", "high", "unknown"}:
        anxiety = None
    has_wellbeing = any((isinstance(score, int) and 1 <= score <= 10) for score in (mood, motivation)) or anxiety
    if has_wellbeing:
        exists = (supabase.table("mental_wellbeing").select("wellbeing_id")
            .eq("call_id", call_id).limit(1).execute())
        if not exists.data:
            supabase.table("mental_wellbeing").insert({
                "wellbeing_id": str(uuid4()), "patient_id": patient_id,
                "call_id": call_id,
                "mood_score": mood if isinstance(mood, int) and 1 <= mood <= 10 else None,
                "anxiety_level": anxiety,
                "motivation_score": motivation if isinstance(motivation, int) and 1 <= motivation <= 10 else None,
                "call_date": call_day,
            }).execute()
    if result.get("living_situation") or isinstance(result.get("has_caregiver"), bool) or result.get("barriers"):
        exists = (supabase.table("caregiver_support").select("support_id")
            .eq("call_id", call_id).limit(1).execute())
        if not exists.data:
            supabase.table("caregiver_support").insert({
                "support_id": str(uuid4()), "patient_id": patient_id,
                "call_id": call_id, "living_situation": result.get("living_situation"),
                "has_caregiver": result.get("has_caregiver"),
                "barriers": result.get("barriers"), "call_date": call_day,
            }).execute()


def _save_explicit_prescriptions(patient_id: str, result: dict):
    """Apply medication details only when Gemini found an explicit clinician order."""
    medications = (supabase.table("medications_prescribed")
        .select("med_id, drug_name").eq("patient_id", patient_id).execute()).data or []
    for update in result.get("prescription_updates") or []:
        if update.get("clinician_order_confirmed") is not True:
            continue
        name = str(update.get("drug_name") or "").strip()
        if not name:
            continue
        values = {key: update[key] for key in ("dosage", "frequency") if update.get(key)}
        for key in ("start_date", "end_date"):
            raw_date = update.get(key)
            if raw_date:
                try:
                    values[key] = date.fromisoformat(str(raw_date)).isoformat()
                except ValueError:
                    logger.warning("Ignoring invalid Gemini %s for prescription %s", key, name)
        existing = next((med for med in medications if str(med.get("drug_name") or "").casefold() == name.casefold()), None)
        if existing:
            if values:
                supabase.table("medications_prescribed").update(values).eq("med_id", existing["med_id"]).execute()
        else:
            supabase.table("medications_prescribed").insert({
                "med_id": str(uuid4()), "patient_id": patient_id, "drug_name": name,
                "dosage": values.get("dosage"), "frequency": values.get("frequency"),
                "start_date": values.get("start_date"), "end_date": values.get("end_date"),
                # active_at_discharge is not the same as active after a call.
                "active_at_discharge": None,
            }).execute()


def _refresh_model_risk(patient_id: str, call_id: str):
    """Create a fresh model estimate only from complete saved hospital features."""
    from backend.services.readmission_model import score_readmission

    features = (supabase.table("ml_feature_sets")
        .select("hospital_features_json")
        .eq("patient_id", patient_id)
        .not_.is_("hospital_features_json", "null")
        .order("feature_timestamp", desc=True).limit(1).execute()).data or []
    if not features or not features[0].get("hospital_features_json"):
        logger.info("No saved hospital model inputs for patient_id=%s; skipping risk refresh", patient_id)
        return
    hospital_features = features[0]["hospital_features_json"]
    person = (supabase.table("patients").select("age")
        .eq("patient_id", patient_id).limit(1).execute()).data or [{}]
    age = person[0].get("age")
    if isinstance(age, (int, float)) and 40 <= age < 100:
        decade = int(age // 10) * 10
        hospital_features = {**hospital_features, "age": f"[{decade}-{decade + 10})"}
    try:
        score = score_readmission(hospital_features)
    except ValueError:
        logger.exception("Saved hospital features are not valid for the packaged model")
        return
    if not score.get("available"):
        logger.info("Saved hospital inputs are incomplete; skipping risk refresh for patient_id=%s", patient_id)
        return
    supabase.table("readmission_predictions").insert({
        "prediction_id": str(uuid4()), "patient_id": patient_id,
        "readmission_risk_pct": score["readmission_risk_pct"],
        "risk_category": score["risk_category"],
        "prediction_date": datetime.now(timezone.utc).isoformat(),
    }).execute()
    if 85 <= score["readmission_risk_pct"] <= 100:
        existing_alert = (supabase.table("call_alerts")
            .select("alert_id").eq("call_id", call_id)
            .eq("alert_type", "readmission_high_risk")
            .limit(1).execute()).data
        if not existing_alert:
            supabase.table("call_alerts").insert({
                "alert_id": str(uuid4()),
                "call_id": call_id,
                "patient_id": patient_id,
                "alert_type": "readmission_high_risk",
                "severity": "critical",
                "description": (
                    f"Post-call readmission model estimate is {score['readmission_risk_pct']:.1f}%. "
                    "Review the patient's details and reports."
                ),
                "recommended_action": "Open the patient overview and review the latest readmission report.",
                "was_actioned": False,
            }).execute()


def process_completed_event(event: dict):
    """Persist a completed webhook after its original route has saved the log."""
    if event.get("type") != "call.completed":
        return
    data = event.get("data") or {}
    metadata = data.get("metadata") or {}
    call_id = metadata.get("db_call_id")
    if not call_id:
        logger.warning("Ignoring completed webhook without db_call_id")
        return True
    call_rows = (supabase.table("call_events")
        .select("call_id, patient_id, call_status, call_success, call_date")
        .eq("call_id", call_id).limit(1).execute()).data or []
    if not call_rows:
        logger.warning("Call id from webhook is not in call_events: %s", call_id)
        return True
    call = call_rows[0]
    # The provider's call.completed event is success evidence. Respect an
    # explicit false outcome in call_events, and require the route's completed state.
    if call.get("call_success") is False:
        logger.info("Ignoring call whose database outcome is unsuccessful: %s", call_id)
        return True
    if call.get("call_status") != "completed":
        logger.info("Call is not marked successfully completed yet: %s", call_id)
        return False
    patient_id = call.get("patient_id")
    if not patient_id or _already_processed(patient_id, call_id):
        return True

    medications = (supabase.table("medications_prescribed")
        .select("drug_name, dosage, frequency").eq("patient_id", patient_id).execute()).data or []
    result = _extract_with_gemini(event, medications)
    try:
        call_day = datetime.fromisoformat(str(call.get("call_date")).replace("Z", "+00:00")).date().isoformat()
    except (TypeError, ValueError):
        call_day = date.today().isoformat()

    _insert_adherence(patient_id, call_id, call_day, result)
    _insert_symptoms(patient_id, call_id, call_day, result)
    _save_wellbeing_support(patient_id, call_id, call_day, result)
    _save_explicit_prescriptions(patient_id, result)

    if result.get("has_new_symptoms") is True:
        summary = str(result.get("summary") or "New symptoms reported during follow-up call.")
        from backend.database.repository import create_or_update_issue
        create_or_update_issue(patient_id, call_id, summary)
        alerts = (supabase.table("call_alerts").select("alert_id")
            .eq("call_id", call_id).eq("alert_type", "new_symptoms").limit(1).execute()).data
        if not alerts:
            supabase.table("call_alerts").insert({
                "alert_id": str(uuid4()), "call_id": call_id, "patient_id": patient_id,
                "alert_type": "new_symptoms", "severity": "medium",
                "description": summary,
                "recommended_action": "Review the reported symptoms with the care team.",
                "was_actioned": False,
            }).execute()

    # Keep the existing patient_states row but replace its initial CALL-E result
    # with the normalized Gemini extraction.
    state_rows = (supabase.table("patient_states").select("id")
        .eq("call_id", call_id).limit(1).execute()).data or []
    if state_rows:
        supabase.table("patient_states").update({
            "recovery_status": result.get("recovery_status"),
            "has_new_symptoms": result.get("has_new_symptoms") is True,
            "medication_adherence": ", ".join(
                f"{item.get('medication_name')}: {item.get('adherence_status')}"
                for item in result.get("medication_adherence") or []
            ) or "unknown",
            "summary": result.get("summary"),
            "structured_result": result,
        }).eq("id", state_rows[0]["id"]).execute()
    else:
        supabase.table("patient_states").insert({
            "id": str(uuid4()), "patient_id": patient_id, "call_id": call_id,
            "recovery_status": result.get("recovery_status"),
            "has_new_symptoms": result.get("has_new_symptoms") is True,
            "medication_adherence": ", ".join(
                f"{item.get('medication_name')}: {item.get('adherence_status')}"
                for item in result.get("medication_adherence") or []
            ) or "unknown",
            "summary": result.get("summary"), "structured_result": result,
        }).execute()

    _refresh_model_risk(patient_id, call_id)
    # This JSON call_id is the idempotency marker; write it after the other
    # records so a retry can finish incomplete database operations.
    supabase.table("ml_feature_sets").insert({
        "feature_set_id": str(uuid4()), "patient_id": patient_id,
        "call_features_json": {"call_id": call_id, **result},
        "feature_timestamp": datetime.now(timezone.utc).isoformat(),
        "is_training_set": False,
    }).execute()
    logger.info("Gemini call data saved for call_id=%s patient_id=%s", call_id, patient_id)
    return True


def _payloads_from_lines(lines: list[str]):
    for line in lines:
        marker = "PAYLOAD: "
        if not line.startswith(marker):
            continue
        try:
            event = json.loads(line[len(marker):])
        except json.JSONDecodeError:
            logger.exception("Could not decode a PAYLOAD line in webhook_logs.txt")
            continue
        if isinstance(event, dict):
            yield event


def watch_log_file(log_path: Path = LOG_PATH, poll_seconds: int = POLL_SECONDS):
    """Process only new complete log lines; start at EOF to avoid replaying history."""
    offset = log_path.stat().st_size if log_path.exists() else 0
    pending = b""
    queued_events = {}
    logger.info("Watching %s for new completed call webhooks", log_path.resolve())
    while True:
        try:
            if not log_path.exists():
                time.sleep(poll_seconds)
                continue
            size = log_path.stat().st_size
            if size < offset:
                offset, pending = 0, b""  # log file was rotated/truncated
            with log_path.open("rb") as log_file:
                log_file.seek(offset)
                chunk = log_file.read()
                offset = log_file.tell()
            pending += chunk
            pieces = pending.split(b"\n")
            pending = pieces.pop()  # preserve any partial line until the next poll
            complete_lines = [piece.decode("utf-8", errors="replace") for piece in pieces]
            for event in _payloads_from_lines(complete_lines):
                if event.get("type") != "call.completed":
                    continue
                event_key = str(event.get("id") or (event.get("data") or {}).get("metadata", {}).get("db_call_id") or uuid4())
                queued_events.setdefault(event_key, {"event": event, "attempt": 0, "retry_at": 0.0})
            now = time.monotonic()
            for event_key, queued in list(queued_events.items()):
                if now < queued["retry_at"]:
                    continue
                try:
                    if process_completed_event(queued["event"]):
                        queued_events.pop(event_key, None)
                    else:
                        queued["retry_at"] = now + 2
                except Exception:
                    queued["attempt"] += 1
                    queued["retry_at"] = now + min(2 ** queued["attempt"], 60)
                    logger.exception("Gemini/database sync failed for webhook event %s; retry queued", event_key)
        except Exception:
            logger.exception("Webhook log watcher failed")
        time.sleep(poll_seconds)


if __name__ == "__main__":
    watch_log_file()
