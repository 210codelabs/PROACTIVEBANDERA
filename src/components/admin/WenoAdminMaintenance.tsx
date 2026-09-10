"use client";

import { useState } from "react";

type Result = { ok: boolean; text: string };

export default function WenoAdminMaintenance() {
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyRes, setApplyRes] = useState<Result | null>(null);
  const [relabelBusy, setRelabelBusy] = useState(false);
  const [relabelRes, setRelabelRes] = useState<Result | null>(null);
  const [dirBusy, setDirBusy] = useState<"full" | "daily" | null>(null);
  const [dirRes, setDirRes] = useState<Result | null>(null);

  async function syncDirectory(daily: boolean) {
    setDirBusy(daily ? "daily" : "full"); setDirRes(null);
    try {
      const r = await fetch("/api/admin/weno/directory/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily }) });
      const d = await r.json();
      if (!r.ok) { setDirRes({ ok: false, text: d.error || "Directory sync failed." }); return; }
      setDirRes({ ok: true, text: `${daily ? "Daily" : "Full"} sync complete — ${d.total?.toLocaleString?.() || d.total} pharmacies in directory (${d.upserted} updated${d.removed ? `, ${d.removed} removed` : ""}).` });
    } catch { setDirRes({ ok: false, text: "Request failed." }); } finally { setDirBusy(null); }
  }

  async function applyEnv() {
    setApplyBusy(true); setApplyRes(null);
    try {
      const r = await fetch("/api/admin/weno/online/apply-env", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setApplyRes({ ok: false, text: d.error || "Failed to apply." }); return; }
      setApplyRes({ ok: true, text: `Applied ${d.applied?.length || 0} setting(s) from environment: ${(d.applied || []).join(", ")}. Weno EZ Integration is now enabled.` });
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
      <h3 className="text-sm font-semibold text-slate-900">Weno EZ Integration maintenance</h3>
      <p className="mt-0.5 text-xs text-slate-500">One-click helpers for production. Admin only.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg ring-1 ring-slate-200 p-3 sm:col-span-2">
          <div className="text-sm font-medium text-slate-800">Weno pharmacy directory (real NCPDP IDs)</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Downloads Weno&apos;s EZ LITE pharmacy directory so the e-Prescribe pharmacy search has real pharmacies with NCPDP IDs (auto-fills the ComposeRx destination). Run a <span className="font-medium">Full sync</span> now and weekly; run <span className="font-medium">Daily changes</span> nightly to stay current.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => syncDirectory(false)} disabled={dirBusy !== null} className="btn-primary py-1.5 px-3 text-xs disabled:opacity-60">{dirBusy === "full" ? "Syncing full directory…" : "Full sync now"}</button>
            <button type="button" onClick={() => syncDirectory(true)} disabled={dirBusy !== null} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-60">{dirBusy === "daily" ? "Syncing daily changes…" : "Daily changes"}</button>
          </div>
          {dirRes && <div className={`mt-2 text-[11px] ${dirRes.ok ? "text-emerald-700" : "text-rose-600"}`}>{dirRes.text}</div>}
        </div>

        <div className="rounded-lg ring-1 ring-slate-200 p-3">
          <div className="text-sm font-medium text-slate-800">Apply Weno EZ Integration config</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Populates the Weno EZ Integration settings from this server&apos;s <span className="font-mono">WENO_ONLINE_*</span> environment variables (key, email, password, Location ID, optional NPI/DEA). Use this after each production deploy instead of hand-typing.</p>
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
