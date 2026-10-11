import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, Download, Eye, FileText, Pencil, Upload, X } from "lucide-react";

type LabFeatures = {
  time_in_hospital: number;
  n_lab_procedures: number;
  n_procedures: number;
  n_medications: number;
  n_outpatient: number;
  n_inpatient: number;
  n_emergency: number;
  age: string | number;
  medical_specialty: string;
  diag_1: string;
  diag_2: string;
  diag_3: string;
  glucose_test: string;
};

const documents = [
  { name: "Discharge Summary", type: "PDF", date: "May 24, 2026" },
  { name: "Prescription", type: "PDF", date: "May 24, 2026" },
  { name: "Lab Results", type: "Structured report", date: "Add or upload patient data" },
  { name: "Follow-up Report", type: "PDF", date: "May 28, 2026" },
];

const numericFields: Array<keyof LabFeatures> = [
  "time_in_hospital", "n_lab_procedures", "n_procedures", "n_medications",
  "n_outpatient", "n_inpatient", "n_emergency",
];
const diagnosisOptions = ["Circulatory", "Diabetes", "Digestive", "Injury", "Missing", "Musculoskeletal", "Other", "Respiratory"];
const ageOptions = ["[40-50)", "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"];
const specialtyOptions = ["Cardiology", "Emergency/Trauma", "Family/GeneralPractice", "InternalMedicine", "Missing", "Other", "Surgery"];
function makeEmptyLab(): LabFeatures {
  return {
    time_in_hospital: 0,
    n_lab_procedures: 0,
    n_procedures: 0,
    n_medications: 0,
    n_outpatient: 0,
    n_inpatient: 0,
    n_emergency: 0,
    age: "",
    medical_specialty: "",
    diag_1: "",
    diag_2: "",
    diag_3: "",
    glucose_test: "",
  };
}

