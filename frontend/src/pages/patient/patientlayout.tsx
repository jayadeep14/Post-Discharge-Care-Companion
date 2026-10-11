import { Outlet, NavLink, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { getDemoUser, signOutDemo } from "../../lib/demoAuth";
import {
  ArrowLeft,
  LogOut,
  Activity,
  Bell,
  ClipboardList,
  FolderOpen,
  Pill,
  Phone,
  MessageCircle,
} from "lucide-react";

export default function PatientLayout() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const isPatient = getDemoUser()?.role === "patient";
  
  const [patientName, setPatientName] = useState<string>("Loading...");
  const [patientRisk, setPatientRisk] = useState<string>("Loading");

  useEffect(() => {
    async function fetchPatientDetails() {
      if (!patientId) return;
      const user = getDemoUser();
      if (user?.role === "patient" && user.patientId !== patientId) {
        navigate(`/patient/${user.patientId}/overview`, { replace: true });
        return;
      }

      try {
        const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
        const setModelRisk = async (uuid: string) => {
          const response = await fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(uuid)}`);
          if (!response.ok) throw new Error("Readmission prediction unavailable");
          const prediction = await response.json();
          setPatientRisk(prediction.available && prediction.risk_category
            ? `${prediction.risk_category} Risk${prediction.readmission_risk_pct == null ? "" : ` · ${Number(prediction.readmission_risk_pct).toFixed(2)}%`}`
            : "Prediction unavailable");
        };
        // Query matching either mrn (text) or matching exactly if it's a valid uuid, 
        // avoiding the ilike operator crash on uuid columns.
        let query = supabase.from('patients').select('*');
        
        // Check if patientId looks like a UUID or search by MRN
        if (patientId.length > 15) {
          query = query.eq('patient_id', patientId);
        } else {
          query = query.eq('mrn', patientId);
        }

        const { data, error } = await query.single();

        if (error || !data) {
          // Fallback: try fetching all and finding matching ID prefix if needed
          const { data: fallbackData } = await supabase.from('patients').select('*');
          const found = fallbackData?.find(p => 
            p.mrn === patientId || p.patient_id?.slice(0, 10) === patientId
          );

          if (found) {
            setPatientName(found.name || "Unknown Patient");
            await setModelRisk(found.patient_id);
          } else {
            setPatientName("Unknown Patient");
            setPatientRisk("N/A");
          }
          return;
        }

        setPatientName(data.name || "Unknown Patient");
        await setModelRisk(data.patient_id);
        
      } catch (err) {
        console.error("Unexpected error:", err);
        setPatientName("Unknown Patient");
        setPatientRisk("Prediction unavailable");
      }
    }

    fetchPatientDetails();
  }, [patientId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="group flex items-center text-gray-500 transition-colors hover:text-gray-700"
            title="Back"
          >
            <ArrowLeft size={19} strokeWidth={2.5} />
            <span className="ml-1 max-w-0 overflow-hidden whitespace-nowrap text-[9px] opacity-0 transition-all duration-200 group-hover:max-w-10 group-hover:opacity-100"> </span>
          </button>
          
          <div>
            <p className="text-xs text-gray-400 mb-1">
              Patient ID: {patientId}
            </p>

            <h1 className="text-2xl font-semibold text-gray-800">
              {patientName}
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Post-discharge monitoring
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              patientRisk.includes("High") ? "bg-red-50 text-red-600" : 
              patientRisk.includes("Moderate") ? "bg-yellow-50 text-yellow-600" : 
              patientRisk.includes("Low") ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-600"
            }`}>
              {patientRisk}
            </span>

            <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-sm">
              Monitoring Active
            </span>
            {isPatient && <button
              type="button"
              onClick={() => { signOutDemo(); navigate("/login", { replace: true }); }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut size={16} /> Log out
            </button>}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main className="px-8 py-6 pb-28">
        <Outlet />
      </main>

      <nav aria-label="Patient pages" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-start gap-1 overflow-x-auto sm:justify-center">
          {[
            { to: "overview", label: "Overview", Icon: Activity },
            ...(isPatient ? [
              { to: "medications", label: "Medications", Icon: Pill },
              { to: "chat", label: "Ask Gemini", Icon: MessageCircle },
            ] : []),
            { to: "calls", label: "Calls", Icon: Phone },
            { to: "alerts", label: "Alerts", Icon: Bell },
            { to: "care-plan", label: "Care plan", Icon: ClipboardList },
            { to: "documents", label: "Documents", Icon: FolderOpen },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} to={`/patient/${patientId}/${to}`} className={({ isActive }) => `flex min-w-[76px] flex-col items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-medium transition ${isActive ? "bg-emerald-50 text-emerald-800" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
