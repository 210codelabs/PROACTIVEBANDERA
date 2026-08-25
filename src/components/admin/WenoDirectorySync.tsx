"use client";

import React, { useEffect, useState } from "react";

export default function WenoDirectorySync() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    try { const d = await fetch("/api/admin/weno/directory/sync").then((r) => r.json()); setCount(d.count ?? 0); } catch { /* ignore */ }
  }
  useEffect(() => { refresh(); }, []);

  async function sync() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/weno/directory/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error || "Sync failed." }); return; }
      setMsg({ ok: true, text: `Imported ${d.imported} pharmacies${d.total ? ` of ${d.total}` : ""}.` });
      await refresh();
    } catch { setMsg({ ok: false, text: "Sync request failed." }); } finally { setBusy(false); }
  }

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
      {msg && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{msg.text}</div>
      )}
      <p className="mt-1 text-[10px] text-slate-400">Requires saved Weno credentials + your server IP allowlisted with Weno. In the test environment, built-in Weno test pharmacies are always searchable.</p>
    </div>
  );
}
