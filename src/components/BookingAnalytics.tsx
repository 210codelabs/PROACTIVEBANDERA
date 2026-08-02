"use client";

import React, { useEffect, useState } from "react";

type Stats = {
  total: number;
  byStatus: { pending: number; confirmed: number; declined: number };
  byType: { new: number; existing: number };
  byService: { service: string; count: number }[];
  scheduled: number;
  priority: number;
  last30: number;
  conversionRate: number;
};

export default function BookingAnalytics() {
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/appointments/request/stats", { cache: "no-store" });
        if (r.ok) setS(await r.json());
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-sm text-slate-500 mb-4">Loading analytics…</div>;
  if (!s || s.total === 0) return null;

  const maxSvc = Math.max(1, ...s.byService.map((x) => x.count));
  const newPct = s.total ? Math.round((s.byType.new / s.total) * 100) : 0;
  const existingPct = 100 - newPct;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total requests" value={s.total} tone="slate" />
        <Kpi label="Pending" value={s.byStatus.pending} tone="blue" />
        <Kpi label="Scheduled" value={s.scheduled} tone="indigo" />
        <Kpi label="Conversion" value={`${s.conversionRate}%`} tone="emerald" hint="scheduled ÷ total" />
        <Kpi label="Last 30 days" value={s.last30} tone="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* New vs Current */}
        <div className="card card-pad">
          <div className="text-sm font-semibold text-slate-800 mb-3">New vs Current patients</div>
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
            <div className="bg-slate-400" style={{ width: `${newPct}%` }} />
            <div className="bg-emerald-500" style={{ width: `${existingPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-2">
            <span><span className="inline-block h-2 w-2 rounded-full bg-slate-400 mr-1" />New: <b>{s.byType.new}</b> ({newPct}%)</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />Current: <b>{s.byType.existing}</b> ({existingPct}%)</span>
          </div>
          <div className="text-xs text-amber-700 mt-2">★ {s.priority} priority check-in{s.priority === 1 ? "" : "s"} (verified current patients)</div>
        </div>

        {/* Status breakdown */}
        <div className="card card-pad">
          <div className="text-sm font-semibold text-slate-800 mb-3">Status</div>
          <div className="space-y-2">
            <StatusRow label="Pending" value={s.byStatus.pending} total={s.total} color="bg-blue-500" />
            <StatusRow label="Confirmed" value={s.byStatus.confirmed} total={s.total} color="bg-emerald-500" />
            <StatusRow label="Declined" value={s.byStatus.declined} total={s.total} color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* By service */}
      <div className="card card-pad">
        <div className="text-sm font-semibold text-slate-800 mb-3">Requests by service</div>
        <div className="space-y-2">
          {s.byService.map((x) => (
            <div key={x.service} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm text-slate-600 truncate" title={x.service}>{x.service}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-3">
                <div className="bg-brand-500 h-3 rounded-full" style={{ width: `${Math.round((x.count / maxSvc) * 100)}%` }} />
              </div>
              <div className="w-8 text-right text-sm font-semibold text-slate-700">{x.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number | string; tone: string; hint?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-700", blue: "text-blue-700", indigo: "text-indigo-700", emerald: "text-emerald-700", amber: "text-amber-700",
  };
  return (
    <div className="card card-pad">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tones[tone]}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-sm text-slate-600">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-3"><div className={`${color} h-3 rounded-full`} style={{ width: `${pct}%` }} /></div>
      <div className="w-8 text-right text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}
