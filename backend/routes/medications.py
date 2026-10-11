"""Authenticated medication education endpoint for the patient dashboard."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from google import genai
from pydantic import BaseModel

from backend.database.connection import supabase
from backend.database.repository import (
    get_patient_by_id,
    get_patient_diagnoses,
    get_patient_medications,
)
from backend.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/patients", tags=["medication education"])


class MedicationAnalysisRequest(BaseModel):
    medication_id: str


@router.post("/{patient_id}/medications/analyze")
async def analyze_medication(patient_id: str, body: MedicationAnalysisRequest):
    """Explain a prescribed medicine for the local demo dashboard."""
    try:
        patient, medications, diagnoses = await asyncio.gather(
            asyncio.to_thread(get_patient_by_id, patient_id),
            asyncio.to_thread(get_patient_medications, patient_id),
            asyncio.to_thread(get_patient_diagnoses, patient_id),
        )
    except Exception as exc:
        logger.exception("Could not load patient medication context")
        raise HTTPException(status_code=502, detail="Could not load the patient's medication information") from exc

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    medication = next((item for item in medications or [] if str(item.get("medication_id", item.get("id", ""))) == body.medication_id), None)
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found for this patient")

    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured in backend/.env")

    medicine_name = medication.get("drug_name") or medication.get("medication_name") or medication.get("name") or "Unknown medicine"
    diagnosis_names = [
        str(item.get("icd_description") or item.get("diagnosis") or item.get("description"))
        for item in diagnoses or []
        if item.get("icd_description") or item.get("diagnosis") or item.get("description")
    ]
    prompt = f"""You are providing general patient education about a prescribed medicine. Explain in plain language what {medicine_name} is commonly used for and why it may matter for this patient's documented conditions: {', '.join(diagnosis_names) or 'No diagnosis details are available'}. Prescription details: dose {medication.get('dosage') or 'not recorded'}, frequency {medication.get('frequency') or 'not recorded'}. Include what benefit to ask the prescriber about, common safety points, and when to contact a clinician urgently. If the link to a condition is uncertain, say so. Do not diagnose, infer a treatment plan, recommend starting/stopping/changing a medicine or dose, or claim certainty from incomplete information. Remind the patient to confirm their own instructions with their pharmacist or prescriber."""
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = (response.text or "").strip()
        if not text:
            raise ValueError("Gemini returned an empty explanation")
        return {"analysis": text, "medication_name": medicine_name}
    except Exception as exc:
        logger.exception("Gemini medication analysis failed for patient %s", patient_id)
        raise HTTPException(status_code=502, detail="AI medication explanation is unavailable right now") from exc
