"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROVIDER_PALETTE } from "./palette";
import { openDayAgenda } from "@/lib/apptEvents";
import { patchAppointment, hasOverlap, toMin, STATUS_DOT, type CalAppt } from "./reschedule";

type WeekDay = { key: string; dow: string; dom: string; isToday: boolean };
type Toast = { kind: "ok" | "err"; text: string; undo?: () => void };

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
  const [toast, setToast] = useState<Toast | null>(null);

  const providerId = decodeURIComponent(providerQuery.match(/providerId=([^&]+)/)?.[1] || "") || undefined;

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const dayHref = (key: string) => `/schedule?view=day&d=${key}${providerQuery}`;
  const colorFor = (providerId: string) => PROVIDER_PALETTE[(providerColors[providerId] ?? 0) % PROVIDER_PALETTE.length];

  // Live conflict detection: would moving `appt` to `key` overlap another
  // appointment for the same provider at the same time-of-day?
  const dragAppt = dragId ? rows.find((a) => a.id === dragId) || null : null;
  function apptDayFree(appt: CalAppt, key: string): boolean {
    const busy = rows
      .filter((a) => a.id !== appt.id && a.dayKey === key && a.providerId === appt.providerId && a.status !== "cancelled" && a.status !== "no-show")
      .map((a) => ({ s: toMin(a.timeHHmm), e: toMin(a.timeHHmm) + a.durationMin }));
    return !hasOverlap(toMin(appt.timeHHmm), appt.durationMin, busy);
  }

  async function onDrop(targetKey: string) {
    const id = dragId;
    setOverDay(null);
    setDragId(null);
    if (!id) return;
    const appt = rows.find((a) => a.id === id);
    if (!appt || appt.dayKey === targetKey) return;
    const prev = rows;
    const origDay = appt.dayKey, origTime = appt.timeHHmm;
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, dayKey: targetKey } : r));
    // autoShift snaps to the nearest open time on the target day if the same
    // time-of-day clashes with another appointment for that provider.
    const res = await patchAppointment({ id, day: targetKey, time: appt.timeHHmm, autoShift: true });
    if (res.ok) {
      const label = days.find((d) => d.key === targetKey);
      const dayTxt = label ? label.dow + " " + label.dom : targetKey;
      const undo = () => { patchAppointment({ id, day: origDay, time: origTime, allowDoubleBook: true }).then(() => router.refresh()); setToast(null); };
      setToast({ kind: "ok", text: res.shifted ? `${appt.pLast || "Appointment"} moved to ${dayTxt} at ${res.time || ""} (nearest open)` : `Moved ${appt.pLast || "appointment"} to ${dayTxt}`, undo });
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
          const free = dragAppt ? apptDayFree(dragAppt, d.key) : true;
          return (
            <div
              key={d.key}
              onDragOver={(e) => { e.preventDefault(); if (overDay !== d.key) setOverDay(d.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && overDay === d.key) setOverDay(null); }}
              onDrop={() => onDrop(d.key)}
              onClick={() => openDayAgenda({ day: d.key, providerId })}
              title={`Click to view ${d.dow} ${d.dom} — appointments & open time slots`}
              className={`min-h-[240px] cursor-pointer transition-colors ${dragId && !isOver ? (free ? "bg-emerald-50/40" : "bg-rose-50/40") : ""} ${isOver ? (free ? "bg-emerald-50/70 ring-2 ring-inset ring-emerald-500" : "bg-rose-50/70 ring-2 ring-inset ring-rose-500") : ""}`}
            >
              <a href={dayHref(d.key)} onClick={(e) => e.stopPropagation()} className={`block px-2 py-2 border-b text-center hover:bg-slate-50 ${d.isToday ? "bg-brand-50 border-brand-200" : "border-slate-100"}`}>
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
                      onClick={(e) => { e.stopPropagation(); router.push(`/patients/${a.patientId}`); }}
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
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ${toast.kind === "ok" ? "bg-white text-emerald-800 ring-emerald-200" : "bg-white text-rose-800 ring-rose-200"}`}>
          <span>{toast.kind === "ok" ? "✓ " : "⚠ "}{toast.text}</span>
          {toast.undo && <button onClick={toast.undo} className="text-brand-600 font-semibold hover:underline">Undo</button>}
        </div>
      )}
    </div>
  );
}
