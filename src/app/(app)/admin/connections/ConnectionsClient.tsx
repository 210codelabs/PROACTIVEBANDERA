"use client";

import React, { useCallback, useEffect, useState } from "react";

type Check = { key: string; name: string; category: string; live: boolean; configured: boolean; state: string; detail: string; usedFor: string };

const BADGE: Record<string, { cls: string; label: string }> = {
  up: { cls: "bg-emerald-100 text-emerald-800 ring-emerald-200", label: "Live · reachable" },
  down: { cls: "bg-rose-100 text-rose-800 ring-rose-200", label: "Unreachable" },
  configured: { cls: "bg-sky-100 text-sky-800 ring-sky-200", label: "Configured" },
  not_configured: { cls: "bg-amber-100 text-amber-800 ring-amber-200", label: "Not configured" },
  error: { cls: "bg-rose-100 text-rose-800 ring-rose-200", label: "Error" },
};

export default function ConnectionsClient() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/connections/status");
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Failed to load status."); return; }
      setChecks(d.checks || []); setCheckedAt(d.checkedAt || "");
    } catch { setErr("Failed to load status."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500">Live status of every external integration wired into the platform.</p>
        <button onClick={load} disabled={loading} className="ml-auto btn-secondary py-1.5 text-sm">{loading ? "Checking…" : "Re-check"}</button>
      </div>
      {checkedAt && <p className="text-[11px] text-slate-400">Last checked {new Date(checkedAt).toLocaleString()}</p>}
      {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((c) => {
          const b = BADGE[c.state] || BADGE.error;
          return (
            <div key={c.key} className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">{c.category}</div>
                </div>
                <span className={`chip ring-1 ring-inset text-[11px] ml-auto shrink-0 ${b.cls}`}>{b.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{c.detail}</p>
              <p className="mt-1 text-[11px] text-slate-400">Used for: {c.usedFor}</p>
            </div>
          );
        })}
        {!loading && checks.length === 0 && !err && <p className="text-slate-400 text-sm">No integrations found.</p>}
      </div>

      <p className="text-[10px] text-slate-400">Live-pinged services (NPPES, openFDA) are checked in real time. Keyed services (Stedi, Blue Button, Resend) show configuration status to avoid unnecessary paid/authenticated calls.</p>
    </div>
  );
}
