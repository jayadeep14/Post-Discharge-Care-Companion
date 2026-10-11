"""Readmission scores for patient and hospital reporting screens."""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.database.connection import supabase
from backend.services.readmission_model import score_readmission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/readmissions", tags=["readmission reports"])


class ReadmissionScoreRequest(BaseModel):
    features: dict = Field(min_length=1)


class PatientLabReportRequest(BaseModel):
    features: dict = Field(min_length=1)
    source: str = "manual"
    file_name: str | None = None


def _scoring_error_detail(exc: Exception, report_name: str) -> str:
    message = str(exc).lower()
    if "pgrst205" in message or "ml_feature_sets" in message and "not find" in message:
        return (
            "Readmission feature data is not set up in Supabase: the "
            "ml_feature_sets table is missing. Create the table and "
            "load this patient's structured model inputs before scoring."
        )
    return f"{report_name} is unavailable. Check the backend log for the scoring error."


def _patient_features():
    try:
        response = (
            supabase.table("ml_feature_sets")
            .select("patient_id,hospital_features_json,feature_timestamp,created_at")
            .order("feature_timestamp", desc=True)
            .execute()
        )
    except Exception as exc:
        if "pgrst205" in str(exc).lower() or "ml_feature_sets" in str(exc).lower() and "not find" in str(exc).lower():
            logger.warning("ml_feature_sets is not present")
            return {}
        raise
    by_patient = {}
    for record in response.data or []:
        patient_id = record.get("patient_id")
        features = record.get("hospital_features_json")
        if patient_id and isinstance(features, dict) and patient_id not in by_patient:
            by_patient[patient_id] = features
    return by_patient


def _medication_counts():
    """Count medication rows per patient using the supplied medications_prescribed schema."""
    response = supabase.table("medications_prescribed").select("patient_id, med_id").execute()
    counts = {}
    for medication in response.data or []:
        patient_id = medication.get("patient_id")
        if patient_id:
            counts[patient_id] = counts.get(patient_id, 0) + 1
    return counts


def _prediction(patient: dict, features: dict | None):
    feature_record = dict(features or {})
    if "n_medications" not in feature_record:
        feature_record["n_medications"] = _medication_counts().get(patient.get("patient_id"), 0)
    result = score_readmission(feature_record)
    return {
        "patient_id": patient.get("patient_id"),
        "mrn": patient.get("mrn"),
        "name": patient.get("name") or "Unknown patient",
        **result,
    }


