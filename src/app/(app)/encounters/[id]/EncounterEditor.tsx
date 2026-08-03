"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/utils";
import RefSelect from "@/components/RefSelect";
import DictateButton from "@/components/DictateButton";

function appendText(prev: string, t: string) {
  return prev ? `${prev.trimEnd()} ${t}` : t;
}
function appendBlock(prev: string, block: string) {
  return prev ? `${prev.trimEnd()}\n${block}` : block;
}

const FEE_DEFAULTS: Record<string, number> = {
  "99213": 11500, "99214": 17500, "99215": 25000, "99203": 16000, "99204": 22000,
  "99202": 12000, "99205": 30000, "99211": 6500, "99212": 9000, "99396": 21000,
  "97110": 4500, "97140": 4500, "97530": 5000, "97010": 2500, "97035": 3500,
  "96372": 3800, "90471": 3000, "90472": 1800, "93000": 3500, "36415": 1200,
  "80053": 2200, "85025": 2500, "G0283": 3000, "99490": 6200, "99457": 5100,
};

// One-click Review of Systems favorites.
const ROS_FAVORITES: { label: string; text: string }[] = [
  { label: "All systems negative", text: "ROS: Complete 10-system review negative except as noted in HPI." },
  { label: "Constitutional", text: "Constitutional: Denies fever, chills, weight change, fatigue." },
  { label: "Cardiovascular", text: "CV: Denies chest pain, palpitations, edema, orthopnea." },
  { label: "Respiratory", text: "Resp: Denies cough, dyspnea, wheezing, hemoptysis." },
  { label: "GI", text: "GI: Denies nausea, vomiting, abdominal pain, diarrhea, constipation." },
  { label: "Musculoskeletal", text: "MSK: Reports pain as noted; denies swelling, weakness, new deformity." },
  { label: "Neuro", text: "Neuro: Denies headache, dizziness, numbness, focal weakness." },
];

// Physical exam normal-template quick inserts.
const EXAM_TEMPLATES: { label: string; text: string }[] = [
  { label: "General", text: "General: Alert, well-appearing, NAD." },
  { label: "HEENT", text: "HEENT: Normocephalic, atraumatic; PERRL; oropharynx clear." },
  { label: "Cardiac", text: "Cardiac: RRR, no murmurs/rubs/gallops." },
  { label: "Lungs", text: "Lungs: CTA bilaterally, no wheezes/rales/rhonchi." },
  { label: "Abdomen", text: "Abdomen: Soft, non-tender, non-distended, normoactive bowel sounds." },
  { label: "MSK / Back", text: "MSK: Paraspinal tenderness noted; ROM limited by pain; strength 5/5; SLR negative." },
  { label: "Skin", text: "Skin: Warm, dry, intact; no rashes or lesions." },
  { label: "Neuro", text: "Neuro: A&Ox3; CN II-XII grossly intact; sensation intact; gait steady." },
];

const QUALITY_MEASURES: { key: string; label: string }[] = [
  { key: "med_rec", label: "Medication reconciliation completed" },
  { key: "pt_education", label: "Patient education materials given" },
  { key: "tobacco", label: "Tobacco use screening & cessation counseling" },
  { key: "depression", label: "Depression screening (PHQ)" },
  { key: "fall_risk", label: "Fall-risk assessment" },
  { key: "bmi", label: "BMI screening & follow-up plan" },
  { key: "bp_control", label: "Blood pressure documented & addressed" },
  { key: "advance_care", label: "Advance care planning discussed" },
];

