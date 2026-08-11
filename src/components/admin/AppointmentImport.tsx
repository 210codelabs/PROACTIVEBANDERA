"use client";

import React, { useRef, useState } from "react";

const APPT_SOURCES = [
  { value: "practice_fusion", label: "Practice Fusion (schedule)", hint: "Export your appointment/schedule report from Practice Fusion as CSV and upload here." },
  { value: "ecw", label: "eClinicalWorks (schedule)", hint: "Export the appointment/resource schedule from eCW as CSV and upload here." },
  { value: "csv", label: "Generic CSV (schedule)", hint: "Any CSV with a patient identifier and an appointment date. Columns are auto-detected." },
];

const FIELD_LABELS: Record<string, string> = {
  patientMrn: "Patient MRN", patientFirst: "Patient first", patientLast: "Patient last", patientDob: "Patient DOB",
  startsAt: "Start (date+time)", date: "Date", time: "Time", durationMin: "Duration (min)",
  provider: "Provider name", providerNpi: "Provider NPI", serviceCode: "Service code", serviceName: "Service / type",
  reason: "Reason", status: "Status", location: "Location",
};

export default function AppointmentImport({ onImported }: { onImported?: () => void }) {
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [source, setSource] = useState("practice_fusion");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [defaultProviderId, setDefaultProviderId] = useState("");
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onCsvFile(f: File) {
    setFileName(f.name);
    setCsv(await f.text());
    setPreview(null); setResult(null);
  }

  async function refreshPreview(overrideMapping?: Record<string, number>) {
    setBusy("preview"); setMsg(null); setResult(null);
    try {
      const body: any = { source, csv };
      if (overrideMapping) body.mapping = overrideMapping;
      const r = await fetch("/api/admin/import/appointments/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Preview failed." }); setPreview(null); }
      else { setPreview(d); setMapping(overrideMapping || d.mapping || {}); if (!defaultProviderId && d.providers?.length) setDefaultProviderId(d.providers[0].id); }
    } finally { setBusy(""); }
  }

  function setFieldColumn(field: string, colIdx: number) {
    const next = { ...mapping };
    if (colIdx >= 0) {
      for (const k of Object.keys(next)) { if (next[k] === colIdx) delete next[k]; }
      next[field] = colIdx;
    } else delete next[field];
    setMapping(next);
    refreshPreview(next);
  }

  async function runImport() {
    if (!confirm(`Import ${preview?.rowCount ?? ""} appointment(s)? Rows whose patient isn't already in the system are skipped. Existing appointments at the same time are skipped.`)) return;
    setBusy("import"); setMsg(null);
    try {
      const r = await fetch("/api/admin/import/appointments/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, csv, mapping, defaultProviderId: defaultProviderId || null }) });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Import failed." });
      else { setResult(d); setMsg({ kind: "ok", text: `Import ${d.status}: ${d.created} created, ${d.skipped} skipped, ${d.failed} failed.` }); onImported?.(); }
    } finally { setBusy(""); }
  }

  const mf = Object.keys(mapping);
  const hasPatientId = mf.includes("patientMrn") || (mf.includes("patientFirst") && mf.includes("patientLast"));
  const hasDate = mf.includes("startsAt") || mf.includes("date");
  const missing: string[] = [];
  if (!hasPatientId) missing.push("patient (MRN or first + last)");
  if (!hasDate) missing.push("appointment date");
  const usedCols = new Set(Object.values(mapping));
  const providers: any[] = preview?.providers || [];

  return (
    <div className="p-4 space-y-4">
      {msg && <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {APPT_SOURCES.map((s) => (
          <button key={s.value} type="button" onClick={() => { setSource(s.value); setPreview(null); setResult(null); }}
            className={`text-left rounded-xl border p-3 transition ${source === s.value ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/50" : "border-slate-200 hover:border-brand-300"}`}>
            <div className="font-semibold text-slate-900">{s.label}</div>
            <div className="text-[11px] text-slate-500 mt-1">{s.hint}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); }} />
        {fileName && <span className="text-xs text-slate-500">{fileName} · {csv.length.toLocaleString()} chars</span>}
        <button onClick={() => refreshPreview()} disabled={busy !== "" || !csv.trim()} className="btn-secondary">{busy === "preview" ? "Analyzing…" : "Preview & map"}</button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">…or paste CSV text</summary>
        <textarea className="input min-h-[120px] mt-2 font-mono text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); setResult(null); }}
          placeholder={"MRN,Date,Time,Provider,Visit Type,Duration,Status,Reason\nPC-100000,08/25/2026,09:30 AM,Andy Manzano,Follow-up,30,scheduled,Knee pain recheck"} />
      </details>

      {preview && (
        <div className="rounded-lg ring-1 ring-slate-200 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{preview.sourceLabel}</span>
            <span className="text-slate-600">{preview.rowCount} row(s)</span>
            {missing.length > 0
              ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200">Map required: {missing.join(", ")}</span>
              : <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Ready — patient & date mapped</span>}
          </div>

          {/* Default provider */}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-800">Default provider</span>
            <select className="input py-1 text-sm" value={defaultProviderId} onChange={(e) => setDefaultProviderId(e.target.value)}>
              <option value="">— none (skip unmatched) —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.npi ? ` · NPI ${p.npi}` : ""}</option>)}
            </select>
            <span className="text-[11px] text-slate-400">Used when a row&apos;s provider can&apos;t be matched by name/NPI.</span>
          </label>

          {/* Editable mapping */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-slate-500 uppercase">Column mapping <span className="text-slate-400 normal-case font-normal">— adjust any field</span></div>
              <button type="button" onClick={() => refreshPreview()} className="text-[11px] text-brand-600 hover:underline">Reset to auto-detected</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
              {Object.keys(FIELD_LABELS).map((f) => {
                const cur = mapping[f];
                return (
                  <label key={f} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-slate-600">{FIELD_LABELS[f]}</span>
                    <select value={cur == null ? -1 : cur} onChange={(e) => setFieldColumn(f, Number(e.target.value))} className="input py-1 text-xs flex-1">
                      <option value={-1}>— ignore —</option>
                      {preview.headers.map((h: string, i: number) => (
                        <option key={i} value={i} disabled={usedCols.has(i) && cur !== i}>{h || `(column ${i + 1})`}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          {preview.sample?.length > 0 && (
            <div className="overflow-x-auto">
              <div className="text-[11px] text-slate-400 mb-1">Preview of the first {preview.sample.length} row(s):</div>
              <table className="data w-full text-xs">
                <thead><tr><th>Patient</th><th>Starts</th><th>Provider</th><th>Service</th><th>Dur</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>{preview.sample.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.patient}</td>
                    <td>{r.startsAt ? new Date(r.startsAt).toLocaleString() : <span className="text-rose-600">no date</span>}</td>
                    <td>{r.provider}</td><td>{r.service}</td><td>{r.duration ?? "—"}</td><td>{r.status}</td><td className="max-w-[160px] truncate">{r.reason || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <button onClick={runImport} disabled={busy !== "" || missing.length > 0} className="btn-primary">{busy === "import" ? "Importing…" : `Import ${preview.rowCount} appointment(s)`}</button>
          <p className="text-[11px] text-slate-400">Patients are matched to existing records only (by MRN, or name + DOB). Rows with no match are skipped — import those patients first on the Patients tab.</p>
        </div>
      )}

      {result && (
        <div className={`rounded-lg ring-1 p-3 ${result.status === "completed" ? "ring-emerald-200 bg-emerald-50" : result.status === "partial" ? "ring-amber-200 bg-amber-50" : "ring-rose-200 bg-rose-50"}`}>
          <div className="font-semibold text-slate-800">Import {result.status}</div>
          <div className="text-sm text-slate-600">Total {result.total} · Created {result.created} · Skipped {result.skipped} · Failed {result.failed}</div>
          {result.errors?.length > 0 && (
            <ul className="mt-1 text-xs text-amber-800 list-disc ml-5 max-h-32 overflow-auto">{result.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
