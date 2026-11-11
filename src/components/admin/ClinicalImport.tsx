"use client";

import React, { useRef, useState } from "react";

export default function ClinicalImport({ onImported }: { onImported?: () => void }) {
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [content, setContent] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [defaultProviderId, setDefaultProviderId] = useState("");
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onFile(f: File) {
    setFileName(f.name);
    setSourceFile(f);
    setContent(await f.text());
    setPreview(null); setResult(null);
  }

  async function runPreview() {
    setBusy("preview"); setMsg(null); setResult(null);
    try {
      const r = await fetch("/api/admin/import/clinical/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Preview failed." }); setPreview(null); }
      else { setPreview(d); }
    } finally { setBusy(""); }
  }

  async function runImport() {
    const c = preview?.counts || {};
    const parts = [
      `${c.problems ?? 0} problem(s)`, `${c.medications ?? 0} medication(s)`, `${c.allergies ?? 0} allergy(ies)`,
      `${c.vitals ?? 0} vital reading(s)`, `${c.immunizations ?? 0} immunization(s)`, `${c.encounters ?? 0} visit note(s)`,
    ].join(", ");
    const p = preview?.patient || {};
    const who = [p.firstName, p.lastName].filter(Boolean).join(" ") || "this patient";
    const verb = preview?.match?.id ? "into the existing chart for" : "and create a new chart for";
    if (!confirm(`Import ${parts} ${verb} ${who}? Existing records are skipped, never overwritten.`)) return;
    setBusy("import"); setMsg(null);
    try {
      const body = new FormData();
      if (sourceFile) body.set("file", sourceFile);
      else body.set("content", content);
      if (defaultProviderId) body.set("defaultProviderId", defaultProviderId);
      const r = await fetch("/api/admin/import/clinical/commit", { method: "POST", body });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Import failed." });
      else {
        setResult(d);
        setMsg({ kind: "ok", text: `${d.patientCreated ? "New chart created" : "Merged into existing chart"} — ${d.created} record(s) added, ${d.skipped} skipped.` });
        onImported?.();
      }
    } finally { setBusy(""); }
  }

  const p = preview?.patient || {};
  const missing = preview?.missingRequired || [];
  const providers: any[] = preview?.providers || [];

  return (
    <div className="p-4 space-y-4">
      {msg && <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>}

      <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
        Upload one patient&apos;s UTF-8 <b>C-CDA</b> document (<span className="font-mono text-xs">.xml</span> / <span className="font-mono text-xs">.cda</span>) or <b>FHIR</b> bundle (<span className="font-mono text-xs">.json</span>), up to 8 MB. The original file is saved in the patient chart. Only supported clinical fields are imported; other source data remains in the original document. Practice Fusion EHI ZIP archives and multi-patient bundles are not supported here.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xml,.cda,.ccda,.json,text/xml,application/xml,application/json" className="text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        {fileName && <span className="text-xs text-slate-500">{fileName} · {content.length.toLocaleString()} chars</span>}
        <button onClick={runPreview} disabled={busy !== "" || !content.trim()} className="btn-secondary">{busy === "preview" ? "Parsing…" : "Preview"}</button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">…or paste XML / JSON</summary>
        <textarea className="input min-h-[140px] mt-2 font-mono text-xs" value={content} onChange={(e) => { setContent(e.target.value); setSourceFile(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; setPreview(null); setResult(null); }} placeholder={"<ClinicalDocument …>…</ClinicalDocument>   — or —   { \"resourceType\": \"Bundle\", \"entry\": [ … ] }"} />
      </details>

      {preview && (
        <div className="rounded-lg ring-1 ring-slate-200 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="chip bg-indigo-100 text-indigo-800 ring-indigo-200">{preview.format === "ccda" ? "C-CDA (XML)" : "FHIR (JSON)"}</span>
            {missing.length > 0
              ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200">Missing: {missing.join(", ")}</span>
              : preview.match?.id
                ? <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Matches existing chart{preview.match.mrn ? ` · MRN ${preview.match.mrn}` : ""} — will merge</span>
                : preview.match?.by === "ambiguous" || preview.match?.by === "conflict" || preview.match?.by === "missing_identity"
                  ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200">Patient identity needs review before import</span>
                  : <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">New patient — will create a chart</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm">
            <Field label="Name" value={[p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")} />
            <Field label="DOB" value={p.dob} />
            <Field label="Sex" value={p.sex} />
            <Field label="MRN" value={p.mrn} />
            <Field label="Phone" value={p.phone} />
            <Field label="Email" value={p.email} />
            <Field label="City" value={[p.city, p.state].filter(Boolean).join(", ")} />
            <Field label="ZIP" value={p.postalCode} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ClinList title="Problems" count={preview.counts.problems} items={(preview.problems || []).map((x: any) => `${x.description}${x.icd10 ? ` (${x.icd10})` : ""}`)} />
            <ClinList title="Medications" count={preview.counts.medications} items={(preview.medications || []).map((x: any) => x.name + (x.sig ? ` — ${x.sig}` : ""))} />
            <ClinList title="Allergies" count={preview.counts.allergies} items={(preview.allergies || []).map((x: any) => x.substance + (x.reaction ? ` — ${x.reaction}` : ""))} />
            <ClinList title="Vitals" count={preview.counts.vitals} items={(preview.vitals || []).map(vitalSummary)} />
            <ClinList title="Immunizations" count={preview.counts.immunizations} items={(preview.immunizations || []).map((x: any) => `${x.vaccine}${x.cvxCode ? ` (CVX ${x.cvxCode})` : ""}${x.givenAt ? ` — ${x.givenAt}` : ""}`)} />
            <ClinList title="Visit notes" count={preview.counts.encounters ?? 0} items={(preview.encounters || []).map(encounterSummary)} />
          </div>

          {(preview.counts.encounters ?? 0) > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2">
              <span className="font-semibold text-amber-900">Default provider for imported visits</span>
              <select className="input py-1 text-sm" value={defaultProviderId} onChange={(e) => setDefaultProviderId(e.target.value)}>
                <option value="">— none (skip unmatched visits) —</option>
                {providers.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.npi ? ` · NPI ${pr.npi}` : ""}</option>)}
              </select>
              <span className="text-[11px] text-amber-700">Historical visit notes need a provider on file; used when the document&apos;s provider can&apos;t be matched.</span>
            </label>
          )}

          <button onClick={runImport} disabled={busy !== "" || missing.length > 0 || ["ambiguous", "conflict", "missing_identity"].includes(preview.match?.by)} className="btn-primary">
            {busy === "import" ? "Importing…" : preview.match?.id ? "Merge into existing chart" : "Create chart & import"}
          </button>
          <p className="text-[11px] text-slate-400">Imported clinical data should be reviewed by a clinician before it is relied upon. Records are added, never overwritten; re-running is safe (duplicates are skipped).</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg ring-1 ring-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-semibold text-slate-800">Import complete</div>
          <div className="text-slate-600">{result.patientCreated ? "New chart created." : "Merged into existing chart."} Problems +{result.counts.problems.created} ({result.counts.problems.skipped} skipped) · Meds +{result.counts.medications.created} ({result.counts.medications.skipped} skipped) · Allergies +{result.counts.allergies.created} ({result.counts.allergies.skipped} skipped) · Vitals +{result.counts.vitals.created} ({result.counts.vitals.skipped} skipped) · Immunizations +{result.counts.immunizations.created} ({result.counts.immunizations.skipped} skipped) · Visit notes +{result.counts.encounters?.created ?? 0} ({result.counts.encounters?.skipped ?? 0} skipped)</div>
          {result.notice && <div className="mt-1 text-amber-700">{result.notice}</div>}
          {result.sourceDocumentId && <div className="mt-1 text-slate-600">Original source document saved in the patient chart.</div>}
          {result.patientId && <a href={`/patients/${result.patientId}`} className="text-brand-600 hover:underline">Open patient chart →</a>}
        </div>
      )}
    </div>
  );
}

function encounterSummary(e: any): string {
  const when = e.date ? new Date(e.date).toLocaleDateString() : "";
  const head = [when, e.type].filter(Boolean).join(" · ");
  const body = e.note || e.reason || "";
  return `${head}${head && body ? " — " : ""}${body.length > 80 ? body.slice(0, 80) + "…" : body}`.trim() || "—";
}

function vitalSummary(v: any): string {
  const parts: string[] = [];
  if (v.systolic != null || v.diastolic != null) parts.push(`BP ${v.systolic ?? "?"}/${v.diastolic ?? "?"}`);
  if (v.pulse != null) parts.push(`HR ${v.pulse}`);
  if (v.temperatureC != null) parts.push(`Temp ${v.temperatureC}\u00B0C`);
  if (v.respRate != null) parts.push(`RR ${v.respRate}`);
  if (v.spo2 != null) parts.push(`SpO\u2082 ${v.spo2}%`);
  if (v.weightKg != null) parts.push(`Wt ${v.weightKg}kg`);
  if (v.heightCm != null) parts.push(`Ht ${v.heightCm}cm`);
  if (v.bmi != null) parts.push(`BMI ${v.bmi}`);
  if (v.painScore != null) parts.push(`Pain ${v.painScore}/10`);
  const when = v.takenAt ? new Date(v.takenAt).toLocaleDateString() : "";
  return `${when ? when + ": " : ""}${parts.join(", ") || "\u2014"}`;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-slate-400">{label}</div>
      <div className="text-slate-800">{value || "—"}</div>
    </div>
  );
}

function ClinList({ title, count, items }: { title: string; count: number; items: string[] }) {
  return (
    <div className="rounded-lg ring-1 ring-slate-200 p-2">
      <div className="text-xs font-semibold text-slate-600 mb-1">{title} <span className="chip bg-slate-100 text-slate-600 ring-slate-200 ml-1">{count}</span></div>
      {items.length === 0 ? <div className="text-xs text-slate-400">None found</div> : (
        <ul className="text-xs text-slate-700 list-disc ml-4 max-h-40 overflow-auto space-y-0.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      )}
    </div>
  );
}
