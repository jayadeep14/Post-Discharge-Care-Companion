from supabase import create_client, Client

url: str = "https://oajkbjzhrtlicoxlmofg.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hamtianpocnRsaWNveGxtb2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODY0OTgsImV4cCI6MjEwMjk2MjQ5OH0.qR4E8ANV3oO8pM_j2LXhz2T7sMSiV12tMgFVYWUE2b0"  # Use service_role key if bypassing RLS

supabase: Client = create_client(url, key)

def update_discharge_date(patient_id: str, new_discharge_date: str):
    """
    Updates the discharge_date for a specific patient.
    Date format should be 'YYYY-MM-DD' or full ISO timestamp 'YYYY-MM-DDTHH:MM:SS'.
    """
    try:
        response = supabase.table("patients") \
            .update({"discharge_date": f"{new_discharge_date}T10:50:00"}) \
            .eq("patient_id", patient_id) \
            .execute()
        
        print("Discharge date updated successfully:", response)
    except Exception as e:
        print("Error updating discharge date:", e)

def print_patients_data():
    try:
        # Fetch all columns and rows from the 'patients' table
        response = supabase.table("patients").select("*").execute()
        
        # Print the raw response data
        print("Fetched Patients Data:")
        for patient in response.data:
            print(patient)
            
    except Exception as e:
        print("Error fetching data:", e)

def print_scheduled_follow_ups():
    try:
        # Query the new 'follow_up_schedule' table matching the updated schema
        response = supabase.table("follow_up_schedule") \
            .select("id, patient_id, reason, date_to_call, status, created_at") \
            .execute()
        
        follow_ups = response.data
        
        if not follow_ups:
            print("No scheduled follow-up records found.")
            return

        print(f"--- Found {len(follow_ups)} Follow-up Record(s) ---")
        for idx, record in enumerate(follow_ups, start=1):
            print(f"\n[Follow-up #{idx}]")
            print(f"  • ID:           {record.get('id')}")
            print(f"  • Patient UUID: {record.get('patient_id')}")
            print(f"  • Reason:       {record.get('reason') or 'N/A'}")
            print(f"  • Date to Call: {record.get('date_to_call') or 'N/A'}")
            print(f"  • Status:       {record.get('status') or 'N/A'}")
            print(f"  • Created At:   {record.get('created_at') or 'N/A'}")

    except Exception as e:
        print("Error fetching follow-up data:", e)
def print_call_events_data():
    try:
        # Fetch all columns and rows from the 'call_events' table
        response = supabase.table("call_events").select("*").execute()
        
        call_events = response.data
        
        if not call_events:
            print("No call event records found.")
            return

        print(f"--- Found {len(call_events)} Call Event Record(s) ---")
        for idx, record in enumerate(call_events, start=1):
            print(f"\n[Call Event #{idx}]")
            print(f"  • Call ID:      {record.get('call_id')}")
            print(f"  • Patient ID:   {record.get('patient_id')}")
            print(f"  • Call Number:  {record.get('call_number') or 'N/A'}")
            print(f"  • Call Date:    {record.get('call_date') or 'N/A'}")
            print(f"  • Audio URL:    {record.get('audio_url') or 'N/A'}")
            print(f"  • Call Status:  {record.get('call_status') or 'N/A'}")
            print(f"  • Call Success: {record.get('call_success')}")
            print(f"  • Created At:   {record.get('created_at') or 'N/A'}")

    except Exception as e:
        print("Error fetching call events data:", e)

# Add this invocation at the bottom of your script
print_call_events_data()

#update_discharge_date("1f5e219c-d7e0-470d-9910-ac7c67298ee2", "2026-09-22")
print_patients_data()
# Usage (replace with your actual patient UUID)
#

print_scheduled_follow_ups()
