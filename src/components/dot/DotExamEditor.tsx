"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HEALTH_HISTORY, PHYSICAL_SYSTEMS, RESTRICTION_OPTIONS, CERT_DURATIONS } from "@/lib/dot/forms";

type Exam = Record<string, any>;

export default function DotExamEditor({ patientId, examId, role, onClose, onUpdated }: {
  patientId: string;
  examId: string;
  role: string;
  onClose: () => void;
  onUpdated: (exam: Exam) => void;
}) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examiner, setExaminer] = useState<{ displayName: string; fmcsaExaminerVerified: boolean; fmcsaNrcmeNumber: string | null } | null>(null);
  const [password, setPassword] = useState("");
  const [signature, setSignature] = useState("");
  const [reportReference, setReportReference] = useState("");
  const [reporting, setReporting] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [portalRoot]);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/dot-exams/${examId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load examination");
        setExam(data.exam);
        setExaminer(data.examiner || null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load examination"))
      .finally(() => setLoading(false));
  }, [patientId, examId]);

  function setGroup(group: string, key: string, value: unknown) {
    setExam((current) => current && ({ ...current, [group]: { ...(current[group] || {}), [key]: value } }));
  }

  async function save(): Promise<boolean> {
    if (!exam) return false;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/patients/${patientId}/dot-exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverInfo: { medications: exam.driverInfo?.medications || "", diabetesTreatment: exam.driverInfo?.diabetesTreatment || "" },
          vitals: exam.vitals || {}, vision: exam.vision || {}, hearing: exam.hearing || {},
          urinalysis: exam.urinalysis || {}, physicalExam: exam.physicalExam || {},
          determinationFlags: exam.determinationFlags || {}, certMonths: exam.certMonths || null,
          restrictions: exam.restrictions || [], examDate: exam.examDate ? new Date(exam.examDate).toISOString().slice(0, 10) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save examination");
      setExam(data.exam);
      onUpdated(data.exam);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save examination");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function signAndLock() {
    if (!exam) return;
    setSigning(true);
    setError(null);
    try {
      if (!await save()) return;
      const response = await fetch(`/api/patients/${patientId}/dot-exams/${examId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, examinerSignature: signature }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign and lock examination");
      setExam(data.exam);
      onUpdated(data.exam);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign and lock examination");
    } finally {
      setSigning(false);
    }
  }

  async function recordReport() {
    setReporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/patients/${patientId}/dot-exams/${examId}/reporting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, reference: reportReference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record FMCSA report");
      setExam((current) => current && ({ ...current, reportingStatus: data.reportingStatus, reportedAt: data.reportedAt, reportingReference: data.reference }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record FMCSA report");
    } finally {
      setReporting(false);
    }
  }

  function toggleRestriction(key: string) {
    if (!exam) return;
    const current: string[] = exam.restrictions || [];
    setExam({ ...exam, restrictions: current.includes(key) ? current.filter((value) => value !== key) : [...current, key] });
  }

  const locked = Boolean(exam?.isLocked || exam?.signedAt);
  const history = exam?.healthHistory || {};
  const physical = exam?.physicalExam || {};
  const flags = exam?.determinationFlags || {};

  if (!portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-950/55" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="dot-exam-editor-title" className="ml-auto flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 id="dot-exam-editor-title" className="text-lg font-semibold text-slate-900">MCSA-5875 examination</h2>
            <p className="mt-1 text-sm text-slate-600">{exam?.driverName || "DOT examination"} · {locked ? "Signed and locked" : "Draft"}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? <p className="p-6 text-sm text-slate-500">Loading examination…</p> : error && !exam ? <p role="alert" className="p-6 text-sm text-rose-700">{error}</p> : exam && (
          <div className="space-y-5 p-5">
            {locked && <div className="border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-900">This record is locked. Use the authorized amendment workflow to make corrections.</div>}

            <section className="border-b border-slate-200 pb-5">
              <h3 className="mb-3 font-semibold text-slate-900">Driver health history</h3>
              <div className="divide-y divide-slate-100">
                {HEALTH_HISTORY.map((question) => {
                  const answer = history[question.key] || {};
                  return (
                    <div key={question.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <p className="text-sm text-slate-800">{question.label}</p>
                        {answer.yes === true && <input disabled={locked} className="input mt-2 w-full" value={answer.detail || ""} placeholder="Patient-reported details" onChange={(event) => setExam({ ...exam, healthHistory: { ...history, [question.key]: { ...answer, detail: event.target.value } } })} />}
                      </div>
                      <div className="flex gap-3 text-sm">
                        {[true, false].map((yes) => <label key={String(yes)} className="flex items-center gap-1.5"><input type="radio" name={`history-${question.key}`} checked={answer.yes === yes} disabled={locked} onChange={() => setExam({ ...exam, healthHistory: { ...history, [question.key]: { ...answer, yes } } })} />{yes ? "Yes" : "No"}</label>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="mt-3 block"><span className="label">Current medications</span><textarea className="input w-full" rows={3} disabled={locked} value={exam.driverInfo?.medications || ""} onChange={(event) => setGroup("driverInfo", "medications", event.target.value)} /></label>
              <label className="mt-3 block"><span className="label">Diabetes treatment</span><select className="input" disabled={locked} value={exam.driverInfo?.diabetesTreatment || "none"} onChange={(event) => setGroup("driverInfo", "diabetesTreatment", event.target.value)}><option value="none">None</option><option value="diet">Diet</option><option value="oral">Oral medication</option><option value="insulin">Insulin</option></select></label>
            </section>

            <section className="border-b border-slate-200 pb-5">
              <h3 className="mb-3 font-semibold text-slate-900">Examination and testing</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField label="Height (inches)" value={exam.vitals?.heightIn} disabled={locked} onChange={(value) => setGroup("vitals", "heightIn", value)} />
                <NumberField label="Weight (lb)" value={exam.vitals?.weightLb} disabled={locked} onChange={(value) => setGroup("vitals", "weightLb", value)} />
                <NumberField label="BP systolic" value={exam.vitals?.bpSystolic} disabled={locked} onChange={(value) => setGroup("vitals", "bpSystolic", value)} />
                <NumberField label="BP diastolic" value={exam.vitals?.bpDiastolic} disabled={locked} onChange={(value) => setGroup("vitals", "bpDiastolic", value)} />
                <NumberField label="Pulse" value={exam.vitals?.pulse} disabled={locked} onChange={(value) => setGroup("vitals", "pulse", value)} />
                {(["acuityRightUncorrected", "acuityLeftUncorrected", "acuityBothUncorrected", "acuityRightCorrected", "acuityLeftCorrected", "acuityBothCorrected"] as const).map((key) => <TextField key={key} label={key.replace("acuity", "").replace(/([A-Z])/g, " $1")} value={exam.vision?.[key]} disabled={locked} onChange={(value) => setGroup("vision", key, value)} />)}
                <NumberField label="Visual field right (degrees)" value={exam.vision?.fieldRightDeg} disabled={locked} onChange={(value) => setGroup("vision", "fieldRightDeg", value)} />
                <NumberField label="Visual field left (degrees)" value={exam.vision?.fieldLeftDeg} disabled={locked} onChange={(value) => setGroup("vision", "fieldLeftDeg", value)} />
                <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={exam.vision?.colorPass === true} disabled={locked} onChange={(event) => setGroup("vision", "colorPass", event.target.checked)} />Color recognition passed</label>
                <NumberField label="Whisper right (ft)" value={exam.hearing?.whisperRightFt} disabled={locked} onChange={(value) => setGroup("hearing", "whisperRightFt", value)} />
                <NumberField label="Whisper left (ft)" value={exam.hearing?.whisperLeftFt} disabled={locked} onChange={(value) => setGroup("hearing", "whisperLeftFt", value)} />
                <NumberField label="Better ear dB loss" value={exam.hearing?.dbLossBetterEar} disabled={locked} onChange={(value) => setGroup("hearing", "dbLossBetterEar", value)} />
                {(["spGravity", "protein", "blood", "sugar"] as const).map((key) => <TextField key={key} label={`Urine ${key}`} value={exam.urinalysis?.[key]} disabled={locked} onChange={(value) => setGroup("urinalysis", key, value)} />)}
              </div>
            </section>

            <section className="border-b border-slate-200 pb-5">
              <h3 className="mb-3 font-semibold text-slate-900">Physical examination</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {PHYSICAL_SYSTEMS.map((system) => {
                  const finding = physical[system.key] || {};
                  return <div key={system.key} className="rounded border border-slate-200 p-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(finding.abnormal)} disabled={locked} onChange={(event) => setExam({ ...exam, physicalExam: { ...physical, [system.key]: { ...finding, abnormal: event.target.checked } } })} />{system.label} abnormal</label>
                    <input className="input mt-2 w-full" value={finding.notes || ""} disabled={locked} placeholder="Examiner notes" onChange={(event) => setExam({ ...exam, physicalExam: { ...physical, [system.key]: { ...finding, notes: event.target.value } } })} />
                  </div>;
                })}
              </div>
            </section>

            <section className="pb-5">
              <h3 className="mb-3 font-semibold text-slate-900">Medical examiner determination</h3>
              <div className="space-y-2">
                {[["meetsStandards", "Meets standards"], ["meetsWithExemption", "Meets standards with monitoring / exemption"], ["doesNotMeet", "Does not meet standards"], ["temporarilyDisqualified", "Determination pending"], ["incomplete", "Incomplete examination"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(flags[key])} disabled={locked} onChange={(event) => setExam({ ...exam, determinationFlags: { ...flags, [key]: event.target.checked } })} />{label}</label>)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="label">Examination date</span><input type="date" className="input" disabled={locked} value={exam.examDate ? new Date(exam.examDate).toISOString().slice(0, 10) : ""} onChange={(event) => setExam({ ...exam, examDate: event.target.value })} /></label>
                <label className="block"><span className="label">Certificate duration</span><select className="input" disabled={locked} value={exam.certMonths || ""} onChange={(event) => setExam({ ...exam, certMonths: event.target.value ? Number(event.target.value) : null })}><option value="">—</option>{CERT_DURATIONS.map((month) => <option key={month} value={month}>{month} months</option>)}</select></label>
                <div><span className="label">Restrictions</span>{RESTRICTION_OPTIONS.map((restriction) => <label key={restriction.key} className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" disabled={locked} checked={(exam.restrictions || []).includes(restriction.key)} onChange={() => toggleRestriction(restriction.key)} />{restriction.label}</label>)}</div>
              </div>
            </section>

            {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {!locked && <div className="sticky bottom-0 space-y-3 border-t border-slate-200 bg-white py-3">
              <button type="button" className="btn-secondary" onClick={save} disabled={saving || signing}>{saving ? "Saving…" : "Save examination draft"}</button>
              {role === "provider" && <section className="rounded border border-amber-300 bg-amber-50 p-3">
                <h3 className="font-semibold text-amber-950">Review, sign &amp; lock DOT examination</h3>
                <p className="mt-1 text-xs text-amber-900">Signing creates a flattened record from the bundled FMCSA PDF template. The provider must be verified by a clinic administrator first.</p>
                <p className="mt-2 text-xs text-slate-700">{examiner?.fmcsaExaminerVerified ? `Verified examiner: ${examiner.displayName} · Registry ${examiner.fmcsaNrcmeNumber}` : "Your provider profile is not marked as FMCSA examiner-verified."}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="label">Type full legal name to sign</span><input className="input w-full" value={signature} onChange={(event) => setSignature(event.target.value)} autoComplete="name" /></label>
                  <label className="block"><span className="label">Password reauthentication</span><input type="password" className="input w-full" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
                </div>
                <button type="button" className="btn-primary mt-3" onClick={signAndLock} disabled={signing || !examiner?.fmcsaExaminerVerified || !password || !signature}>{signing ? "Signing and locking…" : "Review, sign & lock"}</button>
              </section>}
            </div>}
            {locked && <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <a className="btn-secondary" href={`/api/patients/${patientId}/dot-exams/${examId}/pdf?form=5875`}>Download signed MCSA-5875</a>
              {exam.mecIssuedAt && <a className="btn-secondary" href={`/api/patients/${patientId}/dot-exams/${examId}/pdf?form=5876`}>Download issued MCSA-5876</a>}
              {role === "provider" && <a className="btn-primary" href="https://nationalregistry.fmcsa.dot.gov/" target="_blank" rel="noreferrer">Open FMCSA National Registry</a>}
            </div>}
            {locked && role === "provider" && <section className="border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-700">FMCSA reporting status: <strong>{exam.reportingStatus || "due"}</strong></p>
              {exam.reportingStatus !== "reported" && <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-60 flex-1"><span className="label">FMCSA confirmation / reference (optional)</span><input className="input w-full" value={reportReference} onChange={(event) => setReportReference(event.target.value)} /></label>
                <button type="button" className="btn-secondary" onClick={recordReport} disabled={reporting}>{reporting ? "Recording…" : "Confirm submitted in FMCSA"}</button>
              </div>}
              {exam.reportedAt && <p className="mt-2 text-xs text-slate-500">Recorded {new Date(exam.reportedAt).toLocaleString()}{exam.reportingReference ? ` · ${exam.reportingReference}` : ""}</p>}
            </section>}
          </div>
        )}
        </div>
      </section>
    </div>,
    portalRoot,
  );
}

function NumberField({ label, value, disabled, onChange }: { label: string; value?: number; disabled: boolean; onChange: (value: number | undefined) => void }) {
  return <label className="block"><span className="label">{label}</span><input type="number" className="input w-full" value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)} /></label>;
}

function TextField({ label, value, disabled, onChange }: { label: string; value?: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="block"><span className="label">{label}</span><input className="input w-full" value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}