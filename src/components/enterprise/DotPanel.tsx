"use client";

import React, { useCallback, useEffect, useState } from "react";
import { HEALTH_HISTORY, PHYSICAL_SYSTEMS, RESTRICTION_OPTIONS, CERT_DURATIONS } from "@/lib/dot/forms";

type Exam = any;

const OUTCOME_LABEL: Record<string, string> = {
  pending: "Pending",
  qualified: "Qualified",
  qualified_with_restrictions: "Qualified w/ restrictions",
  not_qualified: "Not qualified",
  incomplete: "Incomplete",
};
const STATUS_LABEL: Record<string, string> = {
  driver_pending: "Awaiting driver history",
  exam_pending: "Awaiting examiner",
  completed: "Completed",
};

function outcomeColor(o: string) {
  if (o === "qualified") return "bg-emerald-100 text-emerald-800";
  if (o === "qualified_with_restrictions") return "bg-amber-100 text-amber-800";
  if (o === "not_qualified") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}
function expiryInfo(expiresOn?: string | null) {
  if (!expiresOn) return null;
  const d = new Date(expiresOn);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  let cls = "text-slate-600";
  if (days < 0) cls = "text-rose-600 font-semibold";
  else if (days <= 30) cls = "text-amber-600 font-semibold";
  return { text: d.toLocaleDateString(), days, cls };
}

