"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type QUser = { id: string; firstName: string; lastName: string; role: string; credential: string | null };
type LegalCase = { id: string; caseType: string; claimNumber?: string | null; dateOfInjury?: string | null; adjuster?: string | null; defendantInsurer?: string | null; lawFirm?: string | null; status?: string };
type CaseRow = { patient: { id: string; firstName: string; lastName: string; mrn: string; dob: string }; legalCase: LegalCase | null };
type Note = any;

const BLANK = { mechanism: "", subjective: "", objective: "", assessment: "", plan: "", goals: "", causation: "", cpt: "", icd: "" };
const BLANK_INTAKE = { accidentDate: "", accidentType: "Motor vehicle accident (MVA)", location: "", description: "", role: "driver", policeReport: "", bodyParts: "", painLevel: "", priorInjuries: "", autoInsurer: "", autoPolicy: "", claimNumber: "", adjuster: "", attorney: "", lawFirm: "" };

export default function PtEncounters({ user }: { user: QUser }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<null | { id?: string; patient: CaseRow["patient"]; legalCase: LegalCase | null; form: typeof BLANK; visitDate: string; status?: string }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [intakeFor, setIntakeFor] = useState<null | { patient: CaseRow["patient"]; legalCase: LegalCase | null; form: typeof BLANK_INTAKE }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, n] = await Promise.all([
        fetch(`/api/pt/cases?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        fetch(`/api/pt/notes?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      ]);
      setCases(c.cases || []);
      setNotes(n.notes || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  function newNote(row: CaseRow) {
    setErr(null);
    setEditing({ patient: row.patient, legalCase: row.legalCase, form: { ...BLANK }, visitDate: new Date().toISOString().slice(0, 10) });
  }
  function openIntake(row: CaseRow) {
    setErr(null);
    const lc = row.legalCase;
    setIntakeFor({
      patient: row.patient, legalCase: lc,
      form: {
        ...BLANK_INTAKE,
        claimNumber: lc?.claimNumber || "", adjuster: lc?.adjuster || "",
        autoInsurer: lc?.defendantInsurer || "", lawFirm: lc?.lawFirm || "",
        accidentDate: lc?.dateOfInjury ? String(lc.dateOfInjury).slice(0, 10) : "",
      },
    });
  }
  async function saveIntake(alsoNote: boolean) {
    if (!intakeFor) return;
    setBusy(true); setErr(null);
    const f = intakeFor.form;
    const bodyParts = f.bodyParts.split(",").map((s) => s.trim()).filter(Boolean);
    const payload: any = {
      patientId: intakeFor.patient.id, legalCaseId: intakeFor.legalCase?.id || null,
      accidentDate: f.accidentDate || null, accidentType: f.accidentType, location: f.location,
      description: f.description, role: f.role, policeReport: f.policeReport, bodyParts,
      painLevel: f.painLevel ? Number(f.painLevel) : null, priorInjuries: f.priorInjuries,
      autoInsurer: f.autoInsurer, autoPolicy: f.autoPolicy, claimNumber: f.claimNumber,
      adjuster: f.adjuster, attorney: f.attorney, lawFirm: f.lawFirm,
    };
    try {
      const r = await fetch(`/api/pt/intake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save intake"); setBusy(false); return; }
      const patient = intakeFor.patient; const legalCase = intakeFor.legalCase;
      setIntakeFor(null);
      if (alsoNote) {
        const areas = bodyParts.length ? bodyParts.join(", ") : "\u2014";
        setEditing({
          patient, legalCase, visitDate: new Date().toISOString().slice(0, 10),
          form: {
            ...BLANK,
            mechanism: `${f.accidentType}${f.description ? " \u2014 " + f.description : ""}${f.location ? " at " + f.location : ""}. Patient was the ${f.role}.`,
            subjective: `Reports pain ${f.painLevel || "?"}/10. Affected areas: ${areas}.${f.priorInjuries ? " Prior injuries: " + f.priorInjuries + "." : ""}`,
            causation: `The above injuries are consistent with and causally related to the ${f.accidentType || "accident"}${f.accidentDate ? " on " + f.accidentDate : ""}.`,
          },
        });
      } else {
        await load();
      }
    } finally { setBusy(false); }
  }
  const setI = (k: keyof typeof BLANK_INTAKE, v: string) => intakeFor && setIntakeFor({ ...intakeFor, form: { ...intakeFor.form, [k]: v } });
  async function openNote(noteId: string) {
    setErr(null);
    const d = await fetch(`/api/pt/notes/${noteId}`).then((r) => r.json());
    if (!d.note) return;
    const n = d.note;
    setEditing({
      id: n.id,
      patient: d.patient,
      legalCase: null,
      status: n.status,
      visitDate: (n.visitDate || "").slice(0, 10),
      form: {
        mechanism: n.mechanism || "", subjective: n.subjective || "", objective: n.objective || "",
        assessment: n.assessment || "", plan: n.plan || "", goals: n.goals || "", causation: n.causation || "",
        cpt: (n.cptCodes || []).join(", "), icd: (n.icdCodes || []).join(", "),
      },
    });
  }

  async function save(sign: boolean) {
    if (!editing) return;
    setBusy(true); setErr(null);
    const payload: any = {
      ...editing.form,
      cptCodes: editing.form.cpt.split(",").map((s) => s.trim()).filter(Boolean),
      icdCodes: editing.form.icd.split(",").map((s) => s.trim()).filter(Boolean),
      visitDate: editing.visitDate,
    };
    delete payload.cpt; delete payload.icd;
    try {
      let noteId = editing.id;
      if (!noteId) {
        payload.patientId = editing.patient.id;
        payload.legalCaseId = editing.legalCase?.id || null;
        const r = await fetch(`/api/pt/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Could not save"); setBusy(false); return; }
        noteId = d.note.id;
      } else {
        const r = await fetch(`/api/pt/notes/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Could not save"); setBusy(false); return; }
      }
      if (sign && noteId) {
        await fetch(`/api/pt/notes/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sign: true }) });
      }
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }

  const set = (k: keyof typeof BLANK, v: string) => editing && setEditing({ ...editing, form: { ...editing.form, [k]: v } });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900">PT / Personal Injury Encounters</h1>
          <p className="text-sm text-slate-500">Separate from clinical notes · only for patients registered under Physical Rehabilitation / Personal Injury.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PI patients & notes…" className="input w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* PI patients */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Physical Rehab / PI Patients</header>
          {loading ? <div className="p-4 text-sm text-slate-400">Loading…</div> : cases.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No patients registered under Physical Rehabilitation / Personal Injury yet. Register a patient with type <b>legal</b> (Patients → New) to add PI notes.</div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {cases.map((c) => (
                <li key={c.patient.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{c.patient.lastName}, {c.patient.firstName} <span className="text-[11px] text-slate-400">MRN {c.patient.mrn}</span></div>
                    <div className="text-[11px] text-slate-500 truncate">{c.legalCase ? `${c.legalCase.caseType?.replace(/_/g, " ")}${c.legalCase.defendantInsurer ? ` · ${c.legalCase.defendantInsurer}` : ""}${c.legalCase.claimNumber ? ` · Claim ${c.legalCase.claimNumber}` : ""}` : "No legal case on file"}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openIntake(c)} className="btn-secondary">Intake</button>
                    <button onClick={() => newNote(c)} className="btn-secondary">+ PI note</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* PI notes */}
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">PI Encounter Notes</header>
          {loading ? <div className="p-4 text-sm text-slate-400">Loading…</div> : notes.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No PI notes yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
                  <button onClick={() => openNote(n.id)} className="text-left min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{n.patientName} <span className="text-[11px] text-slate-400">MRN {n.patientMrn}</span></div>
                    <div className="text-[11px] text-slate-500 truncate">{(n.visitDate || "").slice(0, 10)} · {n.assessment || n.subjective || "—"}</div>
                  </button>
                  <span className={`chip ${n.status === "signed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{n.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Note editor */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => !busy && setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-t-2xl">
              <div className="font-bold">Personal Injury Encounter — {editing.patient.lastName}, {editing.patient.firstName}</div>
              <button onClick={() => !busy && setEditing(null)} className="text-white/80 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="lbl">Date of visit</span><input type="date" value={editing.visitDate} onChange={(e) => setEditing({ ...editing, visitDate: e.target.value })} className="input w-full" /></label>
                <div className="text-[11px] text-slate-500 self-end pb-1">Texas PI documentation · English</div>
              </div>
              <Field label="Mechanism of injury (how the accident occurred)" v={editing.form.mechanism} on={(v) => set("mechanism", v)} />
              <Field label="Subjective (patient-reported symptoms, pain scale)" v={editing.form.subjective} on={(v) => set("subjective", v)} />
              <Field label="Objective (ROM, MMT, palpation, special tests)" v={editing.form.objective} on={(v) => set("objective", v)} />
              <Field label="Assessment (diagnosis / clinical impression)" v={editing.form.assessment} on={(v) => set("assessment", v)} />
              <Field label="Plan (treatment plan, frequency, duration)" v={editing.form.plan} on={(v) => set("plan", v)} />
              <Field label="Functional goals" v={editing.form.goals} on={(v) => set("goals", v)} />
              <Field label="Causation statement (relationship of injury to the accident)" v={editing.form.causation} on={(v) => set("causation", v)} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="lbl">CPT codes (comma-separated)</span><input value={editing.form.cpt} onChange={(e) => set("cpt", e.target.value)} placeholder="97110, 97140, 97530" className="input w-full" /></label>
                <label className="block"><span className="lbl">ICD-10 codes (comma-separated)</span><input value={editing.form.icd} onChange={(e) => set("icd", e.target.value)} placeholder="S13.4XXA, M54.2" className="input w-full" /></label>
              </div>

              {/* Signature block */}
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Physical Therapist signature</div>
                <div className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}{user.credential ? `, ${user.credential}` : ""}</div>
                <div className="text-[11px] text-slate-500">NPI &amp; state license are pulled from your provider profile on sign. Add them in Settings if missing.</div>
                {editing.status === "signed" && <div className="mt-1 text-[11px] font-semibold text-emerald-600">This note is signed.</div>}
              </div>

              {err && <div className="text-sm text-rose-600">{err}</div>}
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200">
              <Link href={`/patients/${editing.patient.id}`} prefetch={false} className="text-xs font-semibold text-brand-700 hover:underline">Open patient chart →</Link>
              <div className="flex items-center gap-2">
                <button disabled={busy} onClick={() => save(false)} className="btn-secondary">Save draft</button>
                <button disabled={busy} onClick={() => save(true)} className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy ? "Saving…" : "Save & sign"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {intakeFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => !busy && setIntakeFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-t-2xl">
              <div className="font-bold">Personal Injury Intake — {intakeFor.patient.lastName}, {intakeFor.patient.firstName}</div>
              <button onClick={() => !busy && setIntakeFor(null)} className="text-white/80 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-[11px] text-slate-500">Texas PI accident intake · English · kept separate from clinical intake</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="lbl">Accident date</span><input type="date" value={intakeFor.form.accidentDate} onChange={(e) => setI("accidentDate", e.target.value)} className="input w-full" /></label>
                <label className="block"><span className="lbl">Accident type</span><input value={intakeFor.form.accidentType} onChange={(e) => setI("accidentType", e.target.value)} className="input w-full" /></label>
              </div>
              <label className="block"><span className="lbl">Where did it happen?</span><input value={intakeFor.form.location} onChange={(e) => setI("location", e.target.value)} className="input w-full" placeholder="Intersection / roadway / address" /></label>
              <label className="block"><span className="lbl">Describe how the accident occurred</span><textarea rows={2} value={intakeFor.form.description} onChange={(e) => setI("description", e.target.value)} className="input w-full resize-y" /></label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><span className="lbl">Patient role</span>
                  <select value={intakeFor.form.role} onChange={(e) => setI("role", e.target.value)} className="input w-full">
                    <option value="driver">Driver</option><option value="passenger">Passenger</option><option value="pedestrian">Pedestrian</option><option value="cyclist">Cyclist</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="block"><span className="lbl">Pain (0-10)</span><input type="number" min={0} max={10} value={intakeFor.form.painLevel} onChange={(e) => setI("painLevel", e.target.value)} className="input w-full" /></label>
                <label className="block"><span className="lbl">Police report #</span><input value={intakeFor.form.policeReport} onChange={(e) => setI("policeReport", e.target.value)} className="input w-full" /></label>
              </div>
              <label className="block"><span className="lbl">Injured body parts / pain diagram (comma-separated)</span><input value={intakeFor.form.bodyParts} onChange={(e) => setI("bodyParts", e.target.value)} className="input w-full" placeholder="Neck, Lower back, Right shoulder" /></label>
              <label className="block"><span className="lbl">Prior injuries to same areas</span><input value={intakeFor.form.priorInjuries} onChange={(e) => setI("priorInjuries", e.target.value)} className="input w-full" /></label>
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Auto insurance &amp; legal</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="lbl">Auto insurer (payer)</span><input value={intakeFor.form.autoInsurer} onChange={(e) => setI("autoInsurer", e.target.value)} className="input w-full" /></label>
                  <label className="block"><span className="lbl">Policy #</span><input value={intakeFor.form.autoPolicy} onChange={(e) => setI("autoPolicy", e.target.value)} className="input w-full" /></label>
                  <label className="block"><span className="lbl">Claim #</span><input value={intakeFor.form.claimNumber} onChange={(e) => setI("claimNumber", e.target.value)} className="input w-full" /></label>
                  <label className="block"><span className="lbl">Adjuster</span><input value={intakeFor.form.adjuster} onChange={(e) => setI("adjuster", e.target.value)} className="input w-full" /></label>
                  <label className="block"><span className="lbl">Attorney</span><input value={intakeFor.form.attorney} onChange={(e) => setI("attorney", e.target.value)} className="input w-full" /></label>
                  <label className="block"><span className="lbl">Law firm</span><input value={intakeFor.form.lawFirm} onChange={(e) => setI("lawFirm", e.target.value)} className="input w-full" /></label>
                </div>
              </div>
              {err && <div className="text-sm text-rose-600">{err}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
              <button disabled={busy} onClick={() => saveIntake(false)} className="btn-secondary">Save intake</button>
              <button disabled={busy} onClick={() => saveIntake(true)} className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy ? "Saving\u2026" : "Save & start PI note"}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`:global(.lbl){display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:2px}`}</style>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={2} className="input w-full resize-y" />
    </label>
  );
}
