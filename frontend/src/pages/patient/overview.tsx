import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDemoUser } from "../../lib/demoAuth";
import { supabase } from "../../lib/supabase";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  HeartPulse,
  Pill,
  X,
  Edit2,
  Trash2,
  Eye,
} from "lucide-react";

interface OverviewData {
  riskScore: number | null;
  riskSource: string;
  riskCategory: string;
  daysSinceDischarge: number;
  activeAlertsCount: number;
  latestCallTime: string;
  medicationAdherence: string;
  painLevel: string;
  symptomsTrend: string;
  caregiverSupport: string;
  recommendedAction: string;
  recommendationDescription: string;
  medications: Array<{ id: string; name: string; dosage: string; frequency: string }>;
}

interface FollowUpScheduleItem {
  id: string;
  patient_id: string;
  reason: string | null;
  date_to_call: string | null;
  status: string | null;
  created_at: string | null;
}

interface CheckInItem {
  call_id?: string;
  id?: string;
  patient_id: string;
  call_date: string;
  notes?: string;
  description?: string;
  adherence_status?: string;
  pain_level?: string;
}

const FOLLOW_UP_OPTIONS = [
  "Routine Check-in",
  "Symptom Escalation Review",
  "Medication Review",
  "Post-Discharge Assessment",
  "General Consultation"
];

