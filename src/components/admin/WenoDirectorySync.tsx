"use client";

import React, { useEffect, useState } from "react";

type DirReport = { at: string; total: number; added: number; updated: number; errors: number; imported: number };
type DirState = { count: number; autoSync: boolean; lastSyncAt: string | null; lastResult: string | null; lastError: string | null; lastReport: DirReport | null };

export default function WenoDirectorySync() {
  const [state, setState] = useState<DirState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    try { const d = await fetch("/api/admin/weno/directory/sync").then((r) => r.json()); setState(d); } catch { /* ignore */ }
  }
  useEffect(() => { refresh(); }, []);

  async function sync() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/weno/directory/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error || "Sync failed." }); return; }
      setMsg({ ok: true, text: `Imported ${d.imported} of ${d.total} — ${d.added} new, ${d.updated} updated${d.errors ? `, ${d.errors} errors` : ""}.` });
      await refresh();
    } catch { setMsg({ ok: false, text: "Sync request failed." }); } finally { setBusy(false); }
  }

  async function toggleAuto(autoSync: boolean) {
    setState((s) => (s ? { ...s, autoSync } : s));
    try { await fetch("/api/admin/weno/directory/sync", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoSync }) }); await refresh(); } catch { /* ignore */ }
  }

  const count = state?.count ?? null;
  const lastSync = state?.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : null;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Weno Pharmacy Directory</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download Weno&apos;s pharmacy directory so clinicians can pick a pharmacy by name in the eRx builder.
            {count !== null && <span className="ml-1 font-medium text-slate-700">{count.toLocaleString()} cached locally.</span>}
          </p>
        </div>
        <button onClick={sync} disabled={busy} className="btn-secondary text-sm disabled:opacity-60 shrink-0">{busy ? "Syncing…" : "Sync from Weno"}</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={!!state?.autoSync} onChange={(e) => toggleAuto(e.target.checked)} className="accent-brand-600" />
          Auto-sync nightly
        </label>
        {lastSync && <span className="text-[11px] text-slate-400">Last sync: {lastSync}{state?.lastResult ? ` · ${state.lastResult}` : ""}</span>}
        {state?.lastError && <span className="text-[11px] text-rose-500">Last error: {state.lastError}</span>}
      </div>

      {msg && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{msg.text}</div>
      )}

      {state?.lastReport && (
        <div className="mt-3 rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last sync report</span>
            <span className="text-[10px] text-slate-400">{new Date(state.lastReport.at).toLocaleString()}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-md bg-white ring-1 ring-slate-200 py-1.5">
              <div className="text-sm font-bold text-emerald-700">{state.lastReport.added.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Added</div>
            </div>
            <div className="rounded-md bg-white ring-1 ring-slate-200 py-1.5">
              <div className="text-sm font-bold text-sky-700">{state.lastReport.updated.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Updated</div>
            </div>
            <div className="rounded-md bg-white ring-1 ring-slate-200 py-1.5">
              <div className={`text-sm font-bold ${state.lastReport.errors ? "text-rose-600" : "text-slate-400"}`}>{state.lastReport.errors.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Errors</div>
            </div>
            <div className="rounded-md bg-white ring-1 ring-slate-200 py-1.5">
              <div className="text-sm font-bold text-slate-700">{state.lastReport.total.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">In file</div>
            </div>
          </div>
          {state.lastError && <div className="mt-2 text-[11px] text-rose-600">Sample errors: {state.lastError}</div>}
        </div>
      )}
      <p className="mt-1 text-[10px] text-slate-400">Requires saved Weno credentials + your server IP allowlisted with Weno. Nightly auto-sync runs automatically (about once every 24h) when enabled. In the test environment, built-in Weno test pharmacies are always searchable.</p>
    </div>
  );
}
