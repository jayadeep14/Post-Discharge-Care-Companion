"""Loads the packaged readmission model and scores saved feature rows."""

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


MODEL_DIR = Path(__file__).resolve().parents[1]
RAW_FEATURES = (
    "time_in_hospital",
    "n_lab_procedures",
    "n_procedures",
    "n_medications",
    "n_outpatient",
    "n_inpatient",
    "n_emergency",
    "age",
    "medical_specialty",
    "diag_1",
    "diag_2",
    "diag_3",
    "glucose_test",
)
AGE_VALUES = {"[40-50)", "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"}
SPECIALTY_VALUES = {
    "Cardiology", "Emergency/Trauma", "Family/GeneralPractice",
    "InternalMedicine", "Missing", "Other", "Surgery",
}
DIAGNOSIS_VALUES = {
    "Circulatory", "Diabetes", "Digestive", "Injury", "Missing",
    "Musculoskeletal", "Other", "Respiratory",
}


@lru_cache(maxsize=1)
def _load_model():
    model = joblib.load(MODEL_DIR / "readmission_model.joblib")
    features = joblib.load(MODEL_DIR / "model_features.joblib")
    return model, list(features)


def score_readmission(feature_record: dict[str, Any]) -> dict[str, Any]:
    """Score either a saved model feature vector or a raw supported feature row."""
    model, model_features = _load_model()
    missing = [name for name in model_features if name not in feature_record]

    if not missing:
        encoded = pd.DataFrame([{name: feature_record[name] for name in model_features}])
    else:
        missing_raw = [
            name for name in RAW_FEATURES
            if name not in feature_record or feature_record[name] is None or feature_record[name] == ""
        ]
        if missing_raw:
            return {"available": False, "missing_features": missing_raw}
        if feature_record["age"] not in AGE_VALUES:
            raise ValueError("age must be one of the age bands used to train the model")
        if feature_record["medical_specialty"] not in SPECIALTY_VALUES:
            raise ValueError("medical_specialty does not match a category used by the model")
        for field in ("diag_1", "diag_2", "diag_3"):
            if feature_record[field] not in DIAGNOSIS_VALUES:
                raise ValueError(f"{field} does not match a category used by the model")
        if feature_record["glucose_test"] not in {"high", "no", "normal"}:
            raise ValueError("glucose_test must be high, no, or normal")
        raw = pd.DataFrame([{name: feature_record[name] for name in RAW_FEATURES}])
        encoded = pd.get_dummies(raw)
        encoded = encoded.reindex(columns=model_features, fill_value=0)

    try:
        probability = float(model.predict_proba(encoded)[0][1])
    except (AttributeError, IndexError, TypeError, ValueError) as exc:
        raise ValueError("The packaged model could not produce a probability score") from exc
    return {
        "available": True,
        "readmission_risk_pct": round(probability * 100, 2),
        "risk_category": "High" if probability >= 0.7 else "Moderate" if probability >= 0.4 else "Low",
    }
