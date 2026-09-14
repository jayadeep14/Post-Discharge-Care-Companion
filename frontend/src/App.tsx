 import { Routes, Route, Navigate } from "react-router-dom";
import PatientLayout from "./pages/patient/patientlayout";
import Overview from "./pages/patient/overview";
import CallHistory from "./pages/patient/CallHistory";
import Alerts from "./pages/patient/Alerts";
import Features from "./pages/patient/Features";
import CarePlan from "./pages/patient/CarePlan";
import Documents from "./pages/patient/Document";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

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
} from 'lucide-react'

// Initialize Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://oajkbjzhrtlicoxlmofg.supabase.co',
  import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hamtianpocnRsaWNveGxtb2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODY0OTgsImV4cCI6MjEwMjk2MjQ5OH0.qR4E8ANV3oO8pM_j2LXhz2T7sMSiV12tMgFVYWUE2b0'
)

interface Patient {
  name: string
  id: string
  image: string
  risk: "High" | "Moderate" | "Low"
  riskScore: number
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

// Fetch patients from Supabase
async function fetchPatientsFromSupabase(): Promise<Patient[]> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')

    if (error) throw error

    if (!data) return []

    // Map Supabase data to Patient format
    return data.map((p: any) => ({
      name: p.name || 'Unknown',
      id: p.mrn || p.patient_id?.slice(0, 10) || 'N/A',
      image: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 50)}`,
      risk: p.hospital_risk_score > 70 ? "High" : p.hospital_risk_score > 40 ? "Moderate" : "Low",
      riskScore: Math.round(p.hospital_risk_score || 50),
      alerts: Math.floor(Math.random() * 3),
      days: Math.floor(Math.random() * 14) + 1,
      lastCall: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: p.hospital_risk_score > 70 ? "High Risk" : p.hospital_risk_score > 40 ? "Moderate Risk" : "On Track",
      medication: 70 + Math.floor(Math.random() * 30),
      symptoms: ["Improving", "Stable", "Worsening"][Math.floor(Math.random() * 3)],
      phone_number: p.phone_number,
      age: p.age,
      diagnosis: p.diagnosis,
      admission_date: p.admission_date,
      discharge_date: p.discharge_date,
      hospital_risk_score: p.hospital_risk_score,
    }))
  } catch (error) {
    console.error('Error fetching patients:', error)
    return []
  }
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
  const riskColor = patient.risk === "High" ? "red" : patient.risk === "Moderate" ? "yellow" : "green"

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
              <span className={`rounded px-2 py-1 text-[9px] font-medium ${riskColor === 'red' ? 'bg-red-50 text-red-600' : riskColor === 'yellow' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-700'}`}>
                {patient.risk}
              </span>
              <span className="rounded bg-red-50 px-2 py-1 text-[9px] font-medium text-red-500">{patient.riskScore}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-gray-100">
        <InfoItem icon={<UserRound size={13} />} title="Age" value={patient.age?.toString() || 'N/A'} />
        <InfoItem icon={<Activity size={13} />} title="Diagnosis" value={patient.diagnosis || 'N/A'} />
        <InfoItem icon={<FileText size={13} />} title="Phone" value={patient.phone_number?.slice(-4) || 'N/A'} />
        <InfoItem icon={<UserRound size={13} />} title="Risk Score" value={`${patient.riskScore}%`} />
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
  const [patients, setPatients] = useState<Patient[]>([])
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

  const totalPatients = patients.length
  const highRiskPatients = patients.filter(p => p.risk === "High").length
  const onTrackPatients = patients.filter(p => p.status === "On Track").length
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
        return b.riskScore - a.riskScore
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

        <button onClick={() => navigate("/login")} className="flex items-center justify-center gap-2 text-gray-300 hover:text-white">
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
            navigate("/login")
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
                <StatCard title="Active Alerts" value={activeAlerts} icon={<Bell size={30} />} color="green" />
              </div>

              <div className={patientsExpanded ? "fixed inset-0 z-50 flex flex-col bg-white p-5" : "mt-4 rounded-lg border border-gray-200 bg-white shadow-sm"}>
                <div className="flex flex-col gap-3 border-b border-gray-200 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[17px] font-semibold text-gray-900">Patient Queue</h2>
                    <p className="mt-1 text-[12px] text-gray-500">All active post-discharge patients</p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
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
                            <span className={`rounded px-2 py-1 ${patient.risk === "High" ? "bg-red-50 text-red-600" : patient.risk === "Moderate" ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-700"}`}>
                              {patient.risk}
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
                            <span className={`rounded px-2 py-1 ${patient.risk === "High" ? "bg-red-50 text-red-600" : patient.risk === "Moderate" ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-700"}`}>
                              {patient.status}
                            </span>
                          </td>
                          <td className="px-3">
                            <button onClick={() => navigate(`/patient/${patient.id}/overview`)} className="cursor-pointer rounded border border-green-200 px-3 py-1 text-green-700 hover:bg-green-50">
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

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* DASHBOARD */}
        <Route path="/" element={<Dashboard />} />

        {/* REPORTS */}
        <Route path="/reports" element={<Reports />} />

        {/* SETTINGS */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* PATIENT */}
        <Route path="/patient/:patientId" element={<PatientLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="calls" element={<CallHistory />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="features" element={<Features />} />
          <Route path="care-plan" element={<CarePlan />} />
          <Route path="documents" element={<Documents />} />
        </Route>

        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App