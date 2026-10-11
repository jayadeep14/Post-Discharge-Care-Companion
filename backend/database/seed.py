import uuid
import random
from datetime import datetime, timedelta
from backend.database.connection import supabase

def clean_database():
    print("Nuking database records securely via manual cascades...")
    patients = supabase.table('patients').select('patient_id').execute()
    for p in patients.data:
        pid = p['patient_id']
        supabase.table('adherence_tracking').delete().eq('patient_id', pid).execute()
        supabase.table('patient_states').delete().eq('patient_id', pid).execute()
        supabase.table('issues').delete().eq('patient_id', pid).execute()
        supabase.table('call_alerts').delete().eq('patient_id', pid).execute()
        supabase.table('call_events').delete().eq('patient_id', pid).execute()
        supabase.table('diagnoses').delete().eq('patient_id', pid).execute()
        supabase.table('medications_prescribed').delete().eq('patient_id', pid).execute()
        supabase.table('patients').delete().eq('patient_id', pid).execute()
        
def seed_patient(data):
    mrn_seed = "TEST" + str(random.randint(100, 999))
    p_id = str(uuid.uuid4())
    supabase.table('patients').insert([{
        "patient_id": p_id,
        "mrn": mrn_seed,
        "name": data['name'],
        "phone_number": data['phone_number'],
        "age": data['age'],
        "gender": data['gender'],
        "admission_date": (datetime.now() - timedelta(days=5)).isoformat(),
        "discharge_date": datetime.now().isoformat(),
        "hospital_risk_score": 0.5
    }]).execute()
    
    for diag in data['diagnoses']:
        supabase.table('diagnoses').insert([{
            "diagnosis_id": str(uuid.uuid4()),
            "patient_id": p_id,
            "icd_code": diag['icd_code'],
            "icd_description": diag['icd_description'],
            "primary_flag": diag.get('primary_flag', False)
        }]).execute()
        
    for med in data['medications']:
        supabase.table('medications_prescribed').insert([{
            "med_id": str(uuid.uuid4()),
            "patient_id": p_id,
            "drug_name": med['drug_name'],
            "dosage": med['dosage'],
            "frequency": med['frequency']
        }]).execute()
    print(f"Patient seed successful: {data['name']}")


shone = {
    "name": "Shone Bijju", "age": 62, "gender": "Male", "phone_number": "+917306585872",
    "diagnoses": [
        {"icd_code": "I50.9", "icd_description": "Heart failure, unspecified", "primary_flag": True},
        {"icd_code": "I10", "icd_description": "Essential (primary) hypertension"},
        {"icd_code": "E11.9", "icd_description": "Type 2 diabetes mellitus without complications"}
    ],
    "medications": [
        {"drug_name": "Furosemide", "dosage": "40 mg", "frequency": "Once daily"},
        {"drug_name": "Lisinopril", "dosage": "10 mg", "frequency": "Once daily"},
        {"drug_name": "Metformin", "dosage": "500 mg", "frequency": "Twice daily with meals"},
        {"drug_name": "Carvedilol", "dosage": "6.25 mg", "frequency": "Twice daily"}
    ]
}

malavika = {
    "name": "Malavika", "age": 54, "gender": "Female", "phone_number": "+918075589464",
    "diagnoses": [
        {"icd_code": "K81.0", "icd_description": "Acute cholecystitis", "primary_flag": True},
        {"icd_code": "Z90.49", "icd_description": "Acquired absence of other parts of digestive tract"}
    ],
    "medications": [
        {"drug_name": "Paracetamol", "dosage": "650 mg", "frequency": "Every 6 hours as needed for pain"},
        {"drug_name": "Amoxicillin-Clavulanate", "dosage": "625 mg", "frequency": "Three times daily"},
        {"drug_name": "Pantoprazole", "dosage": "40 mg", "frequency": "Once daily before breakfast"}
    ]
}

jassim = {
    "name": "Jassim", "age": 20, "gender": "Male", "phone_number": "+919037996402",
    "diagnoses": [
        {"icd_code": "J45.901", "icd_description": "Unspecified asthma with acute exacerbation", "primary_flag": True},
        {"icd_code": "J06.9", "icd_description": "Acute upper respiratory infection, unspecified"}
    ],
    "medications": [
        {"drug_name": "Budesonide-Formoterol", "dosage": "160/4.5 mcg", "frequency": "Two inhalations twice daily"},
        {"drug_name": "Salbutamol", "dosage": "100 mcg", "frequency": "Two inhalations as needed"},
        {"drug_name": "Prednisolone", "dosage": "40 mg", "frequency": "Once daily"}
    ]
}

shahmas = {
    "name": "Shahmas", "age": 16, "gender": "Female", "phone_number": "+919074797923",
    "diagnoses": [
        {"icd_code": "A09", "icd_description": "Infectious gastroenteritis and colitis, unspecified", "primary_flag": True},
        {"icd_code": "E86.0", "icd_description": "Dehydration"}
    ],
    "medications": [
        {"drug_name": "Ondansetron", "dosage": "4 mg", "frequency": "Every 8 hours as needed for nausea"},
        {"drug_name": "Oral Rehydration Salts", "dosage": "1 sachet", "frequency": "After episodes of vomiting"},
        {"drug_name": "Zinc Sulfate", "dosage": "20 mg", "frequency": "Once daily"}
    ]
}

if __name__ == "__main__":
    clean_database()
    for patient in [shone, malavika, jassim, shahmas]:
        seed_patient(patient)
    print("\nFresh Database Seed Completely Recompiled with Full Mock Data Segments!!!")
