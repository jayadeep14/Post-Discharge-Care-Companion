import { useEffect, useState } from "react";
import {
  FileText,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";

export default function Reports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPatientId = searchParams.get("patient_id");
  const [patients, setPatients] = useState<Array<{ patient_id: string; mrn?: string; name: string; available: boolean; readmission_risk_pct?: number; risk_category?: string; missing_features?: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    fetch(`${apiUrl}/api/v1/readmissions/hospital`)
      .then(async response => {
        if (!response.ok) throw new Error("Could not load readmission scores");
        return response.json();
      })
      .then(result => setPatients(result.patients || []))
      .catch(error => setError(error instanceof Error ? error.message : "Could not load readmission scores"))
      .finally(() => setLoading(false));
  }, []);

  const visiblePatients = selectedPatientId
    ? patients.filter(patient => patient.patient_id === selectedPatientId)
    : patients;

  return (
    <div className="min-h-screen bg-[#f6f2e8]">

      {/* HEADER */}
      <div className="bg-[#064E3B] px-6 py-5 text-white">

        {/* BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-2 text-sm text-white transition hover:text-emerald-200"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-semibold">
          Reports
        </h1>

        <p className="mt-1 text-sm text-emerald-100">
          Patient monitoring and post-discharge reports
        </p>

      </div>

      {/* CONTENT */}
      <main className="p-6">

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{selectedPatientId ? "Patient readmission report" : "Readmission risk report"}</h2>
              <p className="mt-1 text-sm text-gray-500">Scores come from the packaged model and saved clinical feature rows.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">Decision support only</span>
          </div>
          {loading ? <p className="mt-5 text-sm text-gray-500">Loading patient scores…</p> : error ? <p role="alert" className="mt-5 text-sm text-red-600">{error}</p> : visiblePatients.length === 0 ? <p className="mt-5 text-sm text-gray-500">{selectedPatientId ? "No report is available for this patient." : "No patient records are available."}</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead><tr className="border-b text-xs text-gray-500"><th className="py-2 pr-4">Patient</th><th className="py-2 pr-4">MRN</th><th className="py-2 pr-4">Model score</th><th className="py-2 pr-4">Status</th><th className="py-2">Details</th></tr></thead>
                <tbody>{visiblePatients.map(patient => <tr key={patient.patient_id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium text-gray-800">{patient.name}</td>
                  <td className="py-3 pr-4 text-gray-600">{patient.mrn || "—"}</td>
                  <td className="py-3 pr-4">{patient.available ? `${patient.readmission_risk_pct?.toFixed(2)}%` : "Unavailable"}</td>
                  <td className="py-3 pr-4">{patient.available ? patient.risk_category : "Clinical model inputs missing"}</td>
                  <td className="py-3"><button onClick={() => navigate(`/patient/${patient.patient_id}/overview`)} className="font-medium text-emerald-800 hover:underline">Patient overview</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          {selectedPatientId && <button onClick={() => navigate("/reports")} className="mt-4 text-sm font-medium text-emerald-800 hover:underline">View all reports</button>}
          <p className="mt-3 text-xs text-gray-500">A score is shown only when the patient's saved structured feature data matches the model inputs.</p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* PATIENT REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Users size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Patient Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              View patient monitoring and recovery information.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

          {/* ALERT REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Alert Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Review patient alerts, risk levels and active issues.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

          {/* RECOVERY REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
              <TrendingUp size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Recovery Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Track recovery trends and post-discharge outcomes.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}