export default function DotPanel({ isSuper, companyId }: { isSuper: boolean; companyId: string }) {
  const entParam = isSuper && companyId ? `?enterpriseId=${encodeURIComponent(companyId)}` : "";
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Exam | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    if (isSuper && !companyId) { setExams([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/enterprise/dot/exams${entParam}`);
      const d = await r.json();
      setExams(d.exams || []);
    } finally { setLoading(false); }
  }, [entParam, isSuper, companyId]);
  useEffect(() => { load(); }, [load]);

  // ---- New exam ------------------------------------------------------------
  const [showNew, setShowNew] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newEmp, setNewEmp] = useState("");
  const [dotReason, setDotReason] = useState("Certification");
  const [carrierQ, setCarrierQ] = useState({ type: "dot", value: "" });
  const [carrier, setCarrier] = useState<any>(null);
  const [carrierMsg, setCarrierMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openNew = async () => {
    setShowNew(true); setCarrier(null); setCarrierMsg(null); setNewEmp("");
    const r = await fetch(`/api/enterprise/employees${entParam}`);
    const d = await r.json();
    setEmployees(d.employees || []);
  };
  const carrierLookup = async () => {
    setCarrierMsg("Searching FMCSA…"); setCarrier(null);
    const q = carrierQ.type === "dot" ? `dot=${encodeURIComponent(carrierQ.value)}` : `mc=${encodeURIComponent(carrierQ.value)}`;
    const r = await fetch(`/api/enterprise/dot/carrier-lookup?${q}`);
    const d = await r.json();
    if (r.ok) { setCarrier(d.carrier); setCarrierMsg(null); }
    else { setCarrierMsg(d.error || "Lookup failed"); }
  };
  const createExam = async () => {
    if (!newEmp) return;
    setCreating(true);
    try {
      const body: any = { employeeId: newEmp, dotReason, carrier: carrier || undefined };
      if (isSuper && companyId) body.enterpriseId = companyId;
      const r = await fetch("/api/enterprise/dot/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { setShowNew(false); await load(); setDetail(d.exam); flash("DOT exam created. Share the driver kiosk link to collect the health history."); }
      else flash(d.error || "Failed to create");
    } finally { setCreating(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">DOT / FMCSA Physicals</h3>
          <p className="text-sm text-slate-500">Commercial driver medical exams — MCSA-5875 report &amp; MCSA-5876 medical card.</p>
        </div>
        <button onClick={openNew} className="btn-primary" disabled={isSuper && !companyId}>+ New DOT exam</button>
      </div>

      {isSuper && !companyId && <div className="rounded-lg bg-amber-50 text-amber-800 text-sm p-3">Select a company above to manage DOT exams.</div>}

      {loading ? <div className="text-sm text-slate-500">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="text-left px-3 py-2">Driver</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Outcome</th><th className="text-left px-3 py-2">Expires</th><th className="text-left px-3 py-2">FMCSA</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {exams.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No DOT exams yet.</td></tr>}
              {exams.map((e) => {
                const exp = expiryInfo(e.expiresOn);
                return (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{e.driverName}</td>
                    <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[e.status] || e.status}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${outcomeColor(e.outcome)}`}>{OUTCOME_LABEL[e.outcome] || e.outcome}</span></td>
                    <td className={`px-3 py-2 ${exp?.cls || "text-slate-400"}`}>{exp ? `${exp.text}${exp.days < 0 ? " (expired)" : exp.days <= 30 ? ` (${exp.days}d)` : ""}` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{e.transmissionStatus === "exported" ? "Exported" : e.transmissionStatus === "ready" ? "Ready" : "—"}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setDetail(e)} className="text-brand-600 hover:underline">Open</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm shadow-lg">{toast}</div>}

      {/* New exam modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" onClick={(ev) => ev.stopPropagation()}>
            <h4 className="font-bold text-slate-900 mb-3">New DOT exam</h4>
            <label className="block text-xs font-medium text-slate-600 mb-1">Driver (employee)</label>
            <select value={newEmp} onChange={(e) => setNewEmp(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-3">
              <option value="">Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}{emp.jobTitle ? ` — ${emp.jobTitle}` : ""}</option>)}
            </select>
            <label className="block text-xs font-medium text-slate-600 mb-1">Exam reason</label>
            <select value={dotReason} onChange={(e) => setDotReason(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-3">
              {["Certification", "Recertification", "New employment", "Return to duty", "Follow-up"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <div className="rounded-lg bg-slate-50 p-3 mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">Carrier lookup (FMCSA QCMobile — optional)</div>
              <div className="flex gap-2">
                <select value={carrierQ.type} onChange={(e) => setCarrierQ({ ...carrierQ, type: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"><option value="dot">USDOT#</option><option value="mc">MC#</option></select>
                <input value={carrierQ.value} onChange={(e) => setCarrierQ({ ...carrierQ, value: e.target.value })} placeholder="number" className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                <button onClick={carrierLookup} className="btn-secondary py-1.5 px-3 text-sm">Search</button>
              </div>
              {carrierMsg && <div className="text-xs text-slate-500 mt-1">{carrierMsg}</div>}
              {carrier && <div className="text-xs text-slate-700 mt-2">✓ {carrier.legalName} — USDOT {carrier.dotNumber} — {carrier.phyCity}, {carrier.phyState}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <button onClick={createExam} disabled={!newEmp || creating} className="btn-primary disabled:opacity-60">{creating ? "Creating…" : "Create exam"}</button>
            </div>
          </div>
        </div>
      )}

      {detail && <ExamDrawer exam={detail} onClose={() => setDetail(null)} onSaved={(e) => { setDetail(e); load(); flash("Saved."); }} />}
    </div>
  );
}

function ExamDrawer({ exam: initial, onClose, onSaved }: { exam: Exam; onClose: () => void; onSaved: (e: Exam) => void }) {
  const [exam, setExam] = useState<Exam>(initial);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<number | null>(null);
  const kioskUrl = exam.kioskToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/enterprise/dot/kiosk/${exam.kioskToken}` : null;

  // Local editable state
  const v = exam.vitals || {}, vis = exam.vision || {}, he = exam.hearing || {}, ur = exam.urinalysis || {};
  const pe = exam.physicalExam || {};
  const flags = exam.determinationFlags || {};
  const restr: string[] = exam.restrictions || [];

  const setField = (path: string, key: string, value: any) => {
    setExam((prev: any) => ({ ...prev, [path]: { ...(prev[path] || {}), [key]: value } }));
  };
  const toggleRestr = (k: string) => setExam((p: any) => ({ ...p, restrictions: (p.restrictions || []).includes(k) ? p.restrictions.filter((x: string) => x !== k) : [ ...(p.restrictions || []), k ] }));
  const setFlag = (k: string) => setExam((p: any) => ({ ...p, determinationFlags: { ...(p.determinationFlags || {}), [k]: !(p.determinationFlags || {})[k] } }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        vitals: exam.vitals, vision: exam.vision, hearing: exam.hearing, urinalysis: exam.urinalysis, physicalExam: exam.physicalExam,
        certMonths: exam.certMonths ? Number(exam.certMonths) : undefined,
        restrictions: exam.restrictions, determinationFlags: exam.determinationFlags,
        examinerName: exam.examinerName, examinerNrcme: exam.examinerNrcme, examinerLicense: exam.examinerLicense, examinerLicenseState: exam.examinerLicenseState, examinerSignature: exam.examinerSignature,
        examDate: exam.examDate || new Date().toISOString(),
      };
      const r = await fetch(`/api/enterprise/dot/exams/${exam.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { setExam(d.exam); setSuggested(d.suggestedCertMonths ?? null); onSaved(d.exam); }
    } finally { setSaving(false); }
  };
  const transmit = async () => {
    const r = await fetch(`/api/enterprise/dot/exams/${exam.id}/transmit`, { method: "POST" });
    const d = await r.json();
    if (r.ok) { setExam((p: any) => ({ ...p, transmissionStatus: "exported" })); onSaved({ ...exam, transmissionStatus: "exported" }); alert(d.note); }
    else alert(d.error || "Failed");
  };
  const alerts: any[] = exam.alerts || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-2xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900 text-white px-5 py-3 flex items-center justify-between z-10">
          <div><div className="font-bold">{exam.driverName}</div><div className="text-xs text-white/60">{STATUS_LABEL[exam.status] || exam.status} · {OUTCOME_LABEL[exam.outcome] || exam.outcome}</div></div>
          <button onClick={onClose} className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">Close</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Driver history status + kiosk link */}
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
            <h4 className="font-semibold text-slate-900 mb-1">1 · Driver health history</h4>
            {exam.driverSignedAt ? (
              <p className="text-sm text-emerald-700">✓ Submitted by the driver on {new Date(exam.driverSignedAt).toLocaleString()}.</p>
            ) : kioskUrl ? (
              <div className="text-sm text-slate-600">
                <p>Have the driver complete their medical history. Share this kiosk / tablet link:</p>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={kioskUrl} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <button onClick={() => { navigator.clipboard?.writeText(kioskUrl); }} className="btn-secondary py-1.5 px-3 text-xs">Copy</button>
                  <a href={kioskUrl} target="_blank" rel="noreferrer" className="btn-primary py-1.5 px-3 text-xs">Open</a>
                </div>
                <p className="mt-1 text-xs text-slate-400">The driver can also fill it from their employee self-service portal.</p>
              </div>
            ) : <p className="text-sm text-slate-500">Awaiting driver history.</p>}
          </section>

          {/* Rule-engine alerts */}
          {alerts.length > 0 && (
            <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
              <h4 className="font-semibold text-slate-900 mb-2">FMCSA guidance &amp; alerts</h4>
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li key={i} className={`text-sm rounded-lg px-3 py-2 ${a.severity === "critical" ? "bg-rose-50 text-rose-800" : a.severity === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-700"}`}>{a.message}</li>
                ))}
              </ul>
              {(exam.additionalFormsRequired || []).length > 0 && <p className="mt-2 text-sm font-semibold text-rose-700">Additional forms required: {(exam.additionalFormsRequired || []).join(", ")}</p>}
            </section>
          )}

          {/* Examiner findings */}
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4 space-y-3">
            <h4 className="font-semibold text-slate-900">2 · Examiner testing</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Num label="Height (in)" val={v.heightIn} on={(x) => setField("vitals", "heightIn", x)} />
              <Num label="Weight (lb)" val={v.weightLb} on={(x) => setField("vitals", "weightLb", x)} />
              <Num label="BP systolic" val={v.bpSystolic} on={(x) => setField("vitals", "bpSystolic", x)} />
              <Num label="BP diastolic" val={v.bpDiastolic} on={(x) => setField("vitals", "bpDiastolic", x)} />
              <Num label="Pulse" val={v.pulse} on={(x) => setField("vitals", "pulse", x)} />
            </div>
            {exam.bpCategory && <div className="text-xs text-slate-500">BP category: <strong>{exam.bpCategory}</strong></div>}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Txt label="Vision R (corr.)" val={vis.acuityRightCorrected} on={(x) => setField("vision", "acuityRightCorrected", x)} ph="20/40" />
              <Txt label="Vision L (corr.)" val={vis.acuityLeftCorrected} on={(x) => setField("vision", "acuityLeftCorrected", x)} ph="20/40" />
              <Txt label="Vision Both" val={vis.acuityBothCorrected} on={(x) => setField("vision", "acuityBothCorrected", x)} ph="20/40" />
              <Num label="Field R (°)" val={vis.fieldRightDeg} on={(x) => setField("vision", "fieldRightDeg", x)} />
              <Num label="Field L (°)" val={vis.fieldLeftDeg} on={(x) => setField("vision", "fieldLeftDeg", x)} />
              <Chk label="Color OK" checked={vis.colorPass !== false} on={(c) => setField("vision", "colorPass", c)} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Num label="Whisper R (ft)" val={he.whisperRightFt} on={(x) => setField("hearing", "whisperRightFt", x)} />
              <Num label="Whisper L (ft)" val={he.whisperLeftFt} on={(x) => setField("hearing", "whisperLeftFt", x)} />
              <Num label="dB loss (better ear)" val={he.dbLossBetterEar} on={(x) => setField("hearing", "dbLossBetterEar", x)} />
            </div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <Txt label="Urine Sp.Gr." val={ur.spGravity} on={(x) => setField("urinalysis", "spGravity", x)} />
              <Txt label="Protein" val={ur.protein} on={(x) => setField("urinalysis", "protein", x)} />
              <Txt label="Blood" val={ur.blood} on={(x) => setField("urinalysis", "blood", x)} />
              <Txt label="Sugar" val={ur.sugar} on={(x) => setField("urinalysis", "sugar", x)} />
            </div>
          </section>

          {/* Physical exam by system */}
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
            <h4 className="font-semibold text-slate-900 mb-2">3 · Physical examination</h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {PHYSICAL_SYSTEMS.map((sys) => {
                const it = pe[sys.key] || {};
                return (
                  <label key={sys.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!it.abnormal} onChange={(e) => setField("physicalExam", sys.key, { ...it, abnormal: e.target.checked })} />
                    <span className={it.abnormal ? "text-rose-700" : "text-slate-700"}>{sys.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Determination */}
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4 space-y-3">
            <h4 className="font-semibold text-slate-900">4 · Determination</h4>
            <div className="space-y-1 text-sm">
              {[["meetsStandards", "Meets standards — qualifies for certificate"], ["meetsWithExemption", "Meets with periodic monitoring / exemption"], ["doesNotMeet", "Does NOT meet standards"], ["temporarilyDisqualified", "Temporarily disqualified"], ["incomplete", "Incomplete examination"]].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!flags[k]} onChange={() => setFlag(k)} /> {l}</label>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <label className="text-slate-600">Certificate length</label>
              <select value={exam.certMonths || ""} onChange={(e) => setExam((p: any) => ({ ...p, certMonths: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option value="">—</option>
                {CERT_DURATIONS.map((m) => <option key={m} value={m}>{m} months</option>)}
              </select>
              {suggested != null && <span className="text-xs text-brand-600">Suggested: {suggested} mo</span>}
              {exam.expiresOn && <span className="text-xs text-slate-500">Expires {new Date(exam.expiresOn).toLocaleDateString()}</span>}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Restrictions</div>
              <div className="grid sm:grid-cols-2 gap-1 text-sm">
                {RESTRICTION_OPTIONS.map((o) => <label key={o.key} className="flex items-center gap-2"><input type="checkbox" checked={restr.includes(o.key)} onChange={() => toggleRestr(o.key)} /> {o.label}</label>)}
              </div>
            </div>
          </section>

          {/* Examiner identity */}
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
            <h4 className="font-semibold text-slate-900 mb-2">5 · Medical examiner</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Txt label="Examiner name" val={exam.examinerName} on={(x) => setExam((p: any) => ({ ...p, examinerName: x }))} />
              <Txt label="National Registry #" val={exam.examinerNrcme} on={(x) => setExam((p: any) => ({ ...p, examinerNrcme: x }))} />
              <Txt label="License #" val={exam.examinerLicense} on={(x) => setExam((p: any) => ({ ...p, examinerLicense: x }))} />
              <Txt label="License state" val={exam.examinerLicenseState} on={(x) => setExam((p: any) => ({ ...p, examinerLicenseState: x }))} />
              <Txt label="Signature (typed)" val={exam.examinerSignature} on={(x) => setExam((p: any) => ({ ...p, examinerSignature: x }))} />
            </div>
          </section>

          <div className="flex flex-wrap gap-2 pb-8">
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving…" : "Save exam"}</button>
            <a href={`/api/enterprise/dot/exams/${exam.id}/pdf?form=5875`} target="_blank" rel="noreferrer" className="btn-secondary">MCSA-5875 PDF</a>
            <a href={`/api/enterprise/dot/exams/${exam.id}/pdf?form=mec`} target="_blank" rel="noreferrer" className="btn-secondary">MEC card (5876)</a>
            <button onClick={transmit} className="btn-secondary" disabled={exam.status !== "completed"}>Export to FMCSA National Registry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Num({ label, val, on }: { label: string; val: any; on: (x: number) => void }) {
  return <label className="block"><span className="text-xs text-slate-500">{label}</span><input type="number" value={val ?? ""} onChange={(e) => on(e.target.value === "" ? (undefined as any) : Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5" /></label>;
}
function Txt({ label, val, on, ph }: { label: string; val: any; on: (x: string) => void; ph?: string }) {
  return <label className="block"><span className="text-xs text-slate-500">{label}</span><input value={val ?? ""} placeholder={ph} onChange={(e) => on(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" /></label>;
}
function Chk({ label, checked, on }: { label: string; checked: boolean; on: (c: boolean) => void }) {
  return <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} /> {label}</label>;
}

export { HEALTH_HISTORY };
