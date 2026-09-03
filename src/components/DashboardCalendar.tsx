"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import MonthCalendar, { type MAppt } from "@/app/(app)/schedule/MonthCalendar";
import { PROVIDER_PALETTE } from "@/app/(app)/schedule/palette";

type Prov = { id: string; name: string };

/**
 * Full-width, navigable month calendar for the main dashboard.
 * - Uses server-provided appointments for the first paint (no flash).
 * - Client-side month navigation + provider filter re-fetch via /api/appointments.
 * - Renders the shared MonthCalendar (drag-to-reschedule, day links) + a provider color legend.
 */
export default function DashboardCalendar({
  initialAppts,
  providers,
  providerColors,
  initialMonthISO,
}: {
  initialAppts: MAppt[];
  providers: Prov[];
  providerColors: Record<string, number>;
  initialMonthISO: string;
}) {
  const [month, setMonth] = useState<Date>(new Date(initialMonthISO));
  const [providerId, setProviderId] = useState<string>("");
  const [appts, setAppts] = useState<MAppt[]>(initialAppts);
  const [loading, setLoading] = useState(false);
  const firstLoad = useRef(true);

  const range = useMemo(() => {
    const s = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const e = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return { s, e };
  }, [month]);

  const fetchAppts = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ from: format(range.s, "yyyy-MM-dd"), to: format(range.e, "yyyy-MM-dd") });
      if (providerId) qp.set("providerId", providerId);
      const r = await fetch(`/api/appointments?${qp.toString()}`);
      const d = await r.json();
      const mapped: MAppt[] = (d.appointments || []).map((a: any) => {
        const [pl, pf] = String(a.patientName || "").split(",").map((s: string) => s.trim());
        const provTokens = String(a.providerName || "").trim().split(" ");
        return {
          id: a.id,
          patientId: a.patientId,
          providerId: a.providerId,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          status: a.status,
          pFirst: pf || "",
          pLast: pl || "",
          provLast: provTokens[provTokens.length - 1] || "",
          svcName: a.serviceName || null,
        } as MAppt;
      });
      setAppts(mapped);
    } catch {
      /* keep previous appts on failure */
    } finally {
      setLoading(false);
    }
  }, [range, providerId]);

  // Skip the very first run (server already provided initialAppts); fetch on any later change.
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    fetchAppts();
  }, [fetchAppts]);

  // Refresh when an appointment is created/edited anywhere (widget, drag).
  useEffect(() => {
    const h = () => fetchAppts();
    window.addEventListener("appt:changed", h);
    return () => window.removeEventListener("appt:changed", h);
  }, [fetchAppts]);

  const monthISO = month.toISOString();
  const startISO = range.s.toISOString();
  const endISO = range.e.toISOString();
  const providerQuery = providerId ? `&providerId=${providerId}` : "";

  const presentIds = new Set(appts.map((a) => a.providerId));
  const legend = providers.filter((p) => presentIds.has(p.id));

  return (
    <div>
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-nowrap overflow-x-auto">
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="btn-secondary shrink-0" aria-label="Previous month">←</button>
          <button onClick={() => setMonth(new Date())} className="btn-secondary shrink-0 whitespace-nowrap">Today</button>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="btn-secondary shrink-0" aria-label="Next month">→</button>
        </div>
        <div className="ml-1 text-base font-semibold text-brand-900 whitespace-nowrap shrink-0">{format(month, "MMMM yyyy")}</div>
        {loading && <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">Loading…</span>}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="input w-[150px] shrink-0">
            <option value="">All providers</option>
            {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <span className="inline-flex items-center rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0">Month</span>
          <a href="/schedule" className="btn-secondary whitespace-nowrap shrink-0">Open schedule →</a>
        </div>
      </div>

      <MonthCalendar
        monthISO={monthISO}
        startISO={startISO}
        endISO={endISO}
        appts={appts}
        providerColors={providerColors}
        providerQuery={providerQuery}
      />

      {legend.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Providers</span>
          {legend.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-sm ${PROVIDER_PALETTE[(providerColors[p.id] ?? 0) % PROVIDER_PALETTE.length].legend}`} />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
