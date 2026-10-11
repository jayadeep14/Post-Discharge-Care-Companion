import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { CalendarClock, CheckCircle2, CircleAlert, LoaderCircle, Phone, Pill, Sparkles } from "lucide-react"
import { supabase } from "../../lib/supabase"

type Medication = {
  medication_id?: string
  id?: string
  drug_name?: string
  medication_name?: string
  name?: string
  dosage?: string
  frequency?: string
  [key: string]: unknown
}

type AdherenceRecord = {
  medication_name: string
  adherence_status: string
  days_taken: number | null
  created_at: string
}

const statusOptions = [
  { value: "taking_all", label: "Taking as prescribed" },
  { value: "missing_some", label: "Missed some doses" },
  { value: "not_taking", label: "Not taking" },
  { value: "unknown", label: "Not sure / prefer not to say" },
]

const dateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const adherenceLabel = (status: string) => {
  return statusOptions.find(option => option.value === status)?.label || status
}

export default function Medications() {
  const { patientId = "" } = useParams()
  const [patientUuid, setPatientUuid] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [patientConditions, setPatientConditions] = useState<string[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [history, setHistory] = useState<AdherenceRecord[]>([])
  const [weeklyDays, setWeeklyDays] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingMedication, setAddingMedication] = useState(false)
  const [newMedication, setNewMedication] = useState({ drug_name: "", dosage: "", frequency: "" })
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [analysis, setAnalysis] = useState<Record<string, string>>({})
  const [analyzingId, setAnalyzingId] = useState("")
  const [callDate, setCallDate] = useState(() => dateInput(new Date(Date.now() + 7 * 86_400_000)))
  const [callTime, setCallTime] = useState("10:00")

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")
    try {
      let patientQuery = supabase.from("patients").select("patient_id, phone_number")
      patientQuery = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(patientId)
        ? patientQuery.eq("patient_id", patientId)
        : patientQuery.eq("mrn", patientId)
      const { data: patient, error: patientError } = await patientQuery.single()
      if (patientError) throw patientError
      const uuid = String(patient.patient_id)
      setPatientUuid(uuid)
      setPatientPhone(String(patient.phone_number || ""))

      const [medResult, diagnosesResult] = await Promise.all([
        supabase.from("medications_prescribed").select("*").eq("patient_id", uuid),
        supabase.from("diagnoses").select("icd_code, icd_description").eq("patient_id", uuid),
      ])
      let adherenceResult = await supabase.from("adherence_tracking")
        .select("medication_name, adherence_status, days_taken, created_at")
        .eq("patient_id", uuid).order("created_at", { ascending: false }).limit(100)
      // Keep existing records readable until the days_taken migration reaches the database.
      if (adherenceResult.error && /days_taken|schema cache/i.test(adherenceResult.error.message)) {
        adherenceResult = await supabase.from("adherence_tracking")
          .select("medication_name, adherence_status, created_at")
          .eq("patient_id", uuid).order("created_at", { ascending: false }).limit(100)
      }
      if (medResult.error) throw medResult.error
      if (adherenceResult.error) throw adherenceResult.error
      if (diagnosesResult.error) throw diagnosesResult.error
      setMedications(medResult.data || [])
      setHistory(adherenceResult.data || [])
      setPatientConditions((diagnosesResult.data || []).map((d: Record<string, string>) => d.icd_description || d.icd_code).filter(Boolean))
    } catch (error) {
      const detail = error && typeof error === "object" && "message" in error ? String(error.message) : ""
      setErrorMessage(detail || "Could not load patient medication details")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { void loadData() }, [loadData])

  const latestByMedication = useMemo(() => {
    const latest = new Map<string, AdherenceRecord>()
    for (const record of history) if (!latest.has(record.medication_name)) latest.set(record.medication_name, record)
    return latest
  }, [history])

  const medicationKey = (medication: Medication) => String(medication.medication_id || medication.id || "")
  const medicationTitle = (medication: Medication) => String(medication.drug_name || medication.medication_name || medication.name || "Unnamed medicine")

  async function saveWeeklyUpdate(event: React.FormEvent) {
    event.preventDefault()
    if (!patientUuid || medications.length === 0) return
    setSaving(true)
    setErrorMessage("")
    setMessage("")
    try {
      const callId = crypto.randomUUID()
      const { error: callError } = await supabase.from("call_events").insert({
        call_id: callId,
        patient_id: patientUuid,
        call_date: new Date().toISOString(),
        call_status: "manual_medication_checkin",
      })
      if (callError) throw callError
      const rows = medications.map(medication => ({
        patient_id: patientUuid,
        call_id: callId,
        medication_name: medicationKey(medication),
        days_taken: Number(weeklyDays[medicationKey(medication)]),
        adherence_status: weeklyDays[medicationKey(medication)] === "7"
          ? "taking_all"
          : weeklyDays[medicationKey(medication)] === "0" ? "not_taking" : "missing_some",
      }))
      const { error } = await supabase.from("adherence_tracking").insert(rows)
      if (error) throw error
      setMessage("Your medication check-in for this week was saved.")
      await loadData()
    } catch (error) {
      const detail = error && typeof error === "object" && "message" in error ? String(error.message) : ""
      setErrorMessage(/days_taken|schema cache/i.test(detail)
        ? "The database needs the days_taken migration before this check-in can be saved. Apply supabase/migrations/20261010_add_days_taken_to_adherence_tracking.sql and try again."
        : detail || "Could not save weekly update")
    } finally {
      setSaving(false)
    }
  }

  async function scheduleCall(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage("")
    setMessage("")
    try {
      const { error } = await supabase.from("follow_up_schedule").insert({
        patient_id: patientUuid,
        reason: "Type: Medication Review | Notes: Weekly medication follow-up",
        date_to_call: `${callDate}T${callTime}:00`,
        status: "scheduled",
      })
      if (error) throw error
      setMessage("Weekly medication follow-up call scheduled.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not schedule follow-up call")
    } finally {
      setSaving(false)
    }
  }

  async function addMedication(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage("")
    setMessage("")
    try {
      const { error } = await supabase.from("medications_prescribed").insert({
        patient_id: patientUuid,
        drug_name: newMedication.drug_name.trim(),
        dosage: newMedication.dosage.trim(),
        frequency: newMedication.frequency.trim(),
      })
      if (error) throw error
      setNewMedication({ drug_name: "", dosage: "", frequency: "" })
      setAddingMedication(false)
      setMessage("Medicine added to the patient's medication plan.")
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not add medication")
    } finally {
      setSaving(false)
    }
  }

  async function callNow() {
    if (!patientUuid || !patientPhone) {
      setErrorMessage("Add a phone number to this patient before starting a call.")
      return
    }
    setSaving(true)
    setErrorMessage("")
    setMessage("")
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
      const response = await fetch(`${apiUrl}/api/v1/calle/call/${patientUuid}`, {
        method: "POST",
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || result.message || "Call request failed")
      setMessage("Medication follow-up call started.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start call")
    } finally {
      setSaving(false)
    }
  }

  async function explainMedication(medication: Medication) {
    const id = medicationKey(medication)
    if (!id) {
      setErrorMessage("This medicine has no medication ID, so an AI explanation cannot be requested.")
      return
    }
    setAnalyzingId(id)
    setErrorMessage("")
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
      const response = await fetch(`${apiUrl}/api/v1/patients/${patientUuid}/medications/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medication_id: id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || "Could not generate medication explanation")
      setAnalysis(current => ({ ...current, [id]: result.analysis }))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not generate medication explanation")
    } finally {
      setAnalyzingId("")
    }
  }

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm text-gray-500"><LoaderCircle className="animate-spin" size={18} />Loading medication plan…</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-medium text-emerald-700">Patient care</p>
        <h2 className="mt-1 text-2xl font-semibold text-gray-900">Medication plan</h2>
        <p className="mt-1 text-sm text-gray-500">Review prescriptions, record weekly progress, and arrange a follow-up call.</p>
      </header>

      {errorMessage && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={18} className="mt-0.5 shrink-0" />{errorMessage}</div>}
      {message && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} />{message}</div>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Pill className="text-emerald-700" size={20} /><h3 className="text-lg font-semibold text-gray-900">Prescribed medicines</h3></div><button type="button" onClick={() => setAddingMedication(value => !value)} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{addingMedication ? "Cancel" : "Add medicine"}</button></div>
        {addingMedication && <form onSubmit={addMedication} className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-3"><label className="text-xs font-medium text-gray-600">Medicine name<input required value={newMedication.drug_name} onChange={event => setNewMedication(current => ({ ...current, drug_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" placeholder="Medicine" /></label><label className="text-xs font-medium text-gray-600">Dosage<input required value={newMedication.dosage} onChange={event => setNewMedication(current => ({ ...current, dosage: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" placeholder="e.g. 10 mg" /></label><label className="text-xs font-medium text-gray-600">Frequency<input required value={newMedication.frequency} onChange={event => setNewMedication(current => ({ ...current, frequency: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" placeholder="e.g. Once daily" /></label><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-60 sm:col-span-3">{saving ? "Saving…" : "Save medicine"}</button></form>}
        {medications.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">No medicines are listed for this patient yet. Add medication details from the patient record.</div> : medications.map(medication => {
          const id = medicationKey(medication)
          const latest = latestByMedication.get(id)
          return <article key={id || medicationTitle(medication)} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h4 className="font-semibold text-gray-900">{medicationTitle(medication)}</h4>
                <p className="mt-1 text-sm text-gray-600">{[medication.dosage, medication.frequency].filter(Boolean).join(" · ") || "Dose and frequency not recorded"}</p>
                {latest && <p className="mt-2 text-xs text-gray-500">Last update: {latest.days_taken == null ? adherenceLabel(latest.adherence_status) : `Taken ${latest.days_taken} ${latest.days_taken === 1 ? "day" : "days"} this week`} · {new Date(latest.created_at).toLocaleDateString()}</p>}
              </div>
              <button type="button" onClick={() => void explainMedication(medication)} disabled={analyzingId === id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">
                {analyzingId === id ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{analyzingId === id ? "Analyzing…" : analysis[id] ? "Refresh AI analysis" : "Analyze with Gemini"}
              </button>
            </div>
            {analysis[id] && <div className="mt-4 rounded-lg bg-emerald-50/70 p-4 text-sm leading-6 text-gray-700"><p className="mb-2 font-semibold text-emerald-900">AI education · verify with your care team</p><p className="whitespace-pre-wrap">{analysis[id]}</p><p className="mt-3 border-t border-emerald-100 pt-2 text-xs text-gray-600">Patient conditions on record: {patientConditions.join(", ") || "No diagnoses recorded"}. Do not change or stop a medicine based on this explanation; confirm your instructions with your prescriber or pharmacist.</p></div>}
          </article>
        })}
      </section>

      {medications.length > 0 && <form onSubmit={saveWeeklyUpdate} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4"><h3 className="text-lg font-semibold text-gray-900">This week’s medication check-in</h3><p className="mt-1 text-sm text-gray-500">For each medicine, record how many of the last 7 days you took it.</p></div>
        <div className="space-y-4">
          {medications.map(medication => {
            const id = medicationKey(medication)
            return <label key={id || medicationTitle(medication)} className="grid gap-2 text-sm sm:grid-cols-[1fr_1fr] sm:items-center"><span className="font-medium text-gray-800">{medicationTitle(medication)}</span><select required value={weeklyDays[id] || ""} onChange={event => setWeeklyDays(current => ({ ...current, [id]: event.target.value }))} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-emerald-600 focus:outline-none"><option value="" disabled>Choose days taken</option>{Array.from({ length: 8 }, (_, days) => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"}</option>)}</select></label>
          })}
        </div>
        <button disabled={saving} className="mt-5 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-60">{saving ? "Saving…" : "Save weekly update"}</button>
      </form>}

      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={scheduleCall} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><CalendarClock size={19} className="text-emerald-700" /><h3 className="text-lg font-semibold text-gray-900">Schedule weekly call</h3></div>
          <p className="mb-4 text-sm text-gray-500">The scheduled call is added to the follow-up queue.</p>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-gray-600">Date<input type="date" required min={dateInput(new Date())} value={callDate} onChange={event => setCallDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800" /></label><label className="text-xs font-medium text-gray-600">Time<input type="time" required value={callTime} onChange={event => setCallTime(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800" /></label></div>
          <button disabled={saving} className="mt-4 rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">{saving ? "Working…" : "Schedule follow-up"}</button>
        </form>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2"><Phone size={19} className="text-emerald-700" /><h3 className="text-lg font-semibold text-gray-900">Call patient now</h3></div>
          <p className="mb-1 text-sm text-gray-500">Starts the configured CALL-E follow-up call.</p>
          <p className="mb-4 text-xs text-gray-500">Number on file: {patientPhone || "No phone number"}</p>
          <button type="button" onClick={() => void callNow()} disabled={saving || !patientPhone} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Working…" : "Start call"}</button>
        </div>
      </section>
    </div>
  )
}