def _score_for_patient(patient: dict, features: dict):
    """Score using the current database age and saved hospital features."""
    feature_record = dict(features)
    age = patient.get("age")
    if isinstance(age, (int, float)):
        if 40 <= age < 100:
            decade = int(age // 10) * 10
            feature_record["age"] = f"[{decade}-{decade + 10})"
        else:
            return {
                "available": False,
                "missing_features": [
                    "age (the packaged model supports ages 40–99; this patient's stored age is outside that range)"
                ],
            }
    return score_readmission(feature_record)


def _patient_record(patient_id: str):
    query = supabase.table("patients").select("patient_id, mrn, name, age")
    response = (
        query.eq("patient_id", patient_id).limit(1).execute()
        if len(patient_id) > 15
        else query.eq("mrn", patient_id).limit(1).execute()
    )
    return response.data[0] if response.data else None


def _saved_predictions():
    response = (
        supabase.table("readmission_predictions")
        .select("patient_id, readmission_risk_pct, risk_category, prediction_date")
        .order("prediction_date", desc=True)
        .execute()
    )
    latest = {}
    for prediction in response.data or []:
        latest.setdefault(prediction.get("patient_id"), prediction)
    return latest


def _latest_lab_report(patient_id: str):
    response = (
        supabase.table("ml_feature_sets")
        .select("feature_set_id, patient_id, hospital_features_json, feature_timestamp, created_at")
        .eq("patient_id", patient_id)
        .not_.is_("hospital_features_json", "null")
        .order("feature_timestamp", desc=True)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    record = response.data[0]
    return {
        "report_id": record.get("feature_set_id"),
        "patient_id": record.get("patient_id"),
        "features": record.get("hospital_features_json") or {},
        "source": "ml_feature_sets",
        "file_name": None,
        "created_at": record.get("feature_timestamp") or record.get("created_at"),
    }


def _latest_lab_reports():
    response = (
        supabase.table("ml_feature_sets")
        .select("feature_set_id, patient_id, hospital_features_json, feature_timestamp, created_at")
        .not_.is_("hospital_features_json", "null")
        .order("feature_timestamp", desc=True)
        .execute()
    )
    latest = {}
    for report in response.data or []:
        patient_id = report.get("patient_id")
        if patient_id:
            latest.setdefault(patient_id, {
                "report_id": report.get("feature_set_id"),
                "patient_id": patient_id,
                "features": report.get("hospital_features_json") or {},
                "source": "ml_feature_sets",
                "file_name": None,
                "created_at": report.get("feature_timestamp") or report.get("created_at"),
            })
    return latest


def _save_prediction(patient_id: str, result: dict):
    prediction_date = datetime.now(timezone.utc).isoformat()
    row = {
        "prediction_id": str(uuid4()),
        "patient_id": patient_id,
        "readmission_risk_pct": result["readmission_risk_pct"],
        "risk_category": result["risk_category"],
        "prediction_date": prediction_date,
    }
    supabase.table("readmission_predictions").insert(row).execute()
    return prediction_date


def _score_and_save(patient_id: str, features: dict):
    result = score_readmission(features)
    if not result.get("available"):
        raise HTTPException(
            status_code=422,
            detail=f"Missing model inputs: {', '.join(result.get('missing_features', []))}",
        )
    prediction_date = _save_prediction(patient_id, result)
    return {**result, "patient_id": patient_id, "prediction_date": prediction_date}


@router.get("/patient/{patient_id}")
def patient_readmission_score(patient_id: str):
    """Return a patient's current model score, if feature data is available."""
    try:
        patient = _patient_record(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        report = _latest_lab_report(patient["patient_id"])
        stored = _saved_predictions().get(patient["patient_id"])
        if report and (not stored or str(report.get("created_at") or "") > str(stored.get("prediction_date") or "")):
            result = _score_for_patient(patient, report["features"])
            if result.get("available"):
                saved_date = _save_prediction(patient["patient_id"], result)
                stored = {"patient_id": patient["patient_id"], **result, "prediction_date": saved_date}
            else:
                return {"patient_id": patient["patient_id"], "mrn": patient.get("mrn"), "name": patient.get("name"), **result}
        if stored:
            return {"patient_id": patient["patient_id"], "mrn": patient.get("mrn"), "name": patient.get("name"), "available": True, **stored}
        if report:
            result = _score_for_patient(patient, report["features"])
            if result.get("available"):
                saved_date = _save_prediction(patient["patient_id"], result)
                return {"patient_id": patient["patient_id"], "mrn": patient.get("mrn"), "name": patient.get("name"), **result, "prediction_date": saved_date}
            return {"patient_id": patient["patient_id"], "mrn": patient.get("mrn"), "name": patient.get("name"), **result}
        result = _prediction(patient, _patient_features().get(patient["patient_id"]))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not calculate patient readmission score")
        raise HTTPException(status_code=503, detail=_scoring_error_detail(exc, "Readmission scoring")) from exc


@router.get("/patient/{patient_id}/lab-report")
def get_patient_lab_report(patient_id: str):
    try:
        patient = _patient_record(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return {"report": _latest_lab_report(patient["patient_id"])}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not load patient's saved lab report")
        raise HTTPException(status_code=503, detail="Could not load this patient's lab report") from exc


@router.post("/patient/{patient_id}/lab-report")
def save_patient_lab_report(patient_id: str, body: PatientLabReportRequest):
    if body.source not in {"manual", "upload"}:
        raise HTTPException(status_code=422, detail="source must be manual or upload")
    try:
        patient = _patient_record(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        result = _score_for_patient(patient, body.features)
        if not result.get("available"):
            raise HTTPException(
                status_code=422,
                detail=f"Missing model inputs: {', '.join(result.get('missing_features', []))}",
            )
        report = {
            "feature_set_id": str(uuid4()),
            "patient_id": patient["patient_id"],
            "hospital_features_json": body.features,
            "feature_timestamp": datetime.now(timezone.utc).isoformat(),
            "is_training_set": False,
        }
        saved_report = supabase.table("ml_feature_sets").insert(report).execute()
        saved_record = saved_report.data[0] if saved_report.data else report
        report_data = {
            "report_id": saved_record.get("feature_set_id"),
            "patient_id": patient["patient_id"],
            "features": saved_record.get("hospital_features_json", body.features),
            "source": body.source,
            "file_name": body.file_name,
            "created_at": saved_record.get("feature_timestamp", report["feature_timestamp"]),
        }
        prediction_date = _save_prediction(patient["patient_id"], result)
        return {
            "report": report_data,
            "prediction": {**result, "patient_id": patient["patient_id"], "prediction_date": prediction_date},
        }
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        logger.exception("Could not save lab report and prediction")
        raise HTTPException(status_code=503, detail="Could not save the lab report and model prediction") from exc


@router.post("/patient/{patient_id}/run")
def score_saved_patient_lab_report(patient_id: str):
    """Run the model on the latest lab report already stored for this patient."""
    try:
        patient = _patient_record(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        report = _latest_lab_report(patient["patient_id"])
        if not report:
            raise HTTPException(status_code=404, detail="No saved lab report exists for this patient")
        result = _score_for_patient(patient, report["features"])
        if not result.get("available"):
            raise HTTPException(status_code=422, detail=f"Missing or unsupported model inputs: {', '.join(result.get('missing_features', []))}")
        prediction_date = _save_prediction(patient["patient_id"], result)
        result = {**result, "patient_id": patient["patient_id"], "prediction_date": prediction_date}
        return {**result, "source": "saved_lab_report"}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Could not score saved lab report")
        raise HTTPException(status_code=503, detail="Could not run the model on the saved lab report") from exc


@router.post("/patient/{patient_id}/score")
def score_patient_lab_sample(patient_id: str, body: ReadmissionScoreRequest):
    """Score submitted structured lab/model features and save the patient prediction."""
    if not patient_id.strip():
        raise HTTPException(status_code=400, detail="Patient ID is required")
    try:
        patient = _patient_record(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        result = _score_for_patient(patient, body.features)
        if not result.get("available"):
            raise HTTPException(
                status_code=422,
                detail=f"Missing model inputs: {', '.join(result.get('missing_features', []))}",
            )
        prediction_date = _save_prediction(patient["patient_id"], result)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        logger.exception("Could not score submitted lab feature sample")
        raise HTTPException(status_code=503, detail="The model score could not be saved for this patient") from exc
    return {**result, "patient_id": patient["patient_id"], "source": "uploaded_lab_data", "prediction_date": prediction_date}


@router.get("/hospital")
def hospital_readmission_scores():
    """Score the latest saved report for each patient, then return saved predictions."""
    try:
        patients = supabase.table("patients").select("patient_id, mrn, name, age").execute().data or []
        reports_by_patient = _latest_lab_reports()
        saved_by_patient = _saved_predictions()

        def report_row(patient):
            patient_id = patient.get("patient_id")
            report = reports_by_patient.get(patient_id)
            saved = saved_by_patient.get(patient_id)
            if report and (not saved or str(report.get("created_at") or "") > str(saved.get("prediction_date") or "")):
                try:
                    result = _score_for_patient(patient, report["features"])
                    if result.get("available"):
                        prediction_date = _save_prediction(patient_id, result)
                        saved = {"patient_id": patient_id, **result, "prediction_date": prediction_date}
                    else:
                        return {
                            **patient,
                            **result,
                            "available": False,
                        }
                except Exception:
                    logger.exception("Could not score latest saved report for patient %s", patient_id)
            if saved:
                return {**patient, "available": True, **saved}
            return {
                **patient,
                "available": False,
                "missing_features": ["No saved lab report"],
            }

        return {
            "patients": [report_row(patient) for patient in patients]
        }
    except Exception as exc:
        logger.exception("Could not build hospital readmission report")
        raise HTTPException(status_code=503, detail=_scoring_error_detail(exc, "Readmission report")) from exc


@router.get("/hospital/alerts")
def hospital_high_risk_alerts():
    """List unacknowledged high-risk call alerts with patient/report context."""
    try:
        alerts = (supabase.table("call_alerts")
            .select("alert_id, call_id, patient_id, alert_type, severity, description, recommended_action, was_actioned, created_at")
            .eq("alert_type", "readmission_high_risk")
            .eq("was_actioned", False)
            .order("created_at", desc=True)
            .execute()).data or []
        if not alerts:
            return {"alerts": []}

        patient_ids = list(dict.fromkeys(alert.get("patient_id") for alert in alerts if alert.get("patient_id")))
        patients = (supabase.table("patients").select("*")
            .in_("patient_id", patient_ids).execute()).data or []
        patients_by_id = {patient.get("patient_id"): patient for patient in patients}
        predictions_by_patient = _saved_predictions()
        feature_rows = (supabase.table("ml_feature_sets")
            .select("patient_id, hospital_features_json, feature_timestamp, created_at")
            .in_("patient_id", patient_ids)
            .not_.is_("hospital_features_json", "null")
            .order("feature_timestamp", desc=True).execute()).data or []
        report_by_patient = {}
        for feature_row in feature_rows:
            report_by_patient.setdefault(feature_row.get("patient_id"), {
                "features": feature_row.get("hospital_features_json") or {},
                "created_at": feature_row.get("feature_timestamp") or feature_row.get("created_at"),
            })
        return {
            "alerts": [
                {
                    **alert,
                    "patient": patients_by_id.get(alert.get("patient_id")),
                    "prediction": predictions_by_patient.get(alert.get("patient_id")),
                    "report": report_by_patient.get(alert.get("patient_id")),
                }
                for alert in alerts
            ]
        }
    except Exception as exc:
        logger.exception("Could not load hospital high-risk alerts")
        raise HTTPException(status_code=503, detail="High-risk hospital alerts are unavailable") from exc
