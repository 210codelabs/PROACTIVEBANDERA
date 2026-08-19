"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROVIDER_PALETTE } from "./palette";
import { patchAppointment, STATUS_DOT, type CalAppt } from "./reschedule";

type WeekDay = { key: string; dow: string; dom: string; isToday: boolean };

// Week view: 7 day columns. Drag an appointment to another day to reschedule
// (time-of-day preserved, only the date changes).
export default function WeekCalendar({ days, appts: initial, providerColors, providerQuery }: {
  days: WeekDay[];
  appts: CalAppt[];
  providerColors: Record<string, number>;
  providerQuery: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CalAppt[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const dayHref = (key: string) => `/schedule?view=day&d=${key}${providerQuery}`;
  const colorFor = (providerId: string) => PROVIDER_PALETTE[(providerColors[providerId] ?? 0) % PROVIDER_PALETTE.length];

  async function onDrop(targetKey: string) {
    const id = dragId;
    setOverDay(null);
    setDragId(null);
    if (!id) return;
    const appt = rows.find((a) => a.id === id);
    if (!appt || appt.dayKey === targetKey) return;
    const prev = rows;
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, dayKey: targetKey } : r));
    const res = await patchAppointment({ id, day: targetKey, time: appt.timeHHmm });
    if (res.ok) {
      const label = days.find((d) => d.key === targetKey);
      setToast({ kind: "ok", text: `Moved ${appt.pLast || "appointment"} to ${label ? label.dow + " " + label.dom : targetKey}` });
      router.refresh();
    } else {
      setRows(prev);
      setToast({ kind: "err", text: (res.error || "Could not reschedule").slice(0, 140) });
    }
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {days.map((d) => {
          const list = rows.filter((a) => a.dayKey === d.key).sort((x, y) => x.timeHHmm.localeCompare(y.timeHHmm));
          const isOver = overDay === d.key;
          return (
            <div
              key={d.key}
              onDragOver={(e) => { e.preventDefault(); if (overDay !== d.key) setOverDay(d.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && overDay === d.key) setOverDay(null); }}
              onDrop={() => onDrop(d.key)}
              className={`min-h-[240px] transition-colors ${isOver ? "bg-brand-50/70 ring-2 ring-inset ring-brand-400" : ""}`}
            >
              <a href={dayHref(d.key)} className={`block px-2 py-2 border-b text-center hover:bg-slate-50 ${d.isToday ? "bg-brand-50 border-brand-200" : "border-slate-100"}`}>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{d.dow}</div>
                <div className={`text-lg font-semibold ${d.isToday ? "text-brand-700" : "text-slate-800"}`}>{d.dom}</div>
                <div className="text-[10px] text-slate-400">{list.length} appt{list.length === 1 ? "" : "s"}</div>
              </a>
              <div className="p-1.5 space-y-1">
                {list.map((a) => {
                  const c = colorFor(a.providerId);
                  return (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => { setDragId(null); setOverDay(null); }}
                      onClick={() => router.push(`/patients/${a.patientId}`)}
                      title={`${a.pLast}, ${a.pFirst} · ${a.svcName || a.reason || "Visit"} · ${a.provLast} — drag to another day to reschedule`}
                      className={`block rounded-md ring-1 ring-slate-200 bg-white hover:ring-brand-400 px-2 py-1 border-l-2 cursor-grab active:cursor-grabbing ${c.border} ${dragId === a.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[a.status] || STATUS_DOT.scheduled}`} />
                        <span className="text-[11px] font-semibold text-slate-700">{a.startLabel}</span>
                      </div>
                      <div className="text-xs font-medium text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                      <div className="text-[10px] text-slate-500 truncate">{a.svcName || a.reason || "Visit"} · {a.provLast}</div>
                    </div>
                  );
                })}
                {list.length === 0 && <div className="text-center text-[11px] text-slate-300 py-4">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ${toast.kind === "ok" ? "bg-white text-emerald-800 ring-emerald-200" : "bg-white text-rose-800 ring-rose-200"}`}>
          {toast.kind === "ok" ? "✓ " : "⚠ "}{toast.text}
        </div>
      )}
    </div>
  );
}
