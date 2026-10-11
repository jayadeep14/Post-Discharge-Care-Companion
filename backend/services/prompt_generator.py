import os
from google import genai

client = genai.Client()

def generate_call_task(
    patient_name: str,
    diagnoses: list,
    medications: list,
    issues: list,
    recent_states: list,
    readmission_risk_history: list | None = None,
    medication_adherence: list | None = None,
) -> str:
    """
    Generates a highly contextualized dynamic instruction string for CALL-E using Gemini.
    """
    sys_prompt = (
        "You are an expert clinical supervisor orchestrating an AI phone caller (CALL-E). "
        "You will receive a patient's context (diagnoses, medications, previous call history, saved readmission model risk, "
        "and reported medication adherence if available). "
        "Your job is to output a clear, concise instruction string for CALL-E telling it exactly how to steer "
        "the conversation with the patient today.\n\n"
        "RULES:\n"
        "1. Do NOT include pleasantries, greetings, or conversational filler in your output.\n"
        "2. If this is their FIRST call (no past history), instruct CALL-E to do a general post-discharge health check, "
        "ask about their specific diagnoses, and check if they are safely taking their prescribed medications.\n"
        "3. If they HAVE past history, analyze their recent states and open issues. Formulate a targeted instruction "
        "checking on the exact open issues (e.g., 'Check if their reported arm bleeding has stopped') and follow up on their adherence problems.\n"
        "4. Review the saved readmission risk and medication adherence. If the current model estimate is at least 60% "
        "and the patient has reported missing or not taking medicines, explain that the estimated risk is about the shown "
        "percentage and that missing prescribed medicines can increase their chance of readmission. Ask which medicines "
        "they missed and what made them difficult to take; encourage taking them as prescribed and contacting their doctor "
        "or pharmacist before stopping or changing any dose. Be supportive and do not blame or frighten the patient. "
        "Do not say the model score itself is increasing unless a previous saved score is lower than the current score. "
        "If it is lower, state the two estimates and that the model estimate has risen, without claiming medicines caused "
        "the change. Do not invent a risk score or adherence status. "
        "5. Your output must be a single paragraph string of direct instructions mapping tasks for the AI caller safely."
    )
    
    input_text = f"Patient Name: {patient_name}\n"
    current_risk = None
    previous_risk = None
    nonadherent_medications = []
    
    if diagnoses:
        diags = [d.get('icd_description', '') for d in diagnoses]
        input_text += f"Diagnoses: {', '.join(diags)}\n"
        
    if medications:
        meds = [m.get('drug_name', '') for m in medications]
        input_text += f"Prescribed Medications: {', '.join(meds)}\n"
        
    if recent_states and len(recent_states) > 0:
        input_text += "Recent Call History (Oldest to Newest):\n"
        # Reverse so Gemini sees trajectory natively properly mapped 
        for state in reversed(recent_states):
            input_text += f"- Status: {state.get('recovery_status')}, Summary: {state.get('summary')}\n"
    else:
        input_text += "Recent Call History: None (This is the FIRST call post-discharge).\n"

    if issues:
        open_issues = [i.get('description', '') for i in issues]
        input_text += f"Unresolved Open Issues: {', '.join(open_issues)}\n"

    risk_history = readmission_risk_history or []
    if risk_history:
        current = risk_history[0]
        current_risk = current.get("readmission_risk_pct")
        try:
            input_text += f"Latest saved readmission model risk: {float(current_risk):.1f}% ({current.get('risk_category') or 'category unavailable'}).\n"
        except (TypeError, ValueError):
            current_risk = None
            input_text += "Latest saved readmission model risk: unavailable (saved value was invalid).\n"
        if len(risk_history) > 1 and current_risk is not None:
            previous_risk = risk_history[1].get("readmission_risk_pct")
            try:
                input_text += f"Previous saved readmission model risk: {float(previous_risk):.1f}%.\n"
            except (TypeError, ValueError):
                pass
    else:
        current_risk = None
        input_text += "Latest saved readmission model risk: no prediction is available. Do not estimate one.\n"

    adherence_rows = medication_adherence or []
    if adherence_rows:
        # Repository results are newest first; use only each medicine's latest report.
        latest_by_medication = {}
        for row in adherence_rows:
            med_name = str(row.get("medication_name") or "").strip()
            if med_name and med_name.casefold() not in latest_by_medication:
                latest_by_medication[med_name.casefold()] = row
        adherence_summary = [
            f"{row.get('medication_name')}: {row.get('adherence_status')}"
            + (f" (reason: {row.get('reason_if_missed')})" if row.get("reason_if_missed") else "")
            for row in latest_by_medication.values()
        ]
        input_text += "Latest reported medication adherence: " + "; ".join(adherence_summary) + ".\n"
        nonadherent_medications = [
            row.get("medication_name")
            for row in latest_by_medication.values()
            if str(row.get("adherence_status") or "").casefold() in {
                "missing_some", "not_taking", "missed", "nonadherent", "not taking"
            }
        ]
    else:
        input_text += "Latest reported medication adherence: no saved adherence entries. Ask the patient; do not assume non-adherence.\n"
        
    prompt_str = f"{sys_prompt}\n\n[PATIENT CONTEXT]\n{input_text}"
    
    try:
        interaction = client.interactions.create(
            model="gemini-2.5-flash",
            input=prompt_str
        )
        return interaction.output_text.strip()
    except Exception as e:
        # Fallback failsafe string ensuring strict reliability
        fallback = (
            f"Call {patient_name} and perform a post-discharge health check; ask about their diagnoses, "
            "current symptoms, and whether they are taking each prescribed medicine as directed."
        )
        if current_risk is not None and float(current_risk) >= 60 and nonadherent_medications:
            medicine_names = ", ".join(str(name) for name in nonadherent_medications if name)
            fallback += (
                f" Explain that the saved model estimate is {float(current_risk):.1f}% and that missing "
                f"prescribed medicines can increase their chance of readmission; ask about missed doses of {medicine_names} "
                "and barriers, and advise them to contact their doctor or pharmacist before changing any dose."
            )
            try:
                if previous_risk is not None and float(current_risk) > float(previous_risk):
                    fallback += f" The model estimate rose from {float(previous_risk):.1f}% to {float(current_risk):.1f}%."
            except (TypeError, ValueError):
                pass
        return fallback