function parseLabFile(text: string, fileName: string): LabFeatures {
  let row: Record<string, unknown>;
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    row = Array.isArray(parsed) ? parsed[0] : parsed;
  } else {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error("CSV must contain a header and one data row.");
    const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(value => value.trim().replace(/^"|"$/g, ""));
    const headers = split(lines[0]);
    const values = split(lines[1]);
    row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  }
  if (!row || typeof row !== "object") throw new Error("The file must contain one feature record.");
  const candidate = { ...row } as Record<string, unknown>;
  // Support the category names from the user's sample script as aliases.
  candidate.diag_1 ??= candidate.primary_diagnosis;
  candidate.diag_2 ??= candidate.sec_diagnosis;
  candidate.diag_3 ??= candidate.additional_sec_diag;
  candidate.age ??= candidate.age_cat;
  const required = ["time_in_hospital", "n_lab_procedures", "n_procedures", "n_medications", "n_outpatient", "n_inpatient", "n_emergency", "age", "medical_specialty", "diag_1", "diag_2", "diag_3", "glucose_test"] as const;
  const missing = required.filter(field => candidate[field] === undefined || candidate[field] === null || candidate[field] === "");
  if (missing.length) throw new Error(`Missing required model fields: ${missing.join(", ")}`);
  const ageIsStoredYears = Number.isFinite(Number(candidate.age)) && Number(candidate.age) > 0;
  if (!ageOptions.includes(String(candidate.age)) && !ageIsStoredYears) throw new Error(`age must be a model age band or a patient's age in years from the database.`);
  if (ageIsStoredYears) candidate.age = Number(candidate.age);
  if (!specialtyOptions.includes(String(candidate.medical_specialty))) throw new Error(`medical_specialty must be one of: ${specialtyOptions.join(", ")}.`);
  for (const field of ["diag_1", "diag_2", "diag_3"] as const) {
    if (!diagnosisOptions.includes(String(candidate[field]))) throw new Error(`${field} must be one of: ${diagnosisOptions.join(", ")}.`);
  }
  if (!["high", "no", "normal"].includes(String(candidate.glucose_test))) throw new Error("glucose_test must be high, no, or normal.");
  for (const field of numericFields) {
    const value = Number(candidate[field]);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number.`);
    candidate[field] = value;
  }
  return candidate as LabFeatures;
}

export default function Documents() {
  const { patientId = "" } = useParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [lab, setLab] = useState<LabFeatures | null>(null);
  const [source, setSource] = useState<"manual" | "upload">("manual");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [runningModel, setRunningModel] = useState(false);
  const [modelResult, setModelResult] = useState<{ available: boolean; readmission_risk_pct?: number; risk_category?: string; missing_features?: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) return;
    setLab(null);
    setSource("manual");
    setPreviewOpen(false);
    setEditing(false);
    setModelResult(null);
    setMessage("");
    setError("");
    const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(patientId)}/lab-report`)
      .then(async response => {
        if (!response.ok) throw new Error("Could not load this patient's saved lab report");
        return response.json();
      })
      .then(result => {
        if (result.report) {
          setLab(result.report.features);
          setSource(result.report.source === "upload" ? "upload" : "manual");
        }
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "Could not load saved lab data"));
    fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(patientId)}`)
      .then(async response => response.ok ? response.json() : null)
      .then(result => { if (result?.available) setModelResult(result); })
      .catch(() => undefined);
  }, [patientId]);

  async function saveLab(features: LabFeatures, nextSource = source, fileName?: string) {
    setError("");
    setMessage("Saving lab data and running the model…");
    setRunningModel(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const response = await fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(patientId)}/lab-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features, source: nextSource, file_name: fileName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Could not save lab report and prediction");
      setLab(result.report.features);
      setSource(nextSource);
      setModelResult(result.prediction);
      setMessage("Lab report and prediction saved for this patient.");
    } catch (saveError) {
      setModelResult(null);
      setError(saveError instanceof Error ? saveError.message : "Could not save lab report and prediction");
      setMessage("");
    } finally {
      setRunningModel(false);
    }
  }

  function updateField(field: keyof LabFeatures, value: string) {
    if (!lab) return;
    const next = { ...lab, [field]: numericFields.includes(field) ? Number(value) : value } as LabFeatures;
    setLab(next);
  }

  function downloadLabCsv() {
    if (!lab) return;
    const content = `${Object.keys(lab).join(",")}\n${Object.values(lab).join(",")}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `lab-features-${patientId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadLabFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const parsed = parseLabFile(await file.text(), file.name);
      await saveLab(parsed, "upload", file.name);
      setPreviewOpen(true);
      setEditing(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read this lab feature file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function runReadmissionModel() {
    if (!lab || runningModel) return;
    setRunningModel(true);
    setError("");
    setMessage("");
    setModelResult(null);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const response = await fetch(`${apiUrl}/api/v1/readmissions/patient/${encodeURIComponent(patientId)}/run`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Could not run the readmission model");
      setModelResult(result);
      if (result.available) setMessage("Prediction refreshed from the patient's saved lab report.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not run the readmission model");
    } finally {
      setRunningModel(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
        <p className="mt-1 text-sm text-gray-500">Patient medical and discharge documents</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4"><h3 className="font-semibold text-gray-800">Patient Documents</h3></div>
        <div className="divide-y divide-gray-100">
          {documents.map(document => <div key={document.name} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100"><FileText size={19} className="text-gray-600" /></div>
              <div><p className="text-sm font-medium text-gray-800">{document.name}</p><p className="mt-1 text-xs text-gray-500">{document.type} · {document.date}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {document.name === "Lab Results" && <>
                <button type="button" onClick={() => { setEditing(false); setPreviewOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"><Eye size={15} />Preview</button>
                {!lab && <button type="button" onClick={() => { setLab(makeEmptyLab()); setSource("manual"); setEditing(true); setPreviewOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"><Pencil size={15} />Add lab data</button>}
                {lab && <button type="button" onClick={() => { setEditing(value => !value); setPreviewOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"><Pencil size={15} />Edit</button>}
                <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"><Upload size={15} />Upload CSV/JSON</button>
                <input ref={fileInput} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={event => void uploadLabFile(event.target.files?.[0])} />
                {lab && <button type="button" onClick={() => void runReadmissionModel()} disabled={runningModel} className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-900 disabled:opacity-60"><Activity size={15} />{runningModel ? "Running…" : "Run model"}</button>}
              </>}
              {document.name !== "Lab Results" && <>
                <button type="button" aria-label={`Preview ${document.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Eye size={17} /></button>
                <button type="button" aria-label={`Download ${document.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Download size={17} /></button>
              </>}
            </div>
          </div>)}
        </div>
      </div>

      {previewOpen && <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h3 className="font-semibold text-gray-800">Lab results · {source === "upload" ? "uploaded data" : "entered data"}</h3><p className="mt-1 text-xs text-gray-500">Saved in the database for patient {patientId}.</p></div>
          {lab && <button type="button" onClick={downloadLabCsv} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">Download CSV</button>}
          <button type="button" aria-label="Close lab preview" onClick={() => { setPreviewOpen(false); setEditing(false); }} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={17} /></button>
        </div>
        {!lab ? <p className="text-sm text-gray-600">No lab data has been added for this patient. Enter values or upload a structured CSV/JSON file to run the model.</p> : editing ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {numericFields.map(field => <label key={field} className="text-xs font-medium text-gray-600">{field.replaceAll("_", " ")}<input type="number" min="0" value={lab[field]} onChange={event => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>)}
          {typeof lab.age === "number"
            ? <label className="text-xs font-medium text-gray-600">Patient age from database<input type="number" value={lab.age} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm" /></label>
            : <label className="text-xs font-medium text-gray-600">Age band<select value={lab.age} onChange={event => updateField("age", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Select age band</option>{ageOptions.map(value => <option key={value}>{value}</option>)}</select></label>}
          <label className="text-xs font-medium text-gray-600">Medical specialty<select value={lab.medical_specialty} onChange={event => updateField("medical_specialty", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Select specialty</option>{specialtyOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          {(["diag_1", "diag_2", "diag_3"] as const).map(field => <label key={field} className="text-xs font-medium text-gray-600">{field.toUpperCase()} category<select value={lab[field]} onChange={event => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Select category</option>{diagnosisOptions.map(value => <option key={value}>{value}</option>)}</select></label>)}
          <label className="text-xs font-medium text-gray-600">Glucose test<select value={lab.glucose_test} onChange={event => updateField("glucose_test", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Select result</option>{["high", "no", "normal"].map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="flex items-end gap-2"><button type="button" onClick={() => { void saveLab(lab, source); setEditing(false); }} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white hover:bg-emerald-900">Save and run model</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-700">Cancel</button></div>
        </div> : <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(lab).map(([key, value]) => <div key={key} className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{key.replaceAll("_", " ")}</dt><dd className="mt-1 text-sm font-medium text-gray-800">{value ?? "Missing"}</dd></div>)}</dl>
        </>}
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Only patient-entered or uploaded structured values are scored. Upload accepts one CSV or JSON row matching the model fields; PDF extraction is not enabled.</p>
      </section>}

      {(modelResult || message || error) && <section aria-live="polite" className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-800">Lab report model result</h3>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        {modelResult?.available && <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="text-2xl font-semibold text-gray-900">{modelResult.readmission_risk_pct?.toFixed(2)}%</p><p className="text-sm text-gray-600">{modelResult.risk_category} readmission risk</p></div>}
        {modelResult && !modelResult.available && <p className="mt-2 text-sm text-gray-600">Missing model inputs: {modelResult.missing_features?.join(", ") || "required feature values"}.</p>}
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        {modelResult?.available && <p className="mt-3 text-xs text-gray-500">Decision support only. The saved prediction is shown on this patient’s Overview page.</p>}
      </section>}
    </div>
  );
}
