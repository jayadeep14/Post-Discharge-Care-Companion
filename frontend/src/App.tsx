import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import PatientLayout from "./pages/patient/patientlayout";
import Overview from "./pages/patient/overview";
import CallHistory from "./pages/patient/CallHistory";
import Alerts from "./pages/patient/Alerts";
import Features from "./pages/patient/Features";
import CarePlan from "./pages/patient/CarePlan";
import Documents from "./pages/patient/Document";
import Medications from "./pages/patient/Medications";
import PatientChat from "./pages/patient/PatientChat";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, useNavigate, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getDemoUser, signOutDemo } from './lib/demoAuth'
import type { DemoUser } from './lib/demoAuth'

import {
  Menu,
  Activity,
  Bell,
  FileText,
  Home,
  LogOut,
  Settings as SettingsIcon,
  Users,
  ChevronDown,
  Search,
  ShieldPlus,
  X,
  Phone,
  FilePenLine,
  MoreVertical,
  UserRound,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from 'lucide-react'


interface Patient {
  name: string
  id: string
  patient_uuid?: string
  image: string
  risk: "High" | "Moderate" | "Low" | "Unavailable"
  riskScore: number | null
  alerts: number
  days: number
  lastCall: string
  status: string
  medication: number
  symptoms: string
  phone_number?: string
  age?: number
  diagnosis?: string
  admission_date?: string
  discharge_date?: string
  hospital_risk_score?: number
}

interface HospitalRiskAlert {
  alert_id: string
  description?: string
  severity?: string
  created_at?: string
  patient_id: string
  patient?: { patient_id: string; name?: string; mrn?: string; age?: number; gender?: string; phone_number?: string; admission_date?: string; discharge_date?: string } | null
  prediction?: { readmission_risk_pct?: number; risk_category?: string } | null
  report?: { created_at?: string; features?: Record<string, unknown> } | null
}

interface DiagnosisDraft {
  icd_code: string
  icd_description: string
  primary_flag: boolean
}

interface MedicationDraft {
  drug_name: string
  dosage: string
  frequency: string
}

// Fetch patients from Supabase
async function fetchPatientsFromSupabase(): Promise<Patient[]> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')

    if (error) throw error

    if (!data) return []

    const apiUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    let predictionsByPatient = new Map<string, { available?: boolean; readmission_risk_pct?: number; risk_category?: string }>()
    try {
      const response = await fetch(`${apiUrl}/api/v1/readmissions/hospital`)
      if (response.ok) {
        const report = await response.json()
        const predictionRows = (report.patients || []) as Array<{ available?: boolean; patient_id?: string; readmission_risk_pct?: number; risk_category?: string }>
        predictionsByPatient = new Map(
          predictionRows
            .filter(item => item.patient_id)
            .map(item => [item.patient_id as string, item] as [string, { available?: boolean; readmission_risk_pct?: number; risk_category?: string }]),
        )
      }
    } catch (error) {
      console.warn('Could not load saved readmission predictions:', error)
    }

    // Map Supabase data to Patient format
    return data.map((p: any) => {
      const prediction = predictionsByPatient.get(p.patient_id)
      const riskScore = prediction?.available ? prediction.readmission_risk_pct ?? null : null
      const risk = prediction?.risk_category === "High" || prediction?.risk_category === "Moderate" || prediction?.risk_category === "Low"
        ? prediction.risk_category
        : "Unavailable"
      return ({
      name: p.name || 'Unknown',
      id: p.mrn || p.patient_id?.slice(0, 10) || 'N/A',
      patient_uuid: p.patient_id,
      image: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 50)}`,
      risk,
      riskScore: riskScore == null ? null : Math.round(riskScore),
      alerts: Math.floor(Math.random() * 3),
      days: Math.floor(Math.random() * 14) + 1,
      lastCall: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: riskScore == null ? "Prediction unavailable" : risk === "High" ? "High Risk" : risk === "Moderate" ? "Moderate Risk" : "On Track",
      medication: 70 + Math.floor(Math.random() * 30),
      symptoms: ["Improving", "Stable", "Worsening"][Math.floor(Math.random() * 3)],
      phone_number: p.phone_number,
      age: p.age,
      diagnosis: p.diagnosis,
      admission_date: p.admission_date,
      discharge_date: p.discharge_date,
      hospital_risk_score: p.hospital_risk_score,
      })
    })
  } catch (error) {
    console.error('Error fetching patients:', error)
    return []
  }
}

function AddPatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (patient: Patient) => void
}) {
  const [form, setForm] = useState({
    name: '',
    mrn: '',
    phone_number: '',
    age: '',
    gender: '',
    admission_date: '',
    discharge_date: '',
    hospital_risk_score: '50',
  })
  const [diagnoses, setDiagnoses] = useState<DiagnosisDraft[]>([
    { icd_code: '', icd_description: '', primary_flag: true },
  ])
  const [medications, setMedications] = useState<MedicationDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const inputClass = 'mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
  const labelClass = 'block text-xs font-medium text-gray-600'

  async function submitPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const completedDiagnoses = diagnoses.filter(
      diagnosis => diagnosis.icd_code.trim() || diagnosis.icd_description.trim(),
    )
    const incompleteDiagnosis = completedDiagnoses.some(
      diagnosis => !diagnosis.icd_code.trim() || !diagnosis.icd_description.trim(),
    )
    const completedMedications = medications.filter(
      medication => medication.drug_name.trim() || medication.dosage.trim() || medication.frequency.trim(),
    )
    const incompleteMedication = completedMedications.some(
      medication => !medication.drug_name.trim() || !medication.dosage.trim() || !medication.frequency.trim(),
    )
    let normalizedPhone = form.phone_number.trim().replace(/[\s().-]/g, '')
    if (normalizedPhone.startsWith('00')) normalizedPhone = `+${normalizedPhone.slice(2)}`

    if (completedDiagnoses.length === 0) {
      setErrorMessage('Add at least one diagnosis with an ICD code and description.')
      return
    }
    if (incompleteDiagnosis) {
      setErrorMessage('Complete both the ICD code and description for each diagnosis.')
      return
    }
    if (incompleteMedication) {
      setErrorMessage('Complete the name, dosage, and frequency for each medication, or remove the blank row.')
      return
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setErrorMessage('Enter the patient phone in international format with a + and country code, for example +14155552671.')
      return
    }
    if (
      form.admission_date &&
      form.discharge_date &&
      form.discharge_date < form.admission_date
    ) {
      setErrorMessage('Discharge date must be on or after the admission date.')
      return
    }

    const patientId = crypto.randomUUID()
    const mrn = form.mrn.trim() || `MRN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const riskScore = Number(form.hospital_risk_score)
    let patientInserted = false
    setSaving(true)

    try {
      const { error: patientError } = await supabase.from('patients').insert({
        patient_id: patientId,
        mrn,
        name: form.name.trim(),
        phone_number: normalizedPhone,
        age: Number(form.age),
        gender: form.gender,
        admission_date: form.admission_date || null,
        discharge_date: form.discharge_date || null,
        hospital_risk_score: riskScore,
      })
      if (patientError) throw patientError
      patientInserted = true

      if (completedDiagnoses.length > 0) {
        const { error: diagnosisError } = await supabase.from('diagnoses').insert(
          completedDiagnoses.map(diagnosis => ({
            diagnosis_id: crypto.randomUUID(),
            patient_id: patientId,
            icd_code: diagnosis.icd_code.trim(),
            icd_description: diagnosis.icd_description.trim(),
            primary_flag: diagnosis.primary_flag,
          })),
        )
        if (diagnosisError) throw diagnosisError
      }

      if (completedMedications.length > 0) {
        const { error: medicationError } = await supabase.from('medications_prescribed').insert(
          completedMedications.map(medication => ({
            med_id: crypto.randomUUID(),
            patient_id: patientId,
            drug_name: medication.drug_name.trim(),
            dosage: medication.dosage.trim(),
            frequency: medication.frequency.trim(),
          })),
        )
        if (medicationError) throw medicationError
      }

      onCreated({
        name: form.name.trim(),
        id: mrn,
        patient_uuid: patientId,
        image: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 50)}`,
        risk: 'Unavailable',
        riskScore: null,
        alerts: 0,
        days: form.discharge_date
          ? Math.max(0, Math.floor((Date.now() - new Date(form.discharge_date).getTime()) / 86_400_000))
          : 0,
        lastCall: 'No calls yet',
        status: 'Prediction unavailable',
        medication: 0,
        symptoms: 'Not assessed',
        phone_number: normalizedPhone,
        age: Number(form.age),
        admission_date: form.admission_date,
        discharge_date: form.discharge_date,
        hospital_risk_score: riskScore,
      })
    } catch (error) {
      console.error('Could not add patient:', error)
      if (patientInserted) {
        // Best-effort cleanup if a diagnosis or medication insert fails.
        await Promise.all([
          supabase.from('diagnoses').delete().eq('patient_id', patientId),
          supabase.from('medications_prescribed').delete().eq('patient_id', patientId),
          supabase.from('patients').delete().eq('patient_id', patientId),
        ])
      }
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this patient. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-patient-title" className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-7">
          <div>
            <h2 id="add-patient-title" className="text-lg font-semibold text-gray-900">Add patient</h2>
            <p className="mt-1 text-xs text-gray-500">Add demographics, discharge details, diagnoses, and medications.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submitPatient} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Full name *
                <input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Patient name" />
              </label>
              <label className={labelClass}>Medical record number
                <input value={form.mrn} onChange={event => setForm({ ...form, mrn: event.target.value })} className={inputClass} placeholder="Generated if left blank" />
              </label>
              <label className={labelClass}>Phone number *
                <input required type="tel" value={form.phone_number} onChange={event => setForm({ ...form, phone_number: event.target.value })} className={inputClass} placeholder="+1 555 123 4567" />
                <span className="mt-1 block font-normal text-gray-400">Include + and the country calling code for automated calls.</span>
              </label>
              <label className={labelClass}>Age *
                <input required type="number" min="0" max="130" value={form.age} onChange={event => setForm({ ...form, age: event.target.value })} className={inputClass} placeholder="Age in years" />
              </label>
              <label className={labelClass}>Gender *
                <select required value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })} className={inputClass}>
                  <option value="">Select gender</option>
                  <option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </label>
              <label className={labelClass}>Hospital risk score (0–100) *
                <input required type="number" min="0" max="100" value={form.hospital_risk_score} onChange={event => setForm({ ...form, hospital_risk_score: event.target.value })} className={inputClass} />
              </label>
              <label className={labelClass}>Admission date
                <input type="date" value={form.admission_date} onChange={event => setForm({ ...form, admission_date: event.target.value })} className={inputClass} />
              </label>
              <label className={labelClass}>Discharge date
                <input type="date" value={form.discharge_date} onChange={event => setForm({ ...form, discharge_date: event.target.value })} className={inputClass} />
              </label>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-gray-800">Diagnoses *</h3><p className="text-[11px] text-gray-500">Use the ICD code and description from the patient record.</p></div>
                <button type="button" onClick={() => setDiagnoses([...diagnoses, { icd_code: '', icd_description: '', primary_flag: false }])} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"><Plus size={14} /> Add diagnosis</button>
              </div>
              <div className="space-y-3">
                {diagnoses.map((diagnosis, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
                    <label className={labelClass}>ICD code
                      <input value={diagnosis.icd_code} onChange={event => setDiagnoses(diagnoses.map((item, itemIndex) => itemIndex === index ? { ...item, icd_code: event.target.value } : item))} className={inputClass} placeholder="e.g. I10" />
                    </label>
                    <label className={labelClass}>Description
                      <input value={diagnosis.icd_description} onChange={event => setDiagnoses(diagnoses.map((item, itemIndex) => itemIndex === index ? { ...item, icd_description: event.target.value } : item))} className={inputClass} placeholder="Diagnosis description" />
                    </label>
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs text-gray-600"><input type="checkbox" checked={diagnosis.primary_flag} onChange={event => setDiagnoses(diagnoses.map((item, itemIndex) => itemIndex === index ? { ...item, primary_flag: event.target.checked } : item))} /> Primary</label>
                      {diagnoses.length > 1 && <button type="button" aria-label="Remove diagnosis" onClick={() => setDiagnoses(diagnoses.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-gray-800">Medications</h3><p className="text-[11px] text-gray-500">Medication details are optional; add each prescription separately.</p></div>
                <button type="button" onClick={() => setMedications([...medications, { drug_name: '', dosage: '', frequency: '' }])} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"><Plus size={14} /> Add medication</button>
              </div>
              <div className="space-y-3">
                {medications.map((medication, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
                    <label className={labelClass}>Medication
                      <input value={medication.drug_name} onChange={event => setMedications(medications.map((item, itemIndex) => itemIndex === index ? { ...item, drug_name: event.target.value } : item))} className={inputClass} placeholder="Drug name" />
                    </label>
                    <label className={labelClass}>Dosage
                      <input value={medication.dosage} onChange={event => setMedications(medications.map((item, itemIndex) => itemIndex === index ? { ...item, dosage: event.target.value } : item))} className={inputClass} placeholder="e.g. 10 mg" />
                    </label>
                    <label className={labelClass}>Frequency
                      <input value={medication.frequency} onChange={event => setMedications(medications.map((item, itemIndex) => itemIndex === index ? { ...item, frequency: event.target.value } : item))} className={inputClass} placeholder="e.g. Once daily" />
                    </label>
                    <button type="button" aria-label="Remove medication" onClick={() => setMedications(medications.filter((_, itemIndex) => itemIndex !== index))} className="justify-self-end rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>

            {errorMessage && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
          </div>
          <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 sm:px-7">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#08734f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#065d40] disabled:cursor-wait disabled:opacity-60">
              <Plus size={16} /> {saving ? 'Saving patient…' : 'Save patient'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function Header({
  onMenuClick,
  profileOpen,
  setProfileOpen,
  onLogout,
}: {
  onMenuClick: () => void
  profileOpen: boolean
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => void
}) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-[#064E3B] px-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button onClick={onMenuClick} className="rounded-md p-2 text-white hover:bg-transparent">
          <Menu size={22} />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
          <ShieldPlus size={40} strokeWidth={2} className="text-white sm:h-[46px] sm:w-[46px]" />
        </div>
        <div>
          <h1 className="font-anton font-bold text-[17px] leading-tight tracking-wide text-white sm:text-[21px] lg:text-[25px]">Recovera  AI</h1>
          <p className="text-[11px] text-emerald-100 sm:block">Real-time insights. Better outcomes.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 lg:gap-6">
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/10"
          >
            <img src="https://i.pravatar.cc/100?img=47" alt="Profile" className="h-10 w-10 rounded-full object-cover" />
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-[13px] font-semibold text-white">JS healthcare</p>
              <p className="mt-0.5 text-[11px] text-emerald-100">Care Team</p>
            </div>
            <ChevronDown size={17} className={`ml-2 text-white transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[58px] z-50 w-[190px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-[13px] font-semibold text-gray-900">JS healthcare</p>
                <p className="mt-1 text-[11px] text-gray-500">Care Team</p>
              </div>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={17} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function PatientDetail({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const riskColor = patient.risk === "High" ? "red" : patient.risk === "Moderate" ? "yellow" : patient.risk === "Low" ? "green" : "gray"

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Patient Detail</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <img src={patient.image} alt={patient.name} className="h-14 w-14 rounded-full object-cover" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800">{patient.name}</h3>
            <p className="text-[10px] text-gray-500">ID: {patient.id}</p>
            <div className="mt-1 flex gap-2">
              <span className={`rounded px-2 py-1 text-[9px] font-medium ${riskColor === 'red' ? 'bg-red-50 text-red-600' : riskColor === 'yellow' ? 'bg-yellow-50 text-yellow-600' : riskColor === 'green' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {patient.risk}
              </span>
              <span className="rounded bg-gray-100 px-2 py-1 text-[9px] font-medium text-gray-600">{patient.riskScore == null ? "N/A" : `${patient.riskScore}%`}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-gray-100">
        <InfoItem icon={<UserRound size={13} />} title="Age" value={patient.age?.toString() || 'N/A'} />
        <InfoItem icon={<Activity size={13} />} title="Diagnosis" value={patient.diagnosis || 'N/A'} />
        <InfoItem icon={<FileText size={13} />} title="Phone" value={patient.phone_number?.slice(-4) || 'N/A'} />
        <InfoItem icon={<UserRound size={13} />} title="Risk Score" value={patient.riskScore == null ? "N/A" : `${patient.riskScore}%`} />
      </div>

      <section className="m-3 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">Latest Call</h3>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded bg-green-50 px-2 py-1 text-[9px] font-medium text-green-700">Day {patient.days} Check-in</span>
          <span className="text-[9px] text-gray-500">{patient.lastCall}</span>
        </div>
      </section>

      <section className="m-3 rounded-lg border border-gray-200 p-3">
        <h3 className="text-xs font-semibold text-gray-800">Medication Adherence</h3>
        <p className="mt-2 text-[9px] text-gray-600">{patient.medication}% of doses taken</p>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${patient.medication}%` }}></div>
        </div>
      </section>
    </div>
  )
}

function InfoItem({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="border-r border-gray-100 p-2">
      <div className="flex items-center gap-1 text-green-700">
        {icon}
        <span className="text-[8px] text-gray-500">{title}</span>
      </div>
      <p className="mt-1 text-[9px] font-medium text-gray-700">{value}</p>
    </div>
  )
}

function FeatureRow({ feature, status, statusColor, trend }: { feature: string; status: string; statusColor: 'red' | 'green' | 'yellow'; trend: string }) {
  const statusClasses = {
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  }

  return (
    <tr className="border-t border-gray-100">
      <td className="px-2 py-2 text-gray-600">{feature}</td>
      <td className="px-2 py-2">
        <span className={`rounded px-2 py-1 ${statusClasses[statusColor]}`}>{status}</span>
      </td>
      <td className="px-2 py-2 text-gray-500">{trend}</td>
    </tr>
  )
}

function Dashboard() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("risk")
  const [patientsExpanded, setPatientsExpanded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedRiskAlert, setSelectedRiskAlert] = useState<HospitalRiskAlert | null>(null)
  const [addPatientOpen, setAddPatientOpen] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [highRiskAlerts, setHighRiskAlerts] = useState<HospitalRiskAlert[]>([])
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()

  // Fetch patients on mount
  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true)
      const data = await fetchPatientsFromSupabase()
      setPatients(data.length > 0 ? data : [])
      setLoading(false)
    }
    loadPatients()
  }, [])

  useEffect(() => {
    let active = true
    const loadHighRiskAlerts = async () => {
      try {
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
        const response = await fetch(`${apiUrl}/api/v1/readmissions/hospital/alerts`)
        if (!response.ok) throw new Error(`High-risk alert request failed (${response.status})`)
        const result = await response.json()
        if (active) setHighRiskAlerts(result.alerts || [])
      } catch (error) {
        console.warn('Could not load hospital high-risk alerts:', error)
      }
    }
    loadHighRiskAlerts()
    const interval = window.setInterval(loadHighRiskAlerts, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const totalPatients = patients.length
  const highRiskPatients = patients.filter(p => p.risk === "High").length
  const onTrackPatients = patients.filter(p => p.status === "On Track").length
  const unavailablePredictions = patients.filter(p => p.riskScore == null).length
  const activeAlerts = patients.reduce((total, p) => total + p.alerts, 0)

  const filteredPatients = patients.filter(p => {
    const search = searchTerm.toLowerCase().trim()
    if (!search) return true
    return p.name?.toLowerCase().includes(search) || p.id?.toLowerCase().includes(search)
  })

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return a.days - b.days
      case "medication":
        return b.medication - a.medication
      case "symptoms":
        const symptomOrder: { [key: string]: number } = { Worsening: 3, Stable: 2, Improving: 1 }
        return (symptomOrder[b.symptoms] || 0) - (symptomOrder[a.symptoms] || 0)
      case "risk":
      default:
        return (b.riskScore ?? -1) - (a.riskScore ?? -1)
    }
  })

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f6f2e8]">
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-56 flex-col bg-[#063b2f] px-3 py-4 text-white transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative mb-8 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f5ef]">
              <span className="text-xl">♥</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="absolute right-0 top-0 rounded-md p-1 text-gray-300 hover:bg-[#145542] hover:text-white">
            <X size={18} />
          </button>
        </div>

    <nav className="flex flex-col gap-2">

  {/* DASHBOARD */}
  <button
    onClick={() => {
      setPatientsExpanded(false)
      setSelectedPatient(null)
      setSidebarOpen(false)
      navigate("/")
    }}
    className="flex items-center gap-3 rounded-lg bg-[#2f725d] px-3 py-2.5 text-sm"
  >
    <Home size={17} />
    <span>Dashboard</span>
  </button>

  {/* PATIENTS */}
  <button
    onClick={() => {
      setPatientsExpanded(true)
      setSelectedPatient(null)
      setSidebarOpen(false)
    }}
    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:bg-[#145542]"
  >
    <Users size={17} />
    <span>Patients</span>
  </button>

  {/* REPORTS */}
  <button
    onClick={() => {
      setSidebarOpen(false)
      navigate("/reports")
    }}
    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:bg-[#145542]"
  >
    <FileText size={17} />
    <span>Reports</span>
  </button>

  {/* SETTINGS */}
  <button
    onClick={() => {
      setSidebarOpen(false)
      navigate("/settings")
    }}
    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:bg-[#145542]"
  >
    <SettingsIcon size={17} />
    <span>Settings</span>
  </button>

</nav>

        <div className="flex-1" />

        <button onClick={() => { signOutDemo(); navigate("/login", { replace: true }) }} className="flex items-center justify-center gap-2 text-gray-300 hover:text-white">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          onLogout={() => {
            setProfileOpen(false)
            signOutDemo()
            navigate("/login", { replace: true })
          }}
        />

        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading patients...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard title="Total Patients" value={totalPatients} icon={<Users size={30} />} color="green" />
                <StatCard title="High Risk" value={highRiskPatients} icon={<ShieldPlus size={30} />} color="red" />
                <StatCard title="On Track" value={onTrackPatients} icon="✓" color="green" />
                <StatCard title="Prediction unavailable" value={unavailablePredictions} icon={<Activity size={30} />} color="yellow" />
                <StatCard title="Active Alerts" value={activeAlerts} icon={<Bell size={30} />} color="green" />
              </div>

              {highRiskAlerts.length > 0 && (
                <section aria-label="High readmission risk alerts" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-red-800">
                    <Bell size={18} />
                    <h2 className="text-sm font-semibold">High readmission risk alerts</h2>
                    <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold">{highRiskAlerts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {highRiskAlerts.map(alert => {
                      const patientName = alert.patient?.name || alert.patient?.mrn || 'Patient'
                      const score = alert.prediction?.readmission_risk_pct
                      return (
                        <div key={alert.alert_id} className="flex flex-col gap-3 rounded-lg border border-red-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{patientName}{score != null ? ` · ${Number(score).toFixed(1)}% risk` : ''}</p>
                            <p className="mt-1 text-xs text-gray-600">{alert.description || 'Readmission risk requires review.'}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => setSelectedRiskAlert(alert)}
                              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
                            >
                              View details & report
                            </button>
                            <button
                              onClick={() => navigate(`/reports?patient_id=${encodeURIComponent(alert.patient_id)}`)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50"
                            >
                              Reports
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <div className={patientsExpanded ? "fixed inset-0 z-50 flex flex-col bg-white p-5" : "mt-4 rounded-lg border border-gray-200 bg-white shadow-sm"}>
                <div className="flex flex-col gap-3 border-b border-gray-200 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[17px] font-semibold text-gray-900">Patient Queue</h2>
                    <p className="mt-1 text-[12px] text-gray-500">All active post-discharge patients</p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <button
                      onClick={() => setAddPatientOpen(true)}
                      className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#08734f] px-4 text-[13px] font-medium text-white transition hover:bg-[#065d40]"
                    >
                      <Plus size={16} /> Add patient
                    </button>
                    <div className="relative w-full sm:w-[280px] lg:w-[300px]">
                      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search patients..."
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-[12px] font-medium text-gray-700 outline-none sm:w-[250px] sm:flex-none sm:px-4 sm:text-[13px]"
                    >
                      <option value="risk">Sort by: Risk</option>
                      <option value="recent">Sort by: Recent</option>
                      <option value="medication">Sort by: Medication</option>
                      <option value="symptoms">Sort by: Symptoms</option>
                    </select>

                    <button onClick={() => setPatientsExpanded(!patientsExpanded)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600">
                      {patientsExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                    </button>
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-[11px] text-gray-500 sm:text-xs lg:text-[13px]">
                        <th className="px-3 py-2">Patient</th>
                        <th className="px-3 py-2">Risk</th>
                        <th className="px-3 py-2">Alerts</th>
                        <th className="px-3 py-2">Days</th>
                        <th className="px-3 py-2">Last Call</th>
                        {patientsExpanded && (
                          <>
                            <th className="px-3 py-2">Medication</th>
                            <th className="px-3 py-2">Symptoms</th>
                          </>
                        )}
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPatients.map(patient => (
                        <tr key={patient.id} className="border-t border-gray-100 text-[13px] hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img src={patient.image} className="h-8 w-8 rounded-full" alt={patient.name} />
                              <div>
                                <p className="font-semibold text-gray-800">{patient.name}</p>
                                <p className="text-[10px] text-gray-500">ID: {patient.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3">
                            <span className={`rounded px-2 py-1 ${patient.risk === "High" ? "bg-red-50 text-red-600" : patient.risk === "Moderate" ? "bg-yellow-50 text-yellow-600" : patient.risk === "Low" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                              {patient.riskScore == null ? "N/A" : `${patient.risk} · ${patient.riskScore}%`}
                            </span>
                          </td>
                          <td className="px-3">{patient.alerts}</td>
                          <td className="px-3">{patient.days}d</td>
                          <td className="px-3">{patient.lastCall}</td>
                          {patientsExpanded && (
                            <>
                              <td className="px-3">{patient.medication}%</td>
                              <td className="px-3">{patient.symptoms}</td>
                            </>
                          )}
                          <td className="px-3">
                            <span className={`rounded px-2 py-1 ${patient.risk === "High" ? "bg-red-50 text-red-600" : patient.risk === "Moderate" ? "bg-yellow-50 text-yellow-600" : patient.risk === "Low" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                              {patient.status}
                            </span>
                          </td>
                          <td className="px-3">
                            <button onClick={() => navigate(`/patient/${patient.patient_uuid || patient.id}/overview`)} className="cursor-pointer rounded border border-green-200 px-3 py-1 text-green-700 hover:bg-green-50">
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedPatient && (
                <div className="fixed right-0 top-16 z-40 h-[calc(100vh-64px)] w-[390px] bg-white shadow-xl">
                  <PatientDetail patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
                </div>
              )}
              {selectedRiskAlert && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="High-risk patient and report">
                  <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                    <header className="flex items-start justify-between border-b border-gray-100 p-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">High readmission risk alert</p>
                        <h2 className="mt-1 text-xl font-semibold text-gray-900">{selectedRiskAlert.patient?.name || 'Patient details'}</h2>
                        <p className="mt-1 text-sm text-gray-500">{selectedRiskAlert.patient?.mrn ? `MRN ${selectedRiskAlert.patient.mrn} · ` : ''}Risk {selectedRiskAlert.prediction?.readmission_risk_pct != null ? `${Number(selectedRiskAlert.prediction.readmission_risk_pct).toFixed(1)}%` : '85% or higher'}</p>
                      </div>
                      <button onClick={() => setSelectedRiskAlert(null)} className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100" aria-label="Close alert details">Close</button>
                    </header>
                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      {[
                        ['Age', selectedRiskAlert.patient?.age],
                        ['Gender', selectedRiskAlert.patient?.gender],
                        ['Phone', selectedRiskAlert.patient?.phone_number],
                        ['Admission', selectedRiskAlert.patient?.admission_date],
                        ['Discharge', selectedRiskAlert.patient?.discharge_date],
                        ['Risk category', selectedRiskAlert.prediction?.risk_category],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="mt-1 text-sm font-medium text-gray-800">{value ? String(value) : 'Not recorded'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 pb-5">
                      <h3 className="text-sm font-semibold text-gray-900">Latest saved model report</h3>
                      <p className="mt-1 text-xs text-gray-500">{selectedRiskAlert.report?.created_at ? `Updated ${new Date(selectedRiskAlert.report.created_at).toLocaleString()}` : 'No structured report is attached.'}</p>
                      {selectedRiskAlert.report?.features && Object.keys(selectedRiskAlert.report.features).length > 0 ? (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full text-left text-sm">
                            <tbody>
                              {Object.entries(selectedRiskAlert.report.features).map(([key, value]) => (
                                <tr key={key} className="border-b last:border-0">
                                  <th className="px-3 py-2 font-medium text-gray-600">{key.replace(/_/g, ' ')}</th>
                                  <td className="px-3 py-2 text-gray-800">{value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Report feature details are unavailable.</p>}
                      <p className="mt-3 text-sm text-red-800">{selectedRiskAlert.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => navigate(`/patient/${selectedRiskAlert.patient_id}/overview`)} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900">Open full patient overview</button>
                        <button onClick={() => navigate(`/reports?patient_id=${encodeURIComponent(selectedRiskAlert.patient_id)}`)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Open reports</button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {addPatientOpen && (
                <AddPatientModal
                  onClose={() => setAddPatientOpen(false)}
                  onCreated={patient => {
                    setPatients(current => [patient, ...current])
                    setSearchTerm('')
                    setAddPatientOpen(false)
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: ReactNode; color: string }) {
  const colorClass = color === 'red' ? 'bg-red-50 text-red-600' : color === 'yellow' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-700'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[20px] font-semibold text-gray-600">{title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-semibold text-gray-800">{value}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${colorClass}`}>{icon}</div>
      </div>
    </div>
  )
}

function AppRoutes() {
  const [session, setSession] = useState<DemoUser | null>(() => getDemoUser())

  useEffect(() => {
    const refreshSession = () => setSession(getDemoUser())
    window.addEventListener('calle-demo-auth-change', refreshSession)
    window.addEventListener('storage', refreshSession)
    return () => {
      window.removeEventListener('calle-demo-auth-change', refreshSession)
      window.removeEventListener('storage', refreshSession)
    }
  }, [])

  return (
      <Routes>
        <Route path="/login" element={session ? <Navigate to={session.role === 'patient' ? `/patient/${session.patientId}/overview` : '/'} replace /> : <Login />} />
        <Route element={session ? <Outlet /> : <Navigate to="/login" replace />}>
          <Route path="/" element={session?.role === 'hospital' ? <Dashboard /> : <Navigate to={`/patient/${session?.patientId}/overview`} replace />} />
          <Route path="/reports" element={session?.role === 'hospital' ? <Reports /> : <Navigate to={`/patient/${session?.patientId}/overview`} replace />} />
          <Route path="/settings" element={session?.role === 'hospital' ? <SettingsPage /> : <Navigate to={`/patient/${session?.patientId}/overview`} replace />} />
          <Route path="/patient/:patientId" element={<PatientRoute session={session} />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="calls" element={<CallHistory />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="features" element={<Features />} />
          <Route path="care-plan" element={<CarePlan />} />
          <Route path="documents" element={<Documents />} />
          <Route path="medications" element={session?.role === 'patient' ? <Medications /> : <Navigate to="overview" replace />} />
          <Route path="chat" element={session?.role === 'patient' ? <PatientChat /> : <Navigate to="overview" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={!session ? "/login" : session.role === 'patient' ? `/patient/${session.patientId}/overview` : "/"} replace />} />
      </Routes>
  )
}

function PatientRoute({ session }: { session: DemoUser | null }) {
  const { patientId } = useParams()
  if (session?.role === 'patient' && session.patientId !== patientId) {
    return <Navigate to={`/patient/${session.patientId}/overview`} replace />
  }
  return session ? <PatientLayout /> : <Navigate to="/login" replace />
}

function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}

export default App
