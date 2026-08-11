"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const SOURCES = [
  { value: "practice_fusion", label: "Practice Fusion", hint: "Export patients from Practice Fusion (Reports → Patient List → CSV) and upload here." },
  { value: "ecw", label: "eClinicalWorks (eCW)", hint: "Export the patient demographics report from eCW as CSV and upload here." },
  { value: "csv", label: "Generic CSV", hint: "Any CSV with first/last name columns. Common headers are auto-detected." },
];

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name", lastName: "Last name", middleName: "Middle", dob: "DOB", sex: "Sex",
  email: "Email", phone: "Phone", addressLine1: "Address", addressLine2: "Address 2", city: "City",
  state: "State", postalCode: "ZIP", mrn: "MRN / Chart #", insurerName: "Insurer", insurerPlan: "Plan",
  memberId: "Member ID", groupNumber: "Group #", preferredLang: "Language",
};

export default function DataTools() {
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  // ---- Backup / recovery ----
  const restoreRef = useRef<HTMLInputElement | null>(null);
  function backup() { window.open("/api/admin/db/backup", "_blank"); setMsg({ kind: "ok", text: "Backup download started (JSON snapshot)." }); }
  async function reindex() {
    setBusy("reindex"); setMsg(null);
    try {
      const r = await fetch("/api/admin/db/reindex", { method: "POST" }); const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Reindex failed." });
      else setMsg({ kind: "ok", text: `Reindex complete across ${d.results?.length ?? 0} collections.` });
    } finally { setBusy(""); }
  }
  async function scan() {
    setBusy("scan"); setMsg(null);
    try {
      const r = await fetch("/api/admin/db/integrity"); const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Scan failed." });
      else setMsg({ kind: "ok", text: d.totalOrphans === 0 ? "No broken references found — data is consistent." : `Found ${d.totalOrphans} broken reference(s). Use Repair on the Database page.` });
    } finally { setBusy(""); }
  }
  async function restore(file: File) {
    setBusy("restore"); setMsg(null);
    try {
      const payload = JSON.parse(await file.text());
      const r = await fetch("/api/admin/db/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok || !d.ok) setMsg({ kind: "err", text: d.error || "Restore failed." });
      else {
        const created = (d.summary || []).reduce((n: number, x: any) => n + x.created, 0);
        setMsg({ kind: "ok", text: `Restore complete — ${created} records added (existing data untouched).` });
      }
    } catch { setMsg({ kind: "err", text: "Could not read that backup file." }); }
    finally { setBusy(""); if (restoreRef.current) restoreRef.current.value = ""; }
  }

  // ---- Import ----
  const [source, setSource] = useState("practice_fusion");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const loadJobs = useCallback(async () => {
    try { const r = await fetch("/api/admin/import/commit"); if (r.ok) { const d = await r.json(); setJobs(d.jobs || []); } } catch { /* */ }
  }, []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function onCsvFile(f: File) {
    setFileName(f.name);
    const text = await f.text();
    setCsv(text);
    setPreview(null); setResult(null);
  }

  async function runPreview() {
    setBusy("preview"); setMsg(null); setResult(null);
    try {
      const r = await fetch("/api/admin/import/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, entity: "patients", csv }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Preview failed." }); setPreview(null); }
      else setPreview(d);
    } finally { setBusy(""); }
  }

  async function runImport() {
    if (!confirm(`Import ${preview?.rowCount ?? ""} patient record(s) from ${SOURCES.find((s) => s.value === source)?.label}? This is additive — existing patients are skipped, never overwritten.`)) return;
    setBusy("import"); setMsg(null);
    try {
      const r = await fetch("/api/admin/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, entity: "patients", csv, mapping: preview?.mapping }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Import failed." }); }
      else { setResult(d); setMsg({ kind: "ok", text: `Import ${d.status}: ${d.created} created, ${d.skipped} skipped, ${d.failed} failed.` }); loadJobs(); }
    } finally { setBusy(""); }
  }

  const activeSrc = SOURCES.find((s) => s.value === source)!;

  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>}

      {/* DATA IMPORT (top priority) */}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Data Import — migrate from another EMR</h2>
            <p className="text-xs text-slate-500">Bring patients over from Practice Fusion, eClinicalWorks, or any CSV. Additive &amp; non-destructive — duplicates are skipped.</p>
          </div>
          <span className="chip bg-brand-100 text-brand-800 ring-brand-200">Patients</span>
        </header>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOURCES.map((s) => (
              <button key={s.value} type="button" onClick={() => { setSource(s.value); setPreview(null); setResult(null); }}
                className={`text-left rounded-xl border p-3 transition ${source === s.value ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/50" : "border-slate-200 hover:border-brand-300"}`}>
                <div className="font-semibold text-slate-900">{s.label}</div>
                <div className="text-[11px] text-slate-500 mt-1">{s.hint}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input ref={csvFileRef} type="file" accept=".csv,text/csv" className="text-sm"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); }} />
            {fileName && <span className="text-xs text-slate-500">{fileName} · {csv.length.toLocaleString()} chars</span>}
            <button onClick={runPreview} disabled={busy !== "" || !csv.trim()} className="btn-secondary">{busy === "preview" ? "Analyzing…" : "Preview & map"}</button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">…or paste CSV text</summary>
            <textarea className="input min-h-[120px] mt-2 font-mono text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); setResult(null); }} placeholder={"First Name,Last Name,DOB,Sex,Email,Phone,Address,City,State,Zip,MRN,Primary Insurance,Member ID\nJane,Doe,05/14/1985,F,jane@x.com,210-555-1212,100 Main St,San Antonio,TX,78205,PF-1001,UnitedHealthcare,UHC123"} />
          </details>

          {preview && (
            <div className="rounded-lg ring-1 ring-slate-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{preview.sourceLabel}</span>
                <span className="text-slate-600">{preview.rowCount} data row(s)</span>
                {preview.missingRequired?.length > 0
                  ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200">Missing: {preview.missingRequired.join(", ")}</span>
                  : <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Name columns detected</span>}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Detected mapping</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(preview.mapping).map((f) => (
                    <span key={f} className="chip bg-slate-100 text-slate-700 ring-slate-200">{FIELD_LABELS[f] || f} ← <span className="font-mono ml-1">{preview.headers[preview.mapping[f]]}</span></span>
                  ))}
                </div>
                {preview.unmappedHeaders?.length > 0 && <div className="mt-1 text-[11px] text-slate-400">Ignored columns: {preview.unmappedHeaders.join(", ")}</div>}
              </div>
              {preview.sample?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="data w-full text-xs">
                    <thead><tr><th>First</th><th>Last</th><th>DOB</th><th>Sex</th><th>Phone</th><th>MRN</th><th>Insurer</th></tr></thead>
                    <tbody>{preview.sample.map((r: any, i: number) => (
                      <tr key={i}><td>{r.firstName || "—"}</td><td>{r.lastName || "—"}</td><td>{r.dob || "—"}</td><td>{r.sex || "—"}</td><td>{r.phone || "—"}</td><td>{r.mrn || "—"}</td><td>{r.insurerName || "—"}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <button onClick={runImport} disabled={busy !== "" || preview.missingRequired?.length > 0} className="btn-primary">{busy === "import" ? "Importing…" : `Import ${preview.rowCount} patient(s)`}</button>
            </div>
          )}

          {result && (
            <div className={`rounded-lg ring-1 p-3 ${result.status === "completed" ? "ring-emerald-200 bg-emerald-50" : result.status === "partial" ? "ring-amber-200 bg-amber-50" : "ring-rose-200 bg-rose-50"}`}>
              <div className="font-semibold text-slate-800">Import {result.status}</div>
              <div className="text-sm text-slate-600">Total {result.total} · Created {result.created} · Skipped {result.skipped} · Failed {result.failed}</div>
              {result.errors?.length > 0 && (
                <ul className="mt-1 text-xs text-rose-700 list-disc ml-5 max-h-32 overflow-auto">{result.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
              )}
            </div>
          )}

          {jobs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Recent imports</div>
              <table className="data w-full text-xs"><thead><tr><th>When</th><th>Source</th><th>Total</th><th>Created</th><th>Skipped</th><th>Failed</th><th>Status</th></tr></thead>
                <tbody>{jobs.map((j) => (
                  <tr key={j.id}><td>{new Date(j.createdAt).toLocaleString()}</td><td>{j.source}</td><td>{j.total}</td><td>{j.created}</td><td>{j.skipped}</td><td>{j.failed}</td><td>{j.status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* BACKUP & RECOVERY (moved here) */}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200"><h2 className="font-semibold text-slate-900">Backup &amp; recovery</h2><p className="text-xs text-slate-500">Snapshot and restore core data, keep indexes healthy, and check data integrity.</p></header>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <ToolCard title="Backup — export snapshot" desc="Download a full JSON snapshot of clinical + config data. Do this regularly." action="Download backup" onAction={backup} />
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-800">Recovery — restore from backup</div>
            <p className="mt-1 text-sm text-slate-500">Additive &amp; non-destructive — only re-adds missing records; never overwrites.</p>
            <input ref={restoreRef} type="file" accept="application/json" className="mt-3 text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); }} />
            {busy === "restore" && <span className="ml-2 text-sm text-slate-400">Restoring…</span>}
          </div>
          <ToolCard title="Performance — reindex" desc="Ensure indexes on high-traffic fields. Safe & idempotent." action="Run reindex" busy={busy === "reindex"} onAction={reindex} />
          <ToolCard title="Data integrity — scan" desc="Find records that point to missing data (orphans). Read-only." action="Scan for issues" busy={busy === "scan"} onAction={scan} />
        </div>
        <div className="px-4 pb-4 text-xs text-slate-400">Full integrity repair &amp; database health live on the <a href="/admin/database" className="text-brand-600 hover:underline">Database &amp; Security</a> page.</div>
      </section>
    </div>
  );
}

function ToolCard({ title, desc, action, onAction, busy }: { title: string; desc: string; action: string; onAction: () => void; busy?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 flex flex-col">
      <div className="font-semibold text-slate-800">{title}</div>
      <p className="mt-1 text-sm text-slate-500 flex-1">{desc}</p>
      <button onClick={onAction} disabled={busy} className="btn-secondary mt-3 self-start">{busy ? "Working…" : action}</button>
    </div>
  );
}
