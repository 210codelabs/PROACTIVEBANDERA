"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BodyMap from "@/components/pt/BodyMap";

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

  // AI dictation + normalization
  const [dictation, setDictation] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const [codesResult, setCodesResult] = useState<null | { flags: Array<{ code: string; type: string; severity: string; issue: string }>; summary: string }>(null);
  const [codesBusy, setCodesBusy] = useState(false);

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

  // ---- In-note lookups (append a picked code/med into a field) ----
  function appendField(k: keyof typeof BLANK, value: string, sep = ", ") {
    if (!editing || !value) return;
    const cur = String(editing.form[k] || "").trim();
    const exists = cur.split(sep).map((s) => s.trim()).includes(value.trim());
    const next = cur ? (exists ? cur : `${cur}${sep}${value}`) : value;
    set(k, next);
  }

  // ---- Dictation (browser speech-to-text) ----
  function toggleMic() {
    if (listening) { try { recogRef.current?.stop(); } catch { /* ignore */ } setListening(false); return; }
    const SR = (typeof window !== "undefined") && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setAiMsg("Dictation isn't supported in this browser. Try Chrome, or type your notes."); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let final = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const tr = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += tr + " "; else interim += tr;
      }
      setDictation((prev) => {
        // keep any text the user typed before mic started, then live transcript
        const base = prev.replace(/\s*\[…listening][\s\S]*$/, "");
        return `${base}${final}${interim ? " […listening] " + interim : ""}`.trimStart();
      });
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      setDictation((prev) => prev.replace(/\s*\[…listening][\s\S]*$/, (final ? "" : "")).trim() + (final ? "" : ""));
    };
    recogRef.current = rec;
    try { rec.start(); setListening(true); setAiMsg(null); } catch { setListening(false); }
  }

  async function runAiNormalize() {
    if (!editing) return;
    setAiBusy(true); setAiMsg(null); setErr(null);
    try { if (listening) { recogRef.current?.stop(); setListening(false); } } catch { /* ignore */ }
    const clean = dictation.replace(/\s*\[…listening][\s\S]*$/, "").trim();
    try {
      const r = await fetch(`/api/pt/ai-note`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictation: clean, draft: editing.form, patientId: editing.patient.id }),
      });
      const d = await r.json();
      if (!r.ok) { setAiMsg(d.error || "AI could not draft the note."); setAiBusy(false); return; }
      const n = d.note || {};
      setEditing((cur) => cur ? ({
        ...cur,
        form: {
          ...cur.form,
          mechanism: n.mechanism || cur.form.mechanism,
          subjective: n.subjective || cur.form.subjective,
          objective: n.objective || cur.form.objective,
          assessment: n.assessment || cur.form.assessment,
          plan: n.plan || cur.form.plan,
          goals: n.goals || cur.form.goals,
          causation: n.causation || cur.form.causation,
          cpt: (n.cptCodes || []).length ? [...new Set([...cur.form.cpt.split(",").map((s: string) => s.trim()).filter(Boolean), ...n.cptCodes])].join(", ") : cur.form.cpt,
          icd: (n.icdCodes || []).length ? [...new Set([...cur.form.icd.split(",").map((s: string) => s.trim()).filter(Boolean), ...n.icdCodes])].join(", ") : cur.form.icd,
        },
      }) : cur);
      setAiMsg("AI draft applied — please review and edit before signing.");
    } catch {
      setAiMsg("AI request failed. Please try again.");
    } finally { setAiBusy(false); }
  }

  async function runAiCleanup() {
    if (!editing) return;
    setAiBusy(true); setAiMsg(null); setErr(null);
    const f = editing.form;
    try {
      const r = await fetch(`/api/pt/ai-cleanup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: {
          mechanism: f.mechanism, subjective: f.subjective, objective: f.objective,
          assessment: f.assessment, plan: f.plan, goals: f.goals, causation: f.causation,
        } }),
      });
      const d = await r.json();
      if (!r.ok) { setAiMsg(d.error || "AI could not proofread the note."); setAiBusy(false); return; }
      const n = d.note || {};
      setEditing((cur) => cur ? ({
        ...cur,
        form: {
          ...cur.form,
          // Proofread text only — codes/CPT/ICD are intentionally left unchanged.
          mechanism: n.mechanism ?? cur.form.mechanism,
          subjective: n.subjective ?? cur.form.subjective,
          objective: n.objective ?? cur.form.objective,
          assessment: n.assessment ?? cur.form.assessment,
          plan: n.plan ?? cur.form.plan,
          goals: n.goals ?? cur.form.goals,
          causation: n.causation ?? cur.form.causation,
        },
      }) : cur);
      setAiMsg("Proofread & tightened — clinical facts and codes were left unchanged. Please review.");
    } catch {
      setAiMsg("AI request failed. Please try again.");
    } finally { setAiBusy(false); }
  }

  // Stop mic + clear dictation when the editor closes.
  useEffect(() => {
    if (!editing) {
      try { recogRef.current?.stop(); } catch { /* ignore */ }
      setListening(false); setDictation(""); setAiMsg(null); setCodesResult(null);
    }
  }, [editing]);

  async function runCodesCheck() {
    if (!editing) return;
    setCodesBusy(true); setCodesResult(null); setAiMsg(null);
    const f = editing.form;
    try {
      const r = await fetch(`/api/pt/ai-codes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: { mechanism: f.mechanism, subjective: f.subjective, objective: f.objective, assessment: f.assessment, plan: f.plan, goals: f.goals, causation: f.causation },
          cptCodes: f.cpt.split(",").map((s: string) => s.trim()).filter(Boolean),
          icdCodes: f.icd.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setAiMsg(d.error || "Could not check codes."); setCodesBusy(false); return; }
      setCodesResult({ flags: d.flags || [], summary: d.summary || "" });
    } catch { setAiMsg("Code check failed. Please try again."); }
    finally { setCodesBusy(false); }
  }

  function startNoteForPatient(p: { id: string; firstName: string; lastName: string; mrn: string; dob?: string }) {
    setErr(null);
    setEditing({ patient: { ...p, dob: (p as any).dob || "" }, legalCase: null, form: { ...BLANK }, visitDate: new Date().toISOString().slice(0, 10) });
  }


  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900">PT / Personal Injury Encounters</h1>
          <p className="text-sm text-slate-500">Separate from clinical notes · only for patients registered under Physical Rehabilitation / Personal Injury.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56"><CodeLookup kind="patient" placeholder="Find patient → start PI note…" onPick={(it) => startNoteForPatient(it.raw)} /></div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PI patients & notes…" className="input w-56" />
        </div>
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
                    <a href={`/api/pt/patients/${c.patient.id}/packet/pdf`} target="_blank" rel="noopener noreferrer" className="btn-secondary" title="Bundle this patient's signed PI notes + intake into one attorney/insurer PDF">Packet</a>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`chip ${n.status === "signed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{n.status}</span>
                    {n.status === "signed" && (
                      <a href={`/api/pt/notes/${n.id}/pdf`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md ring-1 ring-slate-300 text-slate-700 px-2 py-1 text-[11px] font-semibold hover:bg-slate-100">PDF</a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Note editor */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 pt-[calc(var(--chrome-h)+16px)]" onClick={() => !busy && setEditing(null)}>
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

              {/* AI dictation + normalization */}
              <div className="rounded-xl bg-indigo-50/70 ring-1 ring-indigo-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">AI dictation & drafting</span>
                  <button type="button" onClick={toggleMic} className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${listening ? "bg-rose-600 text-white" : "bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"}`}>
                    {listening ? "● Stop dictation" : "🎤 Dictate"}
                  </button>
                </div>
                <textarea
                  value={dictation}
                  onChange={(e) => setDictation(e.target.value)}
                  rows={2}
                  placeholder="Dictate or type a quick summary of the visit — the AI will organize it into the PI note fields below."
                  className="input w-full resize-y text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-indigo-700/80">AI produces a draft — review & edit before signing.</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={aiBusy} onClick={runAiCleanup} className="rounded-lg bg-white ring-1 ring-indigo-200 text-indigo-700 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-50" title="Proofread & tighten the existing note without changing clinical facts or codes">
                      {aiBusy ? "Working…" : "🧹 Proofread & tighten"}
                    </button>
                    <button type="button" disabled={aiBusy} onClick={runAiNormalize} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                      {aiBusy ? "Drafting…" : "✨ AI normalize note"}
                    </button>
                  </div>
                </div>
                {aiMsg && <div className="text-[11px] font-medium text-indigo-700">{aiMsg}</div>}
              </div>

              <Field label="Mechanism of injury (how the accident occurred)" v={editing.form.mechanism} on={(v) => set("mechanism", v)} />
              <Field label="Subjective (patient-reported symptoms, pain scale)" v={editing.form.subjective} on={(v) => set("subjective", v)} />
              <Field label="Objective (ROM, MMT, palpation, special tests)" v={editing.form.objective} on={(v) => set("objective", v)} />
              <Field label="Assessment (diagnosis / clinical impression)" v={editing.form.assessment} on={(v) => set("assessment", v)} />
              <Field label="Plan (treatment plan, frequency, duration)" v={editing.form.plan} on={(v) => set("plan", v)} />
              <div className="-mt-1">
                <span className="lbl">Medication lookup (openFDA / RxNorm) — adds to plan</span>
                <CodeLookup kind="med" placeholder="Search a medication to reference in the plan…" compact onPick={(it) => appendField("plan", it.label + (it.code ? ` (${it.code})` : ""))} />
              </div>
              <Field label="Functional goals" v={editing.form.goals} on={(v) => set("goals", v)} />
              <Field label="Causation statement (relationship of injury to the accident)" v={editing.form.causation} on={(v) => set("causation", v)} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="lbl">CPT codes (comma-separated)</span>
                  <input value={editing.form.cpt} onChange={(e) => set("cpt", e.target.value)} placeholder="97110, 97140, 97530" className="input w-full" />
                  <div className="mt-1"><CodeLookup kind="cpt" placeholder="Search CPT / HCPCS…" compact onPick={(it) => appendField("cpt", it.code)} /></div>
                </label>
                <label className="block">
                  <span className="lbl">ICD-10 codes (comma-separated)</span>
                  <input value={editing.form.icd} onChange={(e) => set("icd", e.target.value)} placeholder="S13.4XXA, M54.2" className="input w-full" />
                  <div className="mt-1"><CodeLookup kind="icd" placeholder="Search ICD-10 diagnosis…" compact onPick={(it) => appendField("icd", it.code)} /></div>
                </label>
              </div>
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pre-sign code check</span>
                  <button type="button" disabled={codesBusy} onClick={runCodesCheck} className="rounded-lg bg-white ring-1 ring-slate-300 text-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50">
                    {codesBusy ? "Checking…" : "🔎 Check codes vs note"}
                  </button>
                </div>
                {codesResult && (
                  <div className="space-y-1.5">
                    <div className={`text-xs font-medium ${codesResult.flags.length ? "text-amber-700" : "text-emerald-700"}`}>{codesResult.summary}</div>
                    {codesResult.flags.map((fl, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] rounded-md bg-amber-50 ring-1 ring-amber-200 px-2 py-1.5">
                        <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 font-mono font-bold ${fl.severity === "warning" ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700"}`}>{fl.type.toUpperCase()} {fl.code}</span>
                        <span className="text-amber-800">{fl.issue}</span>
                      </div>
                    ))}
                    {codesResult.flags.length === 0 && <div className="text-[11px] text-emerald-600">No unsupported codes detected. (Decision-support only — you make the final call.)</div>}
                  </div>
                )}
              </div>

              {/* Signature block */}
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Physical Therapist signature</div>
                <div className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}{user.credential ? `, ${user.credential}` : ""}</div>
                <div className="text-[11px] text-slate-500">NPI &amp; state license are pulled from your provider profile on sign. Add them in Settings if missing.</div>
                {editing.status === "signed" && (
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-emerald-600">This note is signed.</span>
                    {editing.id && <a href={`/api/pt/notes/${editing.id}/pdf`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-indigo-600 hover:underline">Download signed PDF →</a>}
                  </div>
                )}
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 pt-[calc(var(--chrome-h)+16px)]" onClick={() => !busy && setIntakeFor(null)}>
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
              <BodyMap
                value={intakeFor.form.bodyParts.split(",").map((s) => s.trim()).filter(Boolean)}
                onChange={(arr) => setI("bodyParts", arr.join(", "))}
              />
              <label className="block"><span className="lbl">Injured body parts (tap the map above, or edit here)</span><input value={intakeFor.form.bodyParts} onChange={(e) => setI("bodyParts", e.target.value)} className="input w-full" placeholder="Neck, Lower back, Right shoulder" /></label>
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

type LookupKind = "icd" | "cpt" | "med" | "patient";
type LookupItem = { code: string; label: string; sub?: string; raw?: any };

function CodeLookup({ kind, placeholder, onPick, compact }: {
  kind: LookupKind;
  placeholder: string;
  onPick: (item: LookupItem) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setItems([]); return; }
    setLoading(true); setOpen(true);
    timer.current = setTimeout(async () => {
      try {
        let url = "";
        if (kind === "icd") url = `/api/refdata?type=diagnosis&q=${encodeURIComponent(q.trim())}&limit=8`;
        else if (kind === "cpt") url = `/api/refdata?type=billingCode&q=${encodeURIComponent(q.trim())}&limit=8`;
        else if (kind === "med") url = `/api/drugs/search?q=${encodeURIComponent(q.trim())}`;
        else url = `/api/patients/search?q=${encodeURIComponent(q.trim())}&limit=8`;
        const r = await fetch(url);
        const d = await r.json();
        let mapped: LookupItem[] = [];
        if (kind === "icd" || kind === "cpt") {
          mapped = (d.items || []).map((i: any) => ({ code: i.code || "", label: i.display || "", raw: i }));
        } else if (kind === "med") {
          mapped = (d.results || []).map((i: any) => ({
            code: i.rxcui || i.ndc || "",
            label: i.name || i.brandName || i.brand_name || i.genericName || i.generic_name || i.display || i.proprietaryName || "(unnamed)",
            sub: i.genericName || i.generic_name || undefined,
            raw: i,
          }));
        } else {
          mapped = (d.results || []).map((p: any) => ({
            code: p.id, label: `${p.lastName}, ${p.firstName}`, sub: p.mrn ? `MRN ${p.mrn}` : undefined, raw: p,
          }));
        }
        setItems(mapped);
      } catch { setItems([]); } finally { setLoading(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, kind]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className={`input w-full ${compact ? "text-xs py-1" : ""}`}
      />
      {open && (loading || items.length > 0 || q.trim().length >= 2) && (
        <div className="absolute z-[60] mt-1 w-full rounded-lg bg-white ring-1 ring-slate-200 shadow-xl max-h-56 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-[11px] text-slate-400">Searching…</div>}
          {!loading && items.length === 0 && <div className="px-3 py-2 text-[11px] text-slate-400">No matches.</div>}
          {items.map((it, idx) => (
            <button
              key={`${it.code}-${idx}`}
              type="button"
              onClick={() => { onPick(it); setQ(""); setItems([]); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
            >
              <span className="font-semibold text-slate-800">{it.code ? `${it.code} · ` : ""}{it.label}</span>
              {it.sub && <span className="block text-[10px] text-slate-400">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
