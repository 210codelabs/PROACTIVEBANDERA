"use client";

import React, { useCallback, useEffect, useState } from "react";

/**
 * Compact coverage card for the patient chart header. Shows the latest saved
 * Stedi eligibility (270/271) result — status, payer/plan, copay and "as of"
 * date — and a one-click Re-verify button. Flags coverage that is inactive,
 * rejected, or stale so front desk sees it at check-in.
 */

type Summary = { label: string; value: string };
type Check = {
  id: string;
  status: string;
  payerId: string;
  payerName?: string | null;
  planName?: string | null;
  memberId?: string | null;
  summary?: Summary[] | null;
  createdAt: string;
};

const STALE_DAYS = 30;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  inactive: "bg-slate-200 text-slate-700 ring-slate-300",
  error: "bg-rose-100 text-rose-800 ring-rose-200",
  unknown: "bg-amber-100 text-amber-800 ring-amber-200",
};

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default function PatientCoverage({ patientId }: { patientId: string }) {
  const [latest, setLatest] = useState<Check | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/stedi/eligibility?patientId=${patientId}`);
      if (r.ok) {
        const d = await r.json();
        const checks: Check[] = d.checks || [];
        // Prefer the most recent ACTIVE (valid) coverage so a later failed /
        // misspelled attempt never hides the last known-good insurance. Fall
        // back to the latest attempt only if there has never been an active one.
        const active = checks.find((c) => c.status === "active") || null;
        setLatest(active || checks[0] || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  async function reverify() {
    setBusy(true);
    setErr(null);
    try {
      // Re-verify the coverage currently shown (the active-on-file payer + member),
      // never the errored attempt.
      const r = await fetch("/api/stedi/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, payerId: latest?.payerId, payerName: latest?.payerName, memberId: latest?.memberId }),
      });
      const d = await r.json();
      if (d.error && !d.check) setErr(d.error);
      await load();
    } catch {
      setErr("Could not reach the eligibility service.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="w-full max-w-[280px] rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-[11px] text-slate-400">Loading coverage…</div>;
  }

  const isActive = latest?.status === "active";
  const stale = latest ? daysSince(latest.createdAt) > STALE_DAYS : false;
  const firstNext = latest ? new Date(new Date(latest.createdAt).getFullYear(), new Date(latest.createdAt).getMonth() + 1, 1).getTime() : 0;
  const crossedMonth = latest ? Date.now() >= firstNext : false;
  const needsReverify = isActive && (stale || crossedMonth);
  // Only truly "lapsed" when there is NO active coverage to show.
  const lapsed = latest ? latest.status === "inactive" || latest.status === "error" : false;
  const copay = latest?.summary?.find((s) => /co-?pay/i.test(s.label))?.value;

  return (
    <div className={`w-full max-w-[280px] rounded-lg border px-3 py-2 text-left ${lapsed ? "border-rose-200 bg-rose-50/60" : needsReverify ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white/80"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Coverage</span>
        <button
          type="button"
          onClick={reverify}
          disabled={busy}
          className="text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
          title="Re-run a live Stedi eligibility check"
        >
          {busy ? "Verifying…" : "Re-verify"}
        </button>
      </div>

      {!latest ? (
        <p className="mt-1 text-[11px] text-slate-500">No eligibility check on file. Click Re-verify to check now.</p>
      ) : (
        <div className="mt-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ring-1 ${STATUS_STYLE[latest.status] || STATUS_STYLE.unknown}`}>{latest.status.toUpperCase()}</span>
            <span className="text-[11px] font-medium text-slate-800 truncate max-w-[160px]" title={latest.payerName || latest.payerId}>{latest.payerName || latest.payerId}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
            {latest.planName && <span>{latest.planName}</span>}
            {copay && <span>Copay <span className="font-semibold text-slate-800">{copay}</span></span>}
          </div>
          <div className="text-[10px] text-slate-400">
            As of {new Date(latest.createdAt).toLocaleDateString()}
            {needsReverify && <span className="ml-1 font-semibold text-amber-700">· re-verify ({crossedMonth ? "new month" : "30d+"})</span>}
          </div>
          {lapsed && (
            <div className="text-[10px] font-semibold text-rose-700">Coverage not confirmed — verify before the visit.</div>
          )}
        </div>
      )}

      {err && <div className="mt-1 text-[10px] text-rose-600">{err}</div>}
    </div>
  );
}