export default function Overview() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const isPatient = getDemoUser()?.role === "patient";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData>({
    riskScore: null,
    riskSource: "",
    riskCategory: "Loading...",
    daysSinceDischarge: 0,
    activeAlertsCount: 0,
    latestCallTime: "N/A",
    medicationAdherence: "N/A",
    painLevel: "N/A",
    symptomsTrend: "N/A",
    caregiverSupport: "N/A",
    recommendedAction: "No immediate action required",
    recommendationDescription: "Patient status is currently stable.",
    medications: [],
  });

  // Modal & Form States (Follow-ups)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("20:51");
  const [scheduleOption, setScheduleOption] = useState(FOLLOW_UP_OPTIONS[0]);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [followUps, setFollowUps] = useState<FollowUpScheduleItem[]>([]);

  // Modal & Form States (Check-ins)
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isCheckInViewOpen, setIsCheckInViewOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("20:51");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInPain, setCheckInPain] = useState("2 / 10");
  const [checkInFollowUpDays, setCheckInFollowUpDays] = useState("0"); // New state for auto follow-up interval
  const [checkIns, setCheckIns] = useState<CheckInItem[]>([]);
  
  // Edit States for Follow-ups
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("20:51");
  const [editOption, setEditOption] = useState(FOLLOW_UP_OPTIONS[0]);
  const [editNotesText, setEditNotesText] = useState("");

  const resolvePatientUuid = useCallback(async () => {
    if (!patientId) return null;
    let resolvedUuid = patientId;
    if (patientId.length <= 15) {
      const { data: pData } = await supabase
        .from('patients')
        .select('patient_id')
        .eq('mrn', patientId)
        .single();
      if (pData) resolvedUuid = pData.patient_id;
    }
    return resolvedUuid;
  }, [patientId]);

  const fetchFollowUps = useCallback(async () => {
    const resolvedUuid = await resolvePatientUuid();
    if (!resolvedUuid) return;

    const { data: followUpsData, error } = await supabase
      .from('follow_up_schedule')
      .select('*')
      .eq('patient_id', resolvedUuid)
      .order('date_to_call', { ascending: false });

    if (!error && followUpsData) {
      setFollowUps(followUpsData);
    }
  }, [resolvePatientUuid]);

  const fetchCheckIns = useCallback(async () => {
    const resolvedUuid = await resolvePatientUuid();
    if (!resolvedUuid) return;

    const { data: checkInsData, error } = await supabase
      .from('call_events')
      .select('*')
      .eq('patient_id', resolvedUuid)
      .order('call_date', { ascending: false });

    if (!error && checkInsData) {
      setCheckIns(checkInsData);
    }
  }, [resolvePatientUuid]);

  // Handle Check-in Submission with Auto Follow-Up
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedUuid = await resolvePatientUuid();
    if (!resolvedUuid) return;

    try {
      const callIsoDate = checkInDate 
        ? new Date(`${checkInDate}T${checkInTime}:00Z`).toISOString() 
        : new Date().toISOString();

      const insertPayload: Record<string, any> = {
        patient_id: resolvedUuid,
        call_date: callIsoDate,
      };

      const { error: callError } = await supabase.from('call_events').insert([insertPayload]);
      if (callError) throw callError;

      // Automatically schedule a follow-up if days > 0
      const daysNum = parseInt(checkInFollowUpDays, 10);
      if (daysNum > 0) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysNum);
        const dateStr = targetDate.toISOString().split('T')[0];
        // Scheduled between 10am - 6pm (defaulting to 10:00 AM)
        const isoDate = `${dateStr}T10:00:00Z`;

        await supabase.from('follow_up_schedule').insert([
          {
            patient_id: resolvedUuid,
            reason: `Type: Routine Check-in | Notes: Auto-scheduled (${daysNum} day(s) post check-in)`,
            date_to_call: isoDate,
            status: 'Scheduled',
            created_at: new Date().toISOString(),
          },
        ]);
      }

      alert(daysNum > 0 ? 'Check-in recorded and follow-up successfully scheduled!' : 'Check-in successfully recorded!');
      setIsCheckInOpen(false);
      setCheckInDate("");
      setCheckInTime("20:51");
      setCheckInNotes("");
      setCheckInPain("2 / 10");
      setCheckInFollowUpDays("0");
      fetchCheckIns();
      fetchFollowUps();
    } catch (err) {
      console.error('Error recording check-in:', err);
      alert('Failed to record check-in. Please try again.');
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedUuid = await resolvePatientUuid();
    if (!resolvedUuid) return;

    try {
      const reasonText = `Type: ${scheduleOption} | Notes: ${scheduleNotes || 'None'}`;
      const isoDate = scheduleDate ? new Date(`${scheduleDate}T${scheduleTime}:00Z`).toISOString() : null;

      const { error } = await supabase.from('follow_up_schedule').insert([
        {
          patient_id: resolvedUuid,
          reason: reasonText,
          date_to_call: isoDate,
          status: 'Scheduled',
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      alert('Follow-up successfully scheduled!');
      setIsScheduleOpen(false);
      setScheduleDate("");
      setScheduleTime("20:51");
      setScheduleOption(FOLLOW_UP_OPTIONS[0]);
      setScheduleNotes("");
      fetchFollowUps();
    } catch (err) {
      console.error('Error scheduling follow-up:', err);
      alert('Failed to schedule follow-up. Please try again.');
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!followUpId) {
      alert("Error: Missing follow-up identifier.");
      return;
    }
    if (!confirm("Are you sure you want to delete this follow-up?")) return;
    
    const { error } = await supabase.from('follow_up_schedule').delete().eq('id', followUpId);
    if (!error) {
      fetchFollowUps();
    } else {
      console.error("Delete error:", error);
      alert("Failed to delete follow-up.");
    }
  };

  const handleStartEdit = (item: FollowUpScheduleItem) => {
    setEditingId(item.id);
    
    const reasonStr = item.reason || "";
    const typeMatch = reasonStr.match(/Type: (.*?) \|/);
    const notesMatch = reasonStr.match(/Notes: (.*)/);

    if (typeMatch && FOLLOW_UP_OPTIONS.includes(typeMatch[1])) {
      setEditOption(typeMatch[1]);
    } else {
      setEditOption(FOLLOW_UP_OPTIONS[0]);
    }

    if (item.date_to_call) {
      const d = new Date(item.date_to_call);
      setEditDate(item.date_to_call.split('T')[0]);
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      setEditTime(`${hours}:${minutes}`);
    } else {
      setEditDate("");
      setEditTime("20:51");
    }

    if (notesMatch) {
      setEditNotesText(notesMatch[1] === 'None' ? '' : notesMatch[1]);
    } else {
      setEditNotesText(reasonStr);
    }
  };

  const handleUpdateFollowUp = async (followUpId: string) => {
    if (!followUpId) {
      alert("Error: Missing identifier for update.");
      return;
    }

    const reasonText = `Type: ${editOption} | Notes: ${editNotesText || 'None'}`;
    const isoDate = editDate ? new Date(`${editDate}T${editTime}:00Z`).toISOString() : null;

    const { error } = await supabase
      .from('follow_up_schedule')
      .update({ 
        reason: reasonText, 
        date_to_call: isoDate 
      })
      .eq('id', followUpId);

    if (!error) {
      setEditingId(null);
      setEditDate("");
      setEditTime("20:51");
      setEditOption(FOLLOW_UP_OPTIONS[0]);
      setEditNotesText("");
      fetchFollowUps();
    } else {
      console.error("Update error:", error);
      alert("Failed to update follow-up.");
    }
  };

  const formatDisplayDate = (dateToCall: string | null) => {
    if (!dateToCall) return "No Date Set";
    const d = new Date(dateToCall);
    return !isNaN(d.getTime()) 
      ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : dateToCall;
  };

  const formatDisplayType = (reason: string | null) => {
    if (!reason) return "Routine Follow-up";
    const match = reason.match(/Type: (.*?) \|/);
    return match ? match[1] : reason;
  };

  useEffect(() => {
    async function fetchOverviewData() {
      if (!patientId) return;
      setLoading(true);

      try {
        const resolvedUuid = await resolvePatientUuid();
        if (!resolvedUuid) return;

        let modelPrediction: { available?: boolean; readmission_risk_pct?: number; risk_category?: string } | null = null;
        try {
          const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
          const response = await fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(resolvedUuid)}`);
          if (response.ok) modelPrediction = await response.json();
        } catch (error) {
          console.warn("Could not load model readmission score", error);
        }

        const { data: patientRecord } = await supabase
          .from('patients')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .single();

        const { data: prediction } = await supabase
          .from('readmission_predictions')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .order('prediction_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: latestCall } = await supabase
          .from('call_events')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .order('call_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: alerts } = await supabase
          .from('call_alerts')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .eq('was_actioned', false);

        const { data: adherence } = await supabase
          .from('adherence_tracking')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: symptom } = await supabase
          .from('symptom_progression')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: caregiver } = await supabase
          .from('caregiver_support')
          .select('*')
          .eq('patient_id', resolvedUuid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: meds } = await supabase
          .from('medications_prescribed')
          .select('*')
          .eq('patient_id', resolvedUuid);

        let daysCalc = 0;
        if (patientRecord?.discharge_date) {
          const discharge = new Date(patientRecord.discharge_date);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - discharge.getTime());
          daysCalc = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const modelScore = modelPrediction?.available ? modelPrediction.readmission_risk_pct : null;
        const existingScore = prediction?.readmission_risk_pct ?? null;
        const riskScoreVal = modelScore ?? existingScore ?? null;
        const baseRiskCategory = modelPrediction?.available
          ? modelPrediction.risk_category || "Model score"
          : existingScore == null ? "No model prediction saved yet" : prediction?.risk_category || "Stored model prediction";
        const riskCatVal = baseRiskCategory;

        setData({
          riskScore: riskScoreVal == null ? null : Number(Number(riskScoreVal).toFixed(2)),
          riskSource: modelScore != null ? "Latest saved model prediction" : existingScore != null ? "Stored model prediction" : "No prediction available",
          riskCategory: riskCatVal,
          daysSinceDischarge: daysCalc,
          activeAlertsCount: alerts?.length || 0,
          latestCallTime: latestCall?.call_date ? new Date(latestCall.call_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
          medicationAdherence: adherence?.days_taken != null
            ? `Taken ${adherence.days_taken} ${adherence.days_taken === 1 ? "day" : "days"} this week`
            : adherence?.adherence_status === "taking_all" ? "Taking as prescribed" : adherence?.adherence_status || "Good",
          painLevel: symptom?.severity_score ? `${symptom.severity_score} / 10` : "N/A",
          symptomsTrend: symptom?.trend || symptom?.symptom_name || "Stable",
          caregiverSupport: caregiver?.has_caregiver ? "Available" : "Not Available",
          recommendedAction: alerts?.[0]?.recommended_action ? "Follow-up required" : "No immediate action required",
          recommendationDescription: alerts?.[0]?.description || "Patient vitals and post-discharge metrics are tracking stably.",
          medications: meds?.map(m => ({
            id: m.med_id,
            name: m.drug_name,
            dosage: m.dosage || 'Standard',
            frequency: m.frequency || 'As prescribed'
          })) || []
        });

        fetchFollowUps();
        fetchCheckIns();
      } catch (err) {
        console.error("Error fetching overview metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOverviewData();
  }, [patientId, resolvePatientUuid, fetchFollowUps, fetchCheckIns]);

  if (loading) {
    return <div className="py-10 text-center text-gray-500">Loading overview data...</div>;
  }

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Patient Overview
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Current health status and post-discharge monitoring summary
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Readmission Risk</p>
            <Activity size={20} className={(data.riskScore ?? 0) > 70 ? "text-red-500" : "text-amber-500"} />
          </div>
          <p className="text-2xl font-semibold text-gray-800 mt-3">{data.riskScore == null ? "N/A" : `${data.riskScore.toFixed(2)}%`}</p>
          <p className={`text-xs mt-1 ${(data.riskScore ?? 0) > 70 ? "text-red-500" : "text-amber-600"}`}>
            {data.riskCategory}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">{data.riskSource}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Days Since Discharge</p>
            <CalendarDays size={20} className="text-blue-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-800 mt-3">{data.daysSinceDischarge} days</p>
          <p className="text-xs text-gray-500 mt-1">Monitoring period</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Active Alerts</p>
            <AlertTriangle size={20} className={data.activeAlertsCount > 0 ? "text-red-500" : "text-green-500"} />
          </div>
          <p className="text-2xl font-semibold text-gray-800 mt-3">{data.activeAlertsCount}</p>
          <p className={`text-xs mt-1 ${data.activeAlertsCount > 0 ? "text-red-500" : "text-green-600"}`}>
            {data.activeAlertsCount > 0 ? "Requires attention" : "All clear"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Latest Check-in</p>
            <HeartPulse size={20} className="text-green-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-800 mt-3">{data.latestCallTime}</p>
          <p className="text-xs text-green-500 mt-1">Completed today</p>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: Latest Check-in Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800">Latest Check-in Summary</h3>
          <p className="text-xs text-gray-500 mt-1">Most recent phone log</p>

          <div className="mt-5 space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Medication adherence</span>
              <span className="text-sm font-medium text-green-600">{data.medicationAdherence}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Pain level</span>
              <span className="text-sm font-medium">{data.painLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Symptoms trend</span>
              <span className="text-sm font-medium text-orange-600">{data.symptomsTrend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Caregiver support</span>
              <span className="text-sm font-medium text-green-600">{data.caregiverSupport}</span>
            </div>
          </div>
        </div>

        {!isPatient && <>
        {/* Column 2: Check-in Management */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Check-in Management</h3>
              <CalendarDays size={20} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Record patient discharge/check-in status</p>

            <div className="mt-5 p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium text-gray-700">Total Check-ins:</span>
                <span className="text-green-600 font-medium">{checkIns.length} logged</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button 
              onClick={() => setIsCheckInOpen(true)}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
            >
              Check-in
            </button>
            <button 
              onClick={() => { fetchCheckIns(); setIsCheckInViewOpen(true); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              <Eye size={16} /> View ({checkIns.length})
            </button>
          </div>
        </div>

        {/* Column 3: Call / Follow-up Management */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Call Management</h3>
              <CalendarDays size={20} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Follow-ups</p>

            <div className="mt-5 p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium text-gray-700">Status:</span>
                <span className="text-green-600 font-medium">Recorded</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium text-gray-700">Scheduled:</span>
                <span>{followUps.length > 0 ? formatDisplayDate(followUps[0].date_to_call) : "None pending"}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button 
              onClick={() => setIsScheduleOpen(true)}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
            >
              Schedule Follow-up
            </button>
            <button 
              onClick={() => { fetchFollowUps(); setIsViewOpen(true); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              <Eye size={16} /> View ({followUps.length})
            </button>
          </div>
        </div>
        </>}
      </div>

      {isPatient && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="font-semibold text-emerald-950">Medication check-in</h3>
        <p className="mt-1 text-sm text-emerald-800">Record how many days you took each medicine this week.</p>
        <button type="button" onClick={() => navigate(`/patient/${patientId}/medications`)} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900">Record this week’s medicines</button>
      </div>}

      {/* Current Medication */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Pill size={20} className="text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-800">Current Medication</h3>
            <p className="text-xs text-gray-500">Active prescriptions from database</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {data.medications.length === 0 ? (
            <p className="py-3 text-xs text-gray-500">No active medications found for this patient.</p>
          ) : (
            data.medications.map((med) => (
              <div key={med.id} className="py-4 flex justify-between">
                <div>
                  <p className="text-sm font-medium">{med.name}</p>
                  <p className="text-xs text-gray-500">{med.dosage} · {med.frequency}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded">Active</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Check-in Modal */}
      {isCheckInOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Record Patient Check-in</h3>
              <button onClick={() => setIsCheckInOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pain Level</label>
                <select 
                  value={checkInPain} 
                  onChange={(e) => setCheckInPain(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="1 / 10">1 / 10 - Minimal</option>
                  <option value="2 / 10">2 / 10 - Mild</option>
                  <option value="4 / 10">4 / 10 - Moderate</option>
                  <option value="6 / 10">6 / 10 - Significant</option>
                  <option value="8 / 10">8 / 10 - Severe</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                  <input 
                    type="date" 
                    value={checkInDate} 
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Leave blank for today</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
                  <input 
                    type="time" 
                    value={checkInTime} 
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* New Follow-up Auto-Scheduling Interval Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Schedule Follow-up</label>
                <select 
                  value={checkInFollowUpDays} 
                  onChange={(e) => setCheckInFollowUpDays(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="0">0 - No follow-up</option>
                  <option value="1">1 - Next day (10:00 AM - 6:00 PM)</option>
                  <option value="2">2 - After 2 days</option>
                  <option value="3">3 - After 3 days</option>
                  <option value="4">4 - After 4 days</option>
                  <option value="5">5 - After 5 days</option>
                  <option value="6">6 - After 6 days</option>
                  <option value="7">7 - After 7 days (1 week)</option>
                  <option value="15">15 - After 15 days</option>
                  <option value="30">30 - After 30 days (1 month)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Notes</label>
                <textarea 
                  value={checkInNotes} 
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="Enter notes or updates regarding patient discharge/status..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCheckInOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Save & Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-in View Modal */}
      {isCheckInViewOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Check-in History</h3>
              <button onClick={() => setIsCheckInViewOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 divide-y divide-gray-100">
              {checkIns.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">No check-in logs found for this patient.</p>
              ) : (
                checkIns.map((item, idx) => (
                  <div key={item.call_id || item.id || idx} className="pt-3 first:pt-0">
                    <div className="flex justify-between items-start py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Check-in Record</p>
                        <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1 font-medium">
                          <CalendarDays size={14} />
                          <span>{formatDisplayDate(item.call_date)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium text-gray-700">Details:</span> {item.notes || item.description || 'Routine call log'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4 flex justify-end">
              <button 
                onClick={() => setIsCheckInViewOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Schedule Follow-up Call</h3>
              <button onClick={() => setIsScheduleOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Type</label>
                <select 
                  value={scheduleOption} 
                  onChange={(e) => setScheduleOption(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  {FOLLOW_UP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                  <input 
                    type="date" 
                    value={scheduleDate} 
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Time</label>
                  <input 
                    type="time" 
                    value={scheduleTime} 
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea 
                  value={scheduleNotes} 
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Enter reason or instructions for follow-up..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Enter / Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Follow-ups Modal */}
      {isViewOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Scheduled Follow-ups</h3>
              <button onClick={() => setIsViewOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 divide-y divide-gray-100">
              {followUps.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">No scheduled follow-ups found.</p>
              ) : (
                followUps.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0">
                    {editingId === item.id ? (
                      <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                          <select 
                            value={editOption}
                            onChange={(e) => setEditOption(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 text-xs bg-white"
                          >
                            {FOLLOW_UP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                            <input 
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full border border-gray-300 rounded p-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                            <input 
                              type="time"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full border border-gray-300 rounded p-1.5 text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                          <input 
                            type="text"
                            value={editNotesText}
                            onChange={(e) => setEditNotesText(e.target.value)}
                            className="w-full border border-gray-300 rounded p-1.5 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs border rounded bg-white text-gray-600">Cancel</button>
                          <button onClick={() => handleUpdateFollowUp(item.id)} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start py-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{formatDisplayType(item.reason)}</p>
                          <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1 font-medium">
                            <CalendarDays size={14} />
                            <span>{formatDisplayDate(item.date_to_call)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleStartEdit(item)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteFollowUp(item.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4 flex justify-end">
              <button 
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
