"use client";

import { useState } from "react";

type Result = { ok: boolean; text: string };

export default function WenoAdminMaintenance() {
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyRes, setApplyRes] = useState<Result | null>(null);
  const [relabelBusy, setRelabelBusy] = useState(false);
  const [relabelRes, setRelabelRes] = useState<Result | null>(null);

  async function applyEnv() {
    setApplyBusy(true); setApplyRes(null);
    try {
      const r = await fetch("/api/admin/weno/online/apply-env", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setApplyRes({ ok: false, text: d.error || "Failed to apply." }); return; }
      setApplyRes({ ok: true, text: `Applied ${d.applied?.length || 0} setting(s) from environment: ${(d.applied || []).join(", ")}. Weno Online is now enabled.` });
    } catch { setApplyRes({ ok: false, text: "Request failed." }); } finally { setApplyBusy(false); }
  }

  async function relabel() {
    setRelabelBusy(true); setRelabelRes(null);
    try {
      const r = await fetch("/api/admin/pharmacies/relabel-network", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setRelabelRes({ ok: false, text: d.error || "Failed." }); return; }
      setRelabelRes({ ok: true, text: `Relabeled ${d.pharmacies} pharmacy row(s) and ${d.orders} order routing(s) to Weno.` });
    } catch { setRelabelRes({ ok: false, text: "Request failed." }); } finally { setRelabelBusy(false); }
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Weno maintenance</h3>
      <p className="mt-0.5 text-xs text-slate-500">One-click helpers for production. Admin only.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg ring-1 ring-slate-200 p-3">
          <div className="text-sm font-medium text-slate-800">Apply Weno Online config</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Populates the Weno Online settings from this server&apos;s <span className="font-mono">WENO_ONLINE_*</span> environment variables (key, email, password, Location ID, optional NPI/DEA). Use this after each production deploy instead of hand-typing.</p>
          <button type="button" onClick={applyEnv} disabled={applyBusy} className="mt-2 btn-primary py-1.5 px-3 text-xs disabled:opacity-60">{applyBusy ? "Applying…" : "Apply from environment"}</button>
          {applyRes && <div className={`mt-2 text-[11px] ${applyRes.ok ? "text-emerald-700" : "text-rose-600"}`}>{applyRes.text}</div>}
        </div>

        <div className="rounded-lg ring-1 ring-slate-200 p-3">
          <div className="text-sm font-medium text-slate-800">Relabel pharmacies → Weno</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Updates any leftover pharmacy/order rows still tagged with the retired &quot;surescripts&quot; network to &quot;weno&quot;. Safe to run repeatedly.</p>
          <button type="button" onClick={relabel} disabled={relabelBusy} className="mt-2 btn-secondary py-1.5 px-3 text-xs disabled:opacity-60">{relabelBusy ? "Relabeling…" : "Relabel now"}</button>
          {relabelRes && <div className={`mt-2 text-[11px] ${relabelRes.ok ? "text-emerald-700" : "text-rose-600"}`}>{relabelRes.text}</div>}
        </div>
      </div>
    </div>
  );
}