export default function EncounterEditor({ encounter }: { encounter: any }) {
  const router = useRouter();
  const patient = encounter.patient || {};
  const problems: any[] = patient.problems || [];
  const meds: any[] = patient.medications || [];
  const allergies: any[] = patient.allergies || [];
  const vitals: any[] = patient.vitals || [];
  const careTeam: any[] = patient.careTeam || [];

  const [chiefComplaint, setCC] = useState(encounter.chiefComplaint || "");
  const [subjective, setS] = useState(encounter.subjective || "");
  const [objective, setO] = useState(encounter.objective || "");
  const [assessment, setA] = useState(encounter.assessment || "");
  const [plan, setP] = useState(encounter.plan || "");
  const [ros, setROS] = useState(encounter.ros || "");
  const [exam, setExam] = useState(encounter.examFindings || "");
  const [familyHistory, setFamHx] = useState(encounter.familyHistory || "");
  const [socialHistory, setSocHx] = useState(encounter.socialHistory || "");
  const [quality, setQuality] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(encounter.qualityMeasures || "[]")); } catch { return new Set(); }
  });
  const [diagnoses, setDiagnoses] = useState<any[]>(encounter.diagnoses || []);
  const [charges, setCharges] = useState<any[]>(encounter.charges || []);
  const [saving, setSaving] = useState(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = useState<string>("");
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [signed, setSigned] = useState(encounter.status === "signed");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRx, setAiRx] = useState<any[]>([]);
  const [aiSafety, setAiSafety] = useState("");
  const [favorites, setFavorites] = useState<any[]>([]);

  // ---- My Dx List favorites ----
  useEffect(() => {
    fetch("/api/me/dx-favorites").then(r => r.ok ? r.json() : { favorites: [] }).then(d => setFavorites(d.favorites || [])).catch(() => {});
  }, []);
  async function saveFavorite(d: { icd10: string; description: string }) {
    const r = await fetch("/api/me/dx-favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
    if (r.ok) { const j = await r.json(); if (j.favorite && !favorites.some(f => f.icd10 === j.favorite.icd10)) setFavorites(prev => [j.favorite, ...prev]); }
  }
  async function removeFavorite(fav: any) {
    await fetch(`/api/me/dx-favorites?id=${fav.id}`, { method: "DELETE" });
    setFavorites(prev => prev.filter(f => f.id !== fav.id));
  }

  const buildPayload = useCallback((extra: Record<string, unknown> = {}) => ({
    chiefComplaint, subjective, objective, assessment, plan, ros, examFindings: exam,
    familyHistory, socialHistory, qualityMeasures: JSON.stringify(Array.from(quality)),
    diagnoses: diagnoses.map(d => ({ icd10: d.icd10, description: d.description, primary: !!d.primary })),
    charges: charges.map(c => ({ cpt: c.cpt, description: c.description, units: c.units || 1, modifier: c.modifier || null, feeCents: c.feeCents || 0 })),
    ...extra,
  }), [chiefComplaint, subjective, objective, assessment, plan, ros, exam, familyHistory, socialHistory, quality, diagnoses, charges]);

  // ---- Auto-save (debounced) ----
  const firstRender = useRef(true);
  useEffect(() => {
    if (signed) return;
    if (firstRender.current) { firstRender.current = false; return; }
    setAutoStatus("saving");
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/encounters/${encounter.id}`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        setAutoStatus("saved");
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch { setAutoStatus("idle"); }
    }, 2000);
    return () => clearTimeout(t);
  }, [buildPayload, signed, encounter.id]);

  async function generateSoap() {
    setAiLoading(true); setAiError("");
    try {
      const res = await fetch(`/api/encounters/${encounter.id}/ai-soap`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ instructions: aiInput, draft: { chiefComplaint, subjective, ros, objective, examFindings: exam, assessment, plan } }),
      });
      const json = await res.json();
      if (!res.ok) { setAiError(json.error || "Failed to generate the note."); return; }
      const s = json.soap || {};
      if (s.chiefComplaint) setCC(s.chiefComplaint);
      if (s.subjective) setS(s.subjective);
      if (s.ros) setROS(s.ros);
      if (s.objective) setO(s.objective);
      if (s.examFindings) setExam(s.examFindings);
      if (s.assessment) setA(s.assessment);
      if (s.plan) setP(s.plan);
      if (Array.isArray(json.diagnoses) && json.diagnoses.length) {
        setDiagnoses((prev) => {
          const seen = new Set(prev.map((d) => d.icd10));
          const merged = [...prev];
          let hasPrimary = prev.some((d) => d.primary);
          for (const d of json.diagnoses) {
            if (d.icd10 && seen.has(d.icd10)) continue;
            const makePrimary = d.primary && !hasPrimary;
            merged.push({ icd10: d.icd10 || d.description, description: d.description, primary: makePrimary });
            if (makePrimary) hasPrimary = true;
            if (d.icd10) seen.add(d.icd10);
          }
          if (!merged.some((d) => d.primary) && merged.length) merged[0].primary = true;
          return merged;
        });
      }
      if (Array.isArray(json.charges) && json.charges.length) {
        setCharges((prev) => {
          const seen = new Set(prev.map((c) => c.cpt));
          const merged = [...prev];
          for (const c of json.charges) {
            if (c.cpt && seen.has(c.cpt)) continue;
            merged.push({ cpt: c.cpt, description: c.description, units: 1, feeCents: c.feeSuggestedCents || 0, feeMinCents: c.feeMinCents, feeMaxCents: c.feeMaxCents, rationale: c.rationale, aiSuggested: true });
            if (c.cpt) seen.add(c.cpt);
          }
          return merged;
        });
      }
      setAiRx(Array.isArray(json.prescriptions) ? json.prescriptions : []);
      setAiSafety(json.safetyNotes || "");
    } catch (e) { console.error(e); setAiError("Network error. Please try again."); }
    finally { setAiLoading(false); }
  }

  function addRxToPlan() {
    if (!aiRx.length) return;
    const rxLines = aiRx.map((m) => `• ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.form ? ` ${m.form}` : ""}${m.sig ? ` — ${m.sig}` : ""}${m.route ? ` ${m.route}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`);
    setP(appendBlock(plan, `Prescriptions:\n${rxLines.join("\n")}`));
  }

  async function importPrevious() {
    setLoadingPrevious(true);
    try {
      const res = await fetch(`/api/encounters/${encounter.id}/previous`);
      if (res.ok) {
        const prev = await res.json();
        if (!chiefComplaint && prev.chiefComplaint) setCC(prev.chiefComplaint);
        if (!subjective && prev.subjective) setS(prev.subjective);
        if (!objective && prev.objective) setO(prev.objective);
        if (!assessment && prev.assessment) setA(prev.assessment);
        if (!plan && prev.plan) setP(prev.plan);
        if (!ros && prev.ros) setROS(prev.ros);
        if (!exam && prev.examFindings) setExam(prev.examFindings);
        if (!familyHistory && prev.familyHistory) setFamHx(prev.familyHistory);
        if (!socialHistory && prev.socialHistory) setSocHx(prev.socialHistory);
      } else { alert("No previous encounter found."); }
    } catch (e) { console.error(e); alert("Failed to import previous values."); }
    finally { setLoadingPrevious(false); }
  }

  // ---- Chart pull-forward ----
  function pullChartForward() {
    const lines: string[] = [];
    if (problems.length) lines.push(`Active problems: ${problems.map((p) => p.description).join("; ")}`);
    if (meds.length) lines.push(`Current medications: ${meds.map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}`).join("; ")}`);
    lines.push(`Allergies: ${allergies.length ? allergies.map((a) => a.substance || a.allergen || a.description || a.name).filter(Boolean).join("; ") : "NKDA"}`);
    if (familyHistory) lines.push(`Family history: ${familyHistory}`);
    if (socialHistory) lines.push(`Social history: ${socialHistory}`);
    setS(appendBlock(subjective, lines.join("\n")));
  }

  function insertVitals() {
    if (!vitals.length) return;
    const v = vitals[0];
    const parts = [
      v.systolic && v.diastolic ? `BP ${v.systolic}/${v.diastolic}` : null,
      v.pulse ? `HR ${v.pulse}` : null,
      v.temperatureC != null ? `T ${v.temperatureC}°C` : null,
      v.respRate ? `RR ${v.respRate}` : null,
      v.spo2 != null ? `SpO2 ${v.spo2}%` : null,
      v.weightKg != null ? `Wt ${v.weightKg}kg` : null,
      v.bmi != null ? `BMI ${v.bmi}` : null,
      v.painScore != null ? `Pain ${v.painScore}/10` : null,
    ].filter(Boolean);
    setO(appendBlock(objective, `Vitals: ${parts.join(", ")}`));
  }

  async function save(payload: Partial<{ signed: boolean }> = {}) {
    setSaving(true);
    const res = await fetch(`/api/encounters/${encounter.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload(payload)),
    });
    setSaving(false);
    if (res.ok) { setAutoStatus("saved"); setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
    if (payload.signed) setSigned(true);
    router.refresh();
  }

  function addDx(d: { icd10: string; description: string }) {
    if (diagnoses.some(x => x.icd10 === d.icd10)) return;
    setDiagnoses([...diagnoses, { ...d, primary: diagnoses.length === 0 }]);
  }
  function removeDx(i: number) { setDiagnoses(diagnoses.filter((_, idx) => idx !== i)); }
  function setPrimary(i: number) { setDiagnoses(diagnoses.map((d, idx) => ({ ...d, primary: idx === i }))); }
  function addCpt(c: { cpt: string; description: string; feeCents: number }) {
    if (charges.some(x => x.cpt === c.cpt)) return;
    setCharges([...charges, { ...c, units: 1 }]);
  }
  function removeCpt(i: number) { setCharges(charges.filter((_, idx) => idx !== i)); }
  function setUnits(i: number, u: number) { setCharges(charges.map((c, idx) => idx === i ? { ...c, units: u } : c)); }
  function setFee(i: number, dollars: number) { setCharges(charges.map((c, idx) => idx === i ? { ...c, feeCents: Math.round((dollars || 0) * 100) } : c)); }
  function toggleQuality(k: string) {
    setQuality(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  const total = charges.reduce((s, c) => s + (c.feeCents * (c.units || 1)), 0);
  const labImagingOrders = (encounter.orders || []).filter((o: any) => o.type === "lab" || o.type === "imaging");
  const orderHref = (type: string) => `/patients/${encounter.patientId}/orders/new?type=${type}&encounterId=${encounter.id}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* SOAP */}
      <div className="xl:col-span-2 space-y-3">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Clinical Notes</h2>
          <div className="flex items-center gap-3">
            {!signed && (
              <span className="text-[11px] text-slate-400">
                {autoStatus === "saving" ? "Auto-saving…" : autoStatus === "saved" ? `Auto-saved${savedAt ? ` · ${savedAt}` : ""}` : "Auto-save on"}
              </span>
            )}
            {!signed && (
              <button onClick={importPrevious} disabled={loadingPrevious} className="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md transition">
                {loadingPrevious ? "Importing..." : "↓ Import previous values"}
              </button>
            )}
          </div>
        </div>

        {/* Chart pull-forward panel */}
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Chart pull-forward</h3>
            {!signed && <button onClick={pullChartForward} className="text-xs font-semibold text-brand-600 hover:text-brand-800">Pull into Subjective →</button>}
          </div>
          <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2">
              <div className="font-semibold text-slate-600 mb-1">Active Problems ({problems.length})</div>
              {problems.length ? <ul className="space-y-0.5">{problems.slice(0, 6).map((p) => <li key={p.id} className="truncate">• {p.description}</li>)}</ul> : <span className="text-slate-400 italic">None</span>}
            </div>
            <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2">
              <div className="font-semibold text-slate-600 mb-1">Current Medications ({meds.length})</div>
              {meds.length ? <ul className="space-y-0.5">{meds.slice(0, 6).map((m) => <li key={m.id} className="truncate">• {m.name}{m.strength ? ` ${m.strength}` : ""}</li>)}</ul> : <span className="text-slate-400 italic">None</span>}
            </div>
            <div className="rounded-md bg-rose-50 ring-1 ring-rose-200 p-2">
              <div className="font-semibold text-rose-700 mb-1">Allergies ({allergies.length})</div>
              {allergies.length ? <ul className="space-y-0.5">{allergies.slice(0, 6).map((a) => <li key={a.id} className="truncate">• {a.substance || a.allergen || a.description || a.name}</li>)}</ul> : <span className="text-emerald-600">NKDA</span>}
            </div>
          </div>
        </div>

        {!signed && (
          <div className="card card-pad ring-1 ring-brand-200 bg-brand-50/40">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              <h3 className="text-sm font-semibold text-brand-800">AI SOAP Assistant</h3>
              <span className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px]">beta</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">Describe the visit in a few words. The assistant reads this patient&apos;s chart and drafts a compliant SOAP note with ICD-10 diagnoses, prescriptions and CPT codes. Fee ranges are <strong>estimates</strong> — verify before billing.</p>
            <textarea className="input text-[13px]" rows={3} value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="e.g., 45 y/o established patient, follow-up for low back pain, wants a refill and a PT referral" />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={generateSoap} disabled={aiLoading} className="btn-primary">{aiLoading ? "Generating…" : "Generate SOAP with AI"}</button>
              <DictateButton onText={(t) => setAiInput((p) => appendText(p, t))} disabled={aiLoading} />
              {aiError && <span className="text-xs text-rose-600">{aiError}</span>}
            </div>
            {aiSafety && <div className="mt-2 rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-[12px] text-amber-800"><strong>Safety note:</strong> {aiSafety}</div>}
            {aiRx.length > 0 && (
              <div className="mt-2 rounded-md bg-white ring-1 ring-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Suggested prescriptions ({aiRx.length})</span>
                  <button onClick={addRxToPlan} className="text-xs font-semibold text-brand-600 hover:text-brand-800">Add to Plan →</button>
                </div>
                <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600">{aiRx.map((m, i) => <li key={i}>• {m.name}{m.strength ? ` ${m.strength}` : ""}{m.form ? ` ${m.form}` : ""}{m.sig ? ` — ${m.sig}` : ""}</li>)}</ul>
                <p className="text-[10px] text-slate-400 mt-1">Review against allergies and confirm before prescribing.</p>
              </div>
            )}
          </div>
        )}

        {/* Subjective */}
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <label className="label">Chief Complaint</label>
            {!signed && <DictateButton onText={(t) => setCC((p) => appendText(p, t))} />}
          </div>
          <input className="input" value={chiefComplaint} onChange={e => setCC(e.target.value)} placeholder="e.g., Lower back pain x 2 weeks" disabled={signed} />
        </div>
        <SoapBlock title="Subjective (S)" hint="HPI, history, patient report" value={subjective} onChange={setS} disabled={signed} />
        <div className="grid sm:grid-cols-2 gap-3">
          <SoapBlock title="Family History" value={familyHistory} onChange={setFamHx} disabled={signed} rows={3} />
          <SoapBlock title="Social History" value={socialHistory} onChange={setSocHx} disabled={signed} rows={3} />
        </div>
        <div className="card card-pad">
          <div className="flex items-center justify-between gap-2">
            <label className="label">Review of Systems</label>
            {!signed && <DictateButton onText={(t) => setROS(appendText(ros, t))} />}
          </div>
          {!signed && (
            <div className="flex flex-wrap gap-1.5 my-2">
              {ROS_FAVORITES.map((r) => (
                <button key={r.label} type="button" onClick={() => setROS(appendBlock(ros, r.text))} className="chip bg-slate-100 hover:bg-brand-100 ring-slate-200 hover:ring-brand-200 text-slate-700 hover:text-brand-800 text-[11px]">+ {r.label}</button>
              ))}
            </div>
          )}
          <textarea className="input font-mono text-[13px] leading-relaxed" rows={3} value={ros} onChange={e => setROS(e.target.value)} disabled={signed} />
        </div>

        {/* Objective */}
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Vital signs flowsheet</h3>
            <div className="flex items-center gap-2">
              {!signed && vitals.length > 0 && <button onClick={insertVitals} className="text-xs font-semibold text-brand-600 hover:text-brand-800">Insert latest into Objective →</button>}
              <a href={`/patients/${encounter.patientId}/vitals`} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Record vitals</a>
            </div>
          </div>
          {vitals.length === 0 ? (
            <div className="text-xs text-slate-400 italic mt-2">No vitals recorded yet.</div>
          ) : (
            <div className="overflow-x-auto mt-2">
              <table className="data text-xs min-w-[560px]">
                <thead><tr><th>Date</th><th>BP</th><th>HR</th><th>Temp</th><th>RR</th><th>SpO2</th><th>Wt</th><th>BMI</th><th>Pain</th></tr></thead>
                <tbody>
                  {vitals.map((v) => (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">{new Date(v.takenAt).toLocaleDateString()}</td>
                      <td>{v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                      <td>{v.pulse ?? "—"}</td><td>{v.temperatureC != null ? `${v.temperatureC}°` : "—"}</td>
                      <td>{v.respRate ?? "—"}</td><td>{v.spo2 != null ? `${v.spo2}%` : "—"}</td>
                      <td>{v.weightKg != null ? `${v.weightKg}kg` : "—"}</td><td>{v.bmi ?? "—"}</td><td>{v.painScore != null ? `${v.painScore}/10` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <SoapBlock title="Objective (O)" hint="Vitals, exam, lab/imaging results" value={objective} onChange={setO} disabled={signed} />
        {labImagingOrders.length > 0 && !signed && (
          <div className="card card-pad">
            <div className="text-sm font-semibold text-slate-800 mb-2">Attach lab / imaging results</div>
            <div className="space-y-1.5">
              {labImagingOrders.map((o: any) => (
                <div key={o.id} className="flex items-center gap-2 text-xs">
                  <span className="chip bg-slate-100 text-slate-700 ring-slate-200 uppercase text-[10px]">{o.type}</span>
                  <span className="flex-1 truncate">{o.itemName} <span className="text-slate-400">({o.status})</span></span>
                  <button onClick={() => setO(appendBlock(objective, `${o.type.toUpperCase()} result — ${o.itemName}: [result pending review]`))} className="text-brand-600 hover:text-brand-800 font-semibold">Insert →</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="card card-pad">
          <div className="flex items-center justify-between gap-2">
            <label className="label">Physical Exam</label>
            {!signed && <DictateButton onText={(t) => setExam(appendText(exam, t))} />}
          </div>
          {!signed && (
            <div className="flex flex-wrap gap-1.5 my-2">
              {EXAM_TEMPLATES.map((r) => (
                <button key={r.label} type="button" onClick={() => setExam(appendBlock(exam, r.text))} className="chip bg-slate-100 hover:bg-brand-100 ring-slate-200 hover:ring-brand-200 text-slate-700 hover:text-brand-800 text-[11px]">+ {r.label}</button>
              ))}
            </div>
          )}
          <textarea className="input font-mono text-[13px] leading-relaxed" rows={4} value={exam} onChange={e => setExam(e.target.value)} disabled={signed} />
        </div>

        {/* Assessment & Plan */}
        <SoapBlock title="Assessment (A)" hint="Clinical reasoning" value={assessment} onChange={setA} disabled={signed} />
        <SoapBlock title="Plan (P)" value={plan} onChange={setP} disabled={signed} />

        {/* Quality measures */}
        <div className="card card-pad">
          <div className="text-sm font-semibold text-slate-800 mb-2">Quality measures</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {QUALITY_MEASURES.map((m) => (
              <label key={m.key} className={`flex items-center gap-2 text-sm rounded-md px-2 py-1.5 ring-1 ${quality.has(m.key) ? "bg-emerald-50 ring-emerald-200 text-emerald-800" : "bg-white ring-slate-200 text-slate-600"} ${signed ? "opacity-70" : "cursor-pointer"}`}>
                <input type="checkbox" checked={quality.has(m.key)} disabled={signed} onChange={() => toggleQuality(m.key)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="space-y-3">
        {/* Plan quick-actions */}
        <section className="card card-pad">
          <div className="text-sm font-semibold text-slate-800 mb-2">Plan actions</div>
          <div className="grid grid-cols-2 gap-2">
            <a href={orderHref("rx")} className="btn-secondary text-center text-xs">💊 e-Prescribe</a>
            <a href={orderHref("lab")} className="btn-secondary text-center text-xs">🧪 Order Lab</a>
            <a href={orderHref("imaging")} className="btn-secondary text-center text-xs">🩻 Order Imaging</a>
            <a href={orderHref("referral")} className="btn-secondary text-center text-xs">↗ eReferral</a>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Orders created here link back to this encounter automatically.</p>
        </section>

        {/* Diagnoses with My Dx List */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Diagnoses (ICD-10)</header>
          <div className="p-4 space-y-2">
            {diagnoses.length === 0 && <div className="text-sm text-slate-500 italic">No diagnoses linked yet.</div>}
            {diagnoses.map((d, i) => {
              const isFav = favorites.some((f) => f.icd10 === d.icd10);
              return (
                <div key={d.icd10 + i} className="flex items-center gap-2 text-sm">
                  <button type="button" disabled={signed} onClick={() => setPrimary(i)} title="Mark primary" className={`chip ${d.primary ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{d.primary ? "1°" : "—"}</button>
                  <span className="font-mono text-xs">{d.icd10}</span>
                  <span className="flex-1 truncate">{d.description}</span>
                  <button type="button" title={isFav ? "In My Dx List" : "Save to My Dx List"} onClick={() => isFav ? undefined : saveFavorite({ icd10: d.icd10, description: d.description })} className={`text-sm ${isFav ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}`}>★</button>
                  {!signed && <button onClick={() => removeDx(i)} className="text-rose-500 hover:text-rose-700 text-xs">remove</button>}
                </div>
              );
            })}
            {!signed && favorites.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">My Dx List</div>
                <div className="flex flex-wrap gap-1.5">
                  {favorites.slice(0, 12).map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1 chip bg-amber-50 text-amber-800 ring-amber-200 text-[11px]">
                      <button type="button" onClick={() => addDx({ icd10: f.icd10, description: f.description })} title="Add to encounter">{f.icd10 || f.description}</button>
                      <button type="button" onClick={() => removeFavorite(f)} className="text-amber-400 hover:text-rose-500" title="Remove favorite">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!signed && (
              <div>
                <span className="label mt-2">Add diagnosis</span>
                <RefSelect type="diagnosis" label="" name="_dx" showCode placeholder="Search ICD-10 or create new…"
                  onChange={({ code, display, item }) => { if (item) addDx({ icd10: code || display, description: display }); }} />
              </div>
            )}
          </div>
        </section>

        {/* Charges */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between">
            <span>Charges (CPT)</span><span className="text-sm font-bold text-brand-700">{fmtMoney(total)}</span>
          </header>
          <div className="p-4 space-y-2">
            {charges.length === 0 && <div className="text-sm text-slate-500 italic">No CPT codes yet.</div>}
            {charges.map((c, i) => (
              <div key={c.cpt + i} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{c.cpt}</span>
                  <span className="flex-1 truncate">{c.description}</span>
                  <input type="number" min="1" disabled={signed} value={c.units || 1} onChange={e => setUnits(i, Number(e.target.value) || 1)} className="w-12 text-center input py-0.5" title="Units" />
                  {signed ? (
                    <span className="text-xs text-slate-500 w-16 text-right">{fmtMoney(c.feeCents * (c.units || 1))}</span>
                  ) : (
                    <div className="flex items-center"><span className="text-xs text-slate-400">$</span><input type="number" min="0" step="0.01" value={((c.feeCents || 0) / 100).toString()} onChange={e => setFee(i, Number(e.target.value))} className="w-16 text-right input py-0.5" title="Fee (per unit)" /></div>
                  )}
                  {!signed && <button onClick={() => removeCpt(i)} className="text-rose-500 hover:text-rose-700 text-xs">×</button>}
                </div>
                {c.feeMinCents != null && <div className="pl-1 mt-0.5 text-[10px] text-amber-600">est. {fmtMoney(c.feeMinCents)}–{fmtMoney(c.feeMaxCents)} · AI estimate — verify{c.rationale ? ` · ${c.rationale}` : ""}</div>}
              </div>
            ))}
            {!signed && (
              <div>
                <span className="label mt-2">Add CPT / HCPCS code</span>
                <RefSelect type="billingCode" label="" name="_cpt" showCode placeholder="Search CPT/HCPCS or create new…"
                  onChange={({ code, display, item }) => { if (item) addCpt({ cpt: code || "", description: display, feeCents: FEE_DEFAULTS[code || ""] ?? 0 }); }} />
              </div>
            )}
          </div>
        </section>

        {/* Care team collaboration */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between">
            <span>Care Team & Referrals</span>
            <a href={`/patients/${encounter.patientId}`} className="text-xs font-semibold text-brand-700 hover:underline">Manage →</a>
          </header>
          <div className="p-4 space-y-2 text-sm">
            {careTeam.length === 0 ? (
              <div className="text-slate-500 italic">No care-team providers. Add one from the patient chart or send an eReferral.</div>
            ) : careTeam.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{m.name}{m.credential ? `, ${m.credential}` : ""}{m.role ? ` · ${m.role}` : ""}</span>
                {!signed && <button onClick={() => setP(appendBlock(plan, `Referral/coordination: ${m.name}${m.credential ? `, ${m.credential}` : ""}${m.specialty ? ` (${m.specialty})` : ""}${m.npi ? ` · NPI ${m.npi}` : ""}`))} className="text-xs text-brand-600 hover:text-brand-800 font-semibold shrink-0">Add to Plan</button>}
              </div>
            ))}
            <a href={orderHref("referral")} className="btn-secondary w-full">↗ New eReferral</a>
          </div>
        </section>

        {/* Linked Orders */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Linked Orders</header>
          <div className="p-4 space-y-2 text-sm">
            {(encounter.orders || []).length === 0 ? (
              <div className="text-slate-500 italic">No orders for this encounter.</div>
            ) : encounter.orders.map((o: any) => (
              <div key={o.id} className="flex items-center gap-2">
                <span className="chip bg-slate-100 text-slate-700 ring-slate-200 uppercase text-[10px]">{o.type}</span>
                <span className="flex-1 truncate">{o.itemName}{o.rxStrength ? ` ${o.rxStrength}` : ""}</span>
                <span className="text-xs text-slate-500">{o.status}</span>
              </div>
            ))}
            <a href={orderHref("rx")} className="btn-secondary w-full">+ Add Rx / Lab / Imaging</a>
          </div>
        </section>

        <div className="card card-pad flex items-center gap-2 sticky bottom-3">
          {!signed && <button onClick={() => save()} disabled={saving} className="btn-secondary flex-1">{saving ? "Saving…" : "Save Draft"}</button>}
          {!signed && <button onClick={() => save({ signed: true })} disabled={saving} className="btn-primary flex-1">🔒 Sign & Lock</button>}
          {signed && <div className="text-sm text-emerald-700 font-semibold">✓ Note signed and locked.</div>}
        </div>
      </div>
    </div>
  );
}

function SoapBlock({ title, hint, value, onChange, disabled, rows = 6 }: { title: string; hint?: string; value: string; onChange: (v: string) => void; disabled?: boolean; rows?: number }) {
  return (
    <section className="card card-pad">
      <div className="flex items-center justify-between gap-2">
        <label className="label">{title}</label>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[11px] text-slate-400 hidden sm:inline">{hint}</span>}
          {!disabled && <DictateButton onText={(t) => onChange(appendText(value, t))} />}
        </div>
      </div>
      <textarea className="input font-mono text-[13px] leading-relaxed" rows={rows} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />
    </section>
  );
}
