"""
CALL-E Alert Detection Service

Takes the structured result from a completed CALL-E conversation
and determines whether clinical follow-up or escalation is needed.

Alert levels:
    CRITICAL -> immediate emergency action / urgent human escalation
    HIGH     -> nurse / clinical review
    MEDIUM   -> follow-up / referral
    LOW      -> informational / scheduled review
    NONE     -> no alert
"""


def detect_alert(result: dict) -> dict:
    """
    Analyze a structured CALL-E conversation result.

    Returns:
        {
            "alert_level": "CRITICAL | HIGH | MEDIUM | LOW | NONE",
            "reason": "...",
            "recommended_action": "..."
        }
    """

    # ---------------------------------------------------------
    # Safely read values from the CALL-E result
    # ---------------------------------------------------------

    urgent_concern = result.get("urgent_concern", "unknown")
    needs_human_review = result.get("needs_human_review", "unknown")

    recovery_status = result.get("recovery_status", "unknown")
    missed_doses = result.get("missed_doses", "unknown")
    medication_access_issue = result.get(
        "medication_access_issue", "unknown"
    )
    medication_side_effects = result.get(
        "medication_side_effects", "unknown"
    )
    medication_confusion = result.get(
        "medication_confusion", "unknown"
    )
    transportation_issue = result.get(
        "transportation_issue", "unknown"
    )
    caregiver_available = result.get(
        "caregiver_available", "unknown"
    )

    symptom_details = result.get("symptom_details", "") or ""
    side_effect_details = result.get(
        "side_effect_details", ""
    ) or ""

    # ---------------------------------------------------------
    # CRITICAL ALERT
    #
    # The chatbot marks urgent concerns explicitly.
    # We also check symptom text for obvious emergency terms.
    # ---------------------------------------------------------

    emergency_keywords = [
        "chest pain",
        "severe breathing",
        "difficulty breathing",
        "can't breathe",
        "cannot breathe",
        "fainting",
        "passed out",
        "severe confusion",
        "self harm",
        "suicidal",
    ]

    combined_symptom_text = (
        f"{symptom_details} {side_effect_details}"
    ).lower()

    emergency_symptom_found = any(
        keyword in combined_symptom_text
        for keyword in emergency_keywords
    )

    if urgent_concern == "yes" or emergency_symptom_found:
        return {
            "alert_level": "CRITICAL",
            "reason": (
                "Potentially urgent or serious concern reported "
                "during the CALL-E conversation."
            ),
            "recommended_action": (
                "Provide appropriate emergency instructions and "
                "escalate immediately to authorized clinical staff."
            ),
        }

    # ---------------------------------------------------------
    # HIGH ALERT
    #
    # Worsening recovery, medication problems, or inability
    # to obtain medication require clinical review.
    # ---------------------------------------------------------

    if recovery_status == "worsening":
        return {
            "alert_level": "HIGH",
            "reason": "Patient reported worsening recovery or symptoms.",
            "recommended_action": (
                "Route the case for nurse or clinical review."
            ),
        }

    if missed_doses == "yes":
        return {
            "alert_level": "HIGH",
            "reason": "Patient reported missed medication doses.",
            "recommended_action": (
                "Route the medication issue for clinical review."
            ),
        }

    if medication_access_issue == "yes":
        return {
            "alert_level": "HIGH",
            "reason": (
                "Patient reported difficulty obtaining or "
                "refilling medication."
            ),
            "recommended_action": (
                "Arrange clinical/pharmacy follow-up to address "
                "medication access."
            ),
        }

    # ---------------------------------------------------------
    # MEDIUM ALERT
    #
    # Issues that need follow-up but are not currently urgent.
    # ---------------------------------------------------------

    if medication_side_effects == "yes":
        return {
            "alert_level": "MEDIUM",
            "reason": "Patient reported medication side effects.",
            "recommended_action": (
                "Arrange follow-up with an authorized clinician "
                "or pharmacist."
            ),
        }

    if medication_confusion == "yes":
        return {
            "alert_level": "MEDIUM",
            "reason": "Patient reported confusion about medication.",
            "recommended_action": (
                "Arrange medication clarification with an "
                "authorized clinician or pharmacist."
            ),
        }

    if transportation_issue == "yes":
        return {
            "alert_level": "MEDIUM",
            "reason": "Patient reported a transportation difficulty.",
            "recommended_action": (
                "Arrange appropriate follow-up or support."
            ),
        }

    if caregiver_available == "no":
        return {
            "alert_level": "MEDIUM",
            "reason": "Patient reported no caregiver or family support.",
            "recommended_action": (
                "Review whether additional follow-up or support "
                "is required."
            ),
        }

    # ---------------------------------------------------------
    # LOW ALERT
    #
    # Human review requested without a higher-priority problem.
    # ---------------------------------------------------------

    if needs_human_review == "yes":
        return {
            "alert_level": "LOW",
            "reason": "CALL-E requested human clinical review.",
            "recommended_action": (
                "Review the conversation during scheduled follow-up."
            ),
        }

    # ---------------------------------------------------------
    # NO ALERT
    # ---------------------------------------------------------

    return {
        "alert_level": "NONE",
        "reason": "No alert-triggering issue was identified.",
        "recommended_action": (
            "Continue routine post-discharge monitoring."
        ),
    }