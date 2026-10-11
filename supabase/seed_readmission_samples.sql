-- Load the ten supplied rows into existing ml_feature_sets rows.
-- Patient/sample rows pair by created_at (oldest patient first), then patient_id.
-- For this prototype, patient ages are 40 through 49 in that order. The model
-- uses the actual age stored in public.patients. `Readmitted` is excluded as
-- an outcome label; row 10 has no glucose value and will not receive a score.

WITH ranked_patients AS (
    SELECT patient_id,
           row_number() OVER (ORDER BY created_at NULLS FIRST, patient_id) AS patient_no
    FROM public.patients
)
UPDATE public.patients AS patient
SET age = 39 + ranked.patient_no::integer
FROM ranked_patients AS ranked
WHERE ranked.patient_id = patient.patient_id
  AND ranked.patient_no <= 10;

WITH sample_rows (
    sample_no, time_in_hospital, n_lab_procedures, n_procedures,
    n_medications, n_outpatient, n_inpatient, n_emergency,
    medical_specialty, diag_1, diag_2, diag_3, glucose_test
) AS (
    VALUES
        (1, 3, 59, 0, 10, 0, 0, 0, 'Missing', 'Other', 'Other', 'Other', 'no'),
        (2, 4, 44, 2, 21, 0, 0, 0, 'Missing', 'Injury', 'Other', 'Other', 'no'),
        (3, 4, 69, 0, 6, 0, 0, 0, 'InternalMedicine', 'Respiratory', 'Other', 'Circulatory', 'no'),
        (4, 1, 9, 0, 11, 0, 0, 0, 'Missing', 'Respiratory', 'Circulatory', 'Circulatory', 'no'),
        (5, 4, 37, 2, 15, 0, 0, 0, 'Missing', 'Digestive', 'Digestive', 'Respiratory', 'no'),
        (6, 3, 40, 1, 17, 0, 1, 0, 'Missing', 'Circulatory', 'Other', 'Diabetes', 'no'),
        (7, 5, 45, 0, 24, 0, 0, 0, 'Missing', 'Circulatory', 'Other', 'Diabetes', 'no'),
        (8, 2, 43, 4, 5, 0, 0, 0, 'InternalMedicine', 'Digestive', 'Other', 'Diabetes', 'no'),
        (9, 3, 42, 0, 16, 0, 3, 0, 'InternalMedicine', 'Diabetes', 'Digestive', 'Other', 'no'),
        (10, 1, 52, 0, 7, 0, 0, 0, 'Emergency/Trauma', 'Missing', 'Missing', 'Missing', NULL)
), ranked_patients AS (
    SELECT
        patient_id,
        age,
        row_number() OVER (ORDER BY created_at NULLS FIRST, patient_id) AS patient_no
    FROM public.patients
), eligible_pairs AS (
    SELECT p.patient_id, p.age, s.*
    FROM ranked_patients p
    JOIN sample_rows s ON s.sample_no = p.patient_no
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.ml_feature_sets existing
        WHERE existing.patient_id = p.patient_id
          AND existing.hospital_features_json IS NOT NULL
    )
)
INSERT INTO public.ml_feature_sets (
    feature_set_id, patient_id, hospital_features_json, feature_timestamp, is_training_set
)
SELECT
    gen_random_uuid(),
    patient_id,
    jsonb_build_object(
        'age', age,
        'time_in_hospital', time_in_hospital,
        'n_lab_procedures', n_lab_procedures,
        'n_procedures', n_procedures,
        'n_medications', n_medications,
        'n_outpatient', n_outpatient,
        'n_inpatient', n_inpatient,
        'n_emergency', n_emergency,
        'medical_specialty', medical_specialty,
        'diag_1', diag_1,
        'diag_2', diag_2,
        'diag_3', diag_3,
        'glucose_test', glucose_test
    ),
    now(),
    false
FROM eligible_pairs;
