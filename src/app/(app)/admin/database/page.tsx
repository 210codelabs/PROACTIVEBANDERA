"use client";

import React, { useEffect, useRef, useState } from "react";

const BRAND = "#0E4770";

export default function DbAdminPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [auto, setAuto] = useState(true);
  const [integrity, setIntegrity] = useState<any>(null);

  async function scanIntegrity() {
    setBusy("scan"); setMsg(null);
    try {
      const res = await fetch("/api/admin/db/integrity");
      const d = await res.json();
      if (!res.ok) { setMsg({ kind: "err", text: d.error || "Scan failed." }); return; }
      setIntegrity(d);
      setMsg({ kind: "ok", text: d.totalOrphans === 0 ? "No broken references found — data is consistent." : `Found ${d.totalOrphans} broken reference(s). Review below, then run Repair to clean them.` });
    } finally { setBusy(""); }
  }

  async function repairIntegrity() {
    if (!confirm("Repair will permanently delete records that point to data which no longer exists (e.g. a note whose patient was deleted). This cannot be undone. Continue?")) return;
    setBusy("repair"); setMsg(null);
    try {
      const res = await fetch("/api/admin/db/integrity", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) { setMsg({ kind: "err", text: d.error || "Repair failed." }); return; }
      setMsg({ kind: "ok", text: `Repair complete — ${d.totalDeleted} broken record(s) removed. Pages should load normally now.` });
      setIntegrity(null);
      loadHealth();
    } finally { setBusy(""); }
  }

  async function loadHealth() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/db/health");
      if (res.status === 403) { setDenied(true); return; }
      setHealth(await res.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadHealth(); }, []);

  async function reindex() {
    setBusy("reindex"); setMsg(null);
    try {
      const res = await fetch("/api/admin/db/reindex", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setMsg({ kind: "err", text: d.error || "Reindex failed." });
      else {
        const total = (d.results || []).reduce((n: number, r: any) => n + (r.created || 0), 0);
        setMsg({ kind: "ok", text: `Reindex complete — ${total} indexes ensured across ${d.results.length} collections.` });
        loadHealth();
      }
    } finally { setBusy(""); }
  }

  function backup() {
    window.open("/api/admin/db/backup", "_blank");
    setMsg({ kind: "ok", text: "Backup download started (JSON snapshot)." });
  }

  async function restore(file: File) {
    setBusy("restore"); setMsg(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/admin/db/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) setMsg({ kind: "err", text: d.error || "Restore failed." });
      else {
        const created = (d.summary || []).reduce((n: number, r: any) => n + r.created, 0);
        const skipped = (d.summary || []).reduce((n: number, r: any) => n + r.skipped, 0);
        setMsg({ kind: "ok", text: `Restore complete — ${created} records added, ${skipped} already present (existing data untouched).` });
        loadHealth();
      }
    } catch {
      setMsg({ kind: "err", text: "Could not read that backup file." });
    } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }

  if (denied) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-center text-slate-500">This area is restricted to administrators.</div>;
  }

  const s = health?.storage;
  const c = health?.counts || {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Database &amp; Security</h1>
      <p className="mt-1 text-sm text-slate-500">
        Monitor database health, keep queries fast under load, and protect data with backups and recovery.
      </p>

      {msg && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Health */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Health</h2>
          <button onClick={loadHealth} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Refresh</button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Checking…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Status" value={health?.ok ? "Healthy" : "Degraded"} good={health?.ok} />
            <Stat label="Ping" value={health?.pingMs != null ? `${health.pingMs} ms` : "—"} />
            <Stat label="Data size" value={s ? `${s.dataSizeMB} MB` : "—"} />
            <Stat label="Index size" value={s ? `${s.indexSizeMB} MB` : "—"} />
            <Stat label="Patients" value={c.patients ?? "—"} />
            <Stat label="Encounters" value={c.encounters ?? "—"} />
            <Stat label="Orders" value={c.orders ?? "—"} />
            <Stat label="Documents" value={c.documents ?? "—"} />
          </div>
        )}
      </section>

      {/* Performance */}
      <Card
        title="Performance — Reindex"
        desc="Ensure indexes on high-traffic fields (patient search, chart loads, inbox). Run this if pages feel slow or become unavailable when many users are online. Safe and idempotent."
        action="Run reindex"
        onAction={reindex}
        busy={busy === "reindex"}
      />

      {/* Data integrity */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="font-semibold text-slate-800">Data Integrity — Fix broken references</h2>
            <p className="mt-1 text-sm text-slate-500">
              Finds records that point to data which no longer exists (an "orphan" — e.g. an appointment whose patient
              was deleted). A single orphan can make a page show <i>"temporarily unavailable"</i>. Scan is read-only;
              Repair removes the broken records so pages load normally again.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={scanIntegrity} disabled={busy === "scan"} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {busy === "scan" ? "Scanning…" : "Scan for issues"}
            </button>
            {integrity && integrity.totalOrphans > 0 && (
              <button onClick={repairIntegrity} disabled={busy === "repair"} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy === "repair" ? "Repairing…" : `Repair ${integrity.totalOrphans} issue(s)`}
              </button>
            )}
          </div>
        </div>
        {integrity && (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2">Collection</th><th className="px-3 py-2">Missing link</th><th className="px-3 py-2 text-right">Broken</th></tr>
              </thead>
              <tbody>
                {integrity.report.filter((r: any) => r.orphans > 0 || r.error).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{r.child}</td>
                    <td className="px-3 py-2 text-slate-500">{r.fk} → {r.parent}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">{r.error ? "err" : r.orphans}</td>
                  </tr>
                ))}
                {integrity.totalOrphans === 0 && (
                  <tr><td colSpan={3} className="px-3 py-3 text-center text-slate-400">No broken references — everything is consistent.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Backup */}
      <Card
        title="Backup — Export snapshot"
        desc="Download a full JSON snapshot of core clinical and configuration data. Store it somewhere safe. We recommend a daily backup."
        action="Download backup"
        onAction={backup}
      >
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-teal-600" />
          Remind me to back up (auto-save reminder) — download a snapshot regularly
        </label>
      </Card>

      {/* Restore */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-800">Recovery — Restore from backup</h2>
        <p className="mt-1 text-sm text-slate-500">
          Import a backup file. Restore is <b>additive and non-destructive</b> — it only re-adds records that are missing
          (matched by id) and never overwrites or deletes existing data.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input ref={fileRef} type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); }} className="text-sm" />
          {busy === "restore" && <span className="text-sm text-slate-400">Restoring…</span>}
        </div>
      </section>

      {/* Security notes */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-800">Security &amp; Reliability</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Connection pooling is enforced (tunable via <code>MONGO_MAX_POOL</code>) to prevent connection exhaustion when many users are online.</li>
          <li>All admin actions here are recorded in the Audit Log.</li>
          <li>Access is restricted to administrators; role-based permissions apply across the app.</li>
          <li>For production capacity/scaling limits, contact Emergent Support to upgrade the database tier.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: any; good?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${good === false ? "text-red-600" : good ? "text-green-600" : "text-slate-800"}`}>{String(value)}</div>
    </div>
  );
}

function Card({ title, desc, action, onAction, busy, children }: { title: string; desc: string; action: string; onAction: () => void; busy?: boolean; children?: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
          {children}
        </div>
        <button onClick={onAction} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BRAND }}>
          {busy ? "Working…" : action}
        </button>
      </div>
    </section>
  );
}
