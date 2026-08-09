"use client";

import React, { useCallback, useEffect, useState } from "react";

/**
 * Per-patient coverage timeline — every saved eligibility (270/271) check in
 * reverse-chronological order, flagging when the coverage status changed from
 * the previous check so staff can see when coverage lapsed or was restored.
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
  checkedByName?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  inactive: "bg-slate-200 text-slate-700 ring-slate-300",
  error: "bg-rose-100 text-rose-800 ring-rose-200",
  unknown: "bg-amber-100 text-amber-800 ring-amber-200",
};
const DOT: Record<string, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  error: "bg-rose-500",
  unknown: "bg-amber-500",
};

export default function CoverageHistory({ patientId }: { patientId: string }) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/stedi/eligibility?patientId=${patientId}`);
      if (r.ok) { const d = await r.json(); setChecks(d.checks || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-slate-400">Loading coverage history…</p>;
  if (checks.length === 0) return <p className="text-sm text-slate-500">No eligibility checks recorded yet.</p>;

  return (
    <ol className="relative border-l border-slate-200 pl-4 space-y-4">
      {checks.map((c, i) => {
        const older = checks[i + 1];
        const changed = older && older.status !== c.status;
        const copay = c.summary?.find((s) => /co-?pay/i.test(s.label))?.value;
        return (
          <li key={c.id} className="relative">
            <span className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${DOT[c.status] || DOT.unknown}`} />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ring-1 ${STATUS_STYLE[c.status] || STATUS_STYLE.unknown}`}>{c.status.toUpperCase()}</span>
              {changed && (
                <span className="chip bg-indigo-100 text-indigo-800 ring-indigo-200">changed from {older.status}</span>
              )}
              <span className="text-sm font-medium text-slate-800">{c.payerName || c.payerId}</span>
              {c.planName && <span className="text-xs text-slate-500">· {c.planName}</span>}
              {copay && <span className="text-xs text-slate-500">· copay {copay}</span>}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {new Date(c.createdAt).toLocaleString()}
              {c.memberId ? ` · member ${c.memberId}` : ""}
              {c.checkedByName ? ` · by ${c.checkedByName}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
