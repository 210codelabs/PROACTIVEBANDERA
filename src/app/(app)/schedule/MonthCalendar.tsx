"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  eachDayOfInterval, format, isSameDay, isSameMonth, parseISO,
} from "date-fns";
import { PROVIDER_PALETTE } from "./palette";
import { openDayAgenda } from "@/lib/apptEvents";

export type MAppt = {
  id: string; patientId: string; providerId: string;
  startsAt: string; endsAt: string; status: string;
  pFirst: string; pLast: string; provLast: string; svcName: string | null;
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-slate-400", "checked-in": "bg-amber-500", "in-room": "bg-violet-500",
  completed: "bg-emerald-500", "no-show": "bg-rose-500", cancelled: "bg-slate-300",
};

// Coverage (Stedi eligibility) indicator — reused across the app.
const COVERAGE_DOT: Record<string, string> = {
  ok: "bg-emerald-500", stale: "bg-amber-500", lapsed: "bg-rose-500", none: "bg-slate-300",
};
const COVERAGE_LABEL: Record<string, string> = {
  ok: "Coverage active", stale: "Coverage stale", lapsed: "Coverage not confirmed", none: "No eligibility on file",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthCalendar({
  monthISO, startISO, endISO, appts: initial, providerColors, providerQuery, coverage = {},
}: {
  monthISO: string; startISO: string; endISO: string;
  appts: MAppt[];
  providerColors: Record<string, number>;
  providerQuery: string;
  coverage?: Record<string, "ok" | "stale" | "lapsed" | "none">;
}) {
  const router = useRouter();
  const dayHref = (iso: string) => `/schedule?view=day&d=${iso}${providerQuery}`;
  const providerId = decodeURIComponent(providerQuery.match(/providerId=([^&]+)/)?.[1] || "") || undefined;
  const month = parseISO(monthISO);
  const [appts, setAppts] = useState<MAppt[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string; undo?: () => void } | null>(null);

  useEffect(() => setAppts(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const days = useMemo(() => eachDayOfInterval({ start: parseISO(startISO), end: parseISO(endISO) }), [startISO, endISO]);

  const colorFor = (providerId: string) => PROVIDER_PALETTE[(providerColors[providerId] ?? 0) % PROVIDER_PALETTE.length];

  async function onDrop(targetKey: string) {
    const id = dragId;
    setOverDay(null);
    setDragId(null);
    if (!id) return;
    const appt = appts.find((a) => a.id === id);
    if (!appt) return;
    const currentKey = format(parseISO(appt.startsAt), "yyyy-MM-dd");
    if (currentKey === targetKey) return;

    // Preserve time-of-day; only the date changes.
    const start = parseISO(appt.startsAt);
    const end = parseISO(appt.endsAt);
    const durMs = end.getTime() - start.getTime();
    const time = format(start, "HH:mm");
    const newStart = parseISO(`${targetKey}T${time}:00`);
    const prev = appts;
    // optimistic update
    setAppts((rows) => rows.map((r) => r.id === id
      ? { ...r, startsAt: newStart.toISOString(), endsAt: new Date(newStart.getTime() + durMs).toISOString() }
      : r));

    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, day: targetKey, time, autoShift: true }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Reschedule failed");
      const undo = () => { fetch("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, day: currentKey, time, allowDoubleBook: true }) }).then(() => router.refresh()); setToast(null); };
      setToast({ kind: "ok", text: d.shifted ? `${appt.pLast || "Appointment"} moved to ${format(newStart, "EEE, MMM d")} at ${d.time || ""} (nearest open)` : `Moved ${appt.pLast || "appointment"} to ${format(newStart, "EEE, MMM d")}`, undo });
      router.refresh();
    } catch (e: any) {
      setAppts(prev); // revert
      setToast({ kind: "err", text: String(e?.message || "Could not reschedule").slice(0, 120) });
    }
  }

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAYS.map((w) => <div key={w} className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, month);
          const today = isSameDay(d, new Date());
          const list = appts.filter((a) => isSameDay(parseISO(a.startsAt), d))
            .sort((x, y) => parseISO(x.startsAt).getTime() - parseISO(y.startsAt).getTime());
          const isOver = overDay === key;
          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault(); if (overDay !== key) setOverDay(key); }}
              onDragLeave={() => { if (overDay === key) setOverDay(null); }}
              onDrop={() => onDrop(key)}
              onClick={() => openDayAgenda({ day: key, providerId })}
              title={`Click to view ${format(d, "EEE, MMM d")} — appointments & open time slots`}
              className={`min-h-[116px] border-b border-r border-slate-100 p-1 cursor-pointer transition-colors ${inMonth ? "bg-white" : "bg-slate-50/60"} ${isOver ? "ring-2 ring-inset ring-brand-400 bg-brand-50/60" : ""}`}
            >
              <div className="flex items-center justify-between px-1">
                <a href={dayHref(key)} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  <span className={`text-xs font-semibold ${today ? "grid place-items-center h-6 w-6 rounded-full bg-brand-600 text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{format(d, "d")}</span>
                </a>
                {list.length > 0 && <span className="text-[10px] text-slate-400">{list.length}</span>}
              </div>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 4).map((a) => {
                  const c = colorFor(a.providerId);
                  return (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => { setDragId(null); setOverDay(null); }}
                      onClick={(e) => { e.stopPropagation(); router.push(`/patients/${a.patientId}`); }}
                      title={`${a.pLast}, ${a.pFirst} · ${a.svcName || "Visit"} · ${a.provLast} — drag to another day to reschedule`}
                      className={`group flex items-center gap-1 rounded px-1 py-0.5 border-l-2 cursor-grab active:cursor-grabbing hover:brightness-95 ${c.bg} ${c.border} ${dragId === a.id ? "opacity-50" : ""}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[a.status] || STATUS_DOT.scheduled}`} title={a.status} />
                      <span className="text-[10px] text-slate-700 truncate">{format(parseISO(a.startsAt), "h:mm a")} {a.pLast}</span>
                      {coverage[a.patientId] && (
                        <span className={`ml-auto h-1.5 w-1.5 rounded-sm shrink-0 ${COVERAGE_DOT[coverage[a.patientId]] || COVERAGE_DOT.none}`} title={COVERAGE_LABEL[coverage[a.patientId]] || "Coverage"} />
                      )}
                    </div>
                  );
                })}
                {list.length > 4 && <a href={dayHref(key)} onClick={(e) => e.stopPropagation()} className="block text-[10px] text-brand-600 px-1 hover:underline">+{list.length - 4} more</a>}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ${toast.kind === "ok" ? "bg-white text-emerald-800 ring-emerald-200" : "bg-white text-rose-800 ring-rose-200"}`}>
          <span>{toast.kind === "ok" ? "✓ " : "⚠ "}{toast.text}</span>
          {toast.undo && <button onClick={toast.undo} className="text-brand-600 font-semibold hover:underline">Undo</button>}
        </div>
      )}
    </div>
  );
}
