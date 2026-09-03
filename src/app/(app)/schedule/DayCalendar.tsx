"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colorForApptStatus, colorForCategory } from "@/lib/utils";
import { openApptWidget } from "@/lib/apptEvents";
import CheckInButton from "@/components/billing/CheckInButton";
import CopayButton from "@/components/billing/CopayButton";
import {
  patchAppointment, buildSlotList, slotIsFree, toMin, GRID_START_HOUR, GRID_SLOTS, SLOT_PX,
  type CalAppt, type Busy,
} from "./reschedule";

function money(c: number) { return "$" + (c / 100).toFixed(2); }

type Toast = { kind: "ok" | "err"; text: string; undo?: () => void };

// Rich single-day view: a 9AM–8PM Central time-slot grid where appointments can
// be dragged to a different time (reschedule) and empty slots clicked to create.
export default function DayCalendar({ dayKey, appts: initial, copay, balance }: {
  dayKey: string;
  appts: CalAppt[];
  copay: Record<string, string>;
  balance: Record<string, number>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CalAppt[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const slots = useMemo(() => buildSlotList(), []);

  // Live conflict detection: while dragging, the target provider's other
  // appointments become "busy" intervals so we can mark open (green) vs
  // clashing (red) slots and block a drop that would double-book.
  const dragAppt = dragId ? rows.find((a) => a.id === dragId) || null : null;
  const busy: Busy[] = dragAppt
    ? rows
        .filter((a) => a.id !== dragAppt.id && a.providerId === dragAppt.providerId && a.status !== "cancelled" && a.status !== "no-show")
        .map((a) => ({ s: toMin(a.timeHHmm), e: toMin(a.timeHHmm) + a.durationMin }))
    : [];
  function slotFreeAt(i: number): boolean {
    if (!dragAppt) return true;
    return slotIsFree(GRID_START_HOUR * 60 + i * 30, dragAppt.durationMin, busy);
  }

  function slotFromY(clientY: number, rectTop: number): number {
    const y = clientY - rectTop;
    return Math.max(0, Math.min(GRID_SLOTS - 1, Math.floor(y / SLOT_PX)));
  }

  async function doDrop(clientY: number, rectTop: number) {
    const id = dragId;
    setDragId(null);
    setOverSlot(null);
    if (!id) return;
    const idx = slotFromY(clientY, rectTop);
    const slot = slots[idx];
    const appt = rows.find((a) => a.id === id);
    if (!appt || appt.timeHHmm === slot.hhmm) return;
    const prev = rows;
    const origTime = appt.timeHHmm;
    // optimistic move
    setRows((rs) => rs.map((r) => r.id === id
      ? { ...r, timeHHmm: slot.hhmm, top: idx * SLOT_PX, startLabel: slot.label }
      : r));
    // autoShift: if the target clashes/out-of-hours, the server snaps to the
    // closest open slot that day instead of failing the drop.
    const res = await patchAppointment({ id, day: dayKey, time: slot.hhmm, autoShift: true });
    if (res.ok) {
      const undo = () => { patchAppointment({ id, day: dayKey, time: origTime, allowDoubleBook: true }).then(() => router.refresh()); setToast(null); };
      const landed = res.time ? slots.find((s) => s.hhmm === res.time)?.label || slot.label : slot.label;
      setToast({ kind: "ok", text: res.shifted ? `${appt.pLast || "Appointment"} moved to ${landed} (nearest open)` : `Moved ${appt.pLast || "appointment"} to ${landed}`, undo });
      router.refresh();
    } else {
      setRows(prev);
      setToast({ kind: "err", text: (res.error || "Could not reschedule").slice(0, 140) });
    }
  }

  function newAt(hhmm: string) {
    openApptWidget({ mode: "new", day: dayKey, time: hhmm });
  }

  return (
    <div className="grid grid-cols-12 divide-x divide-slate-100">
      <div className="col-span-2">
        {slots.map((s) => (
          <div key={s.hhmm} className="h-16 px-3 py-1 text-xs font-mono text-slate-500 border-b border-slate-100">{s.label}</div>
        ))}
      </div>
      <div
        className="col-span-10 relative"
        onDragOver={(e) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setOverSlot(slotFromY(e.clientY, rect.top)); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverSlot(null); }}
        onDrop={(e) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); doDrop(e.clientY, rect.top); }}
      >
        {slots.map((s) => (
          <div key={s.hhmm} className={`h-16 border-b border-slate-100 group relative cursor-pointer ${dragId ? (slotFreeAt(s.i) ? "bg-emerald-50/70" : "bg-rose-50/60") : "hover:bg-brand-50/40"}`} onClick={() => newAt(s.hhmm)}>
            <span className="pointer-events-none absolute inset-0 hidden group-hover:flex items-center justify-center text-[11px] font-medium text-brand-500">+ New at {s.label}</span>
          </div>
        ))}
        {overSlot !== null && dragId && (
          <div className={`pointer-events-none absolute left-0 right-0 h-16 ring-2 ring-inset rounded ${slotFreeAt(overSlot) ? "ring-emerald-500 bg-emerald-50/70" : "ring-rose-500 bg-rose-50/70"}`} style={{ top: overSlot * SLOT_PX }} />
        )}
        <div className="absolute inset-0 p-2 pointer-events-none">
          {rows.map((a) => (
            <div key={a.id} className="absolute left-2 right-2 pointer-events-auto" style={{ top: a.top, height: a.height }}>
              <div
                draggable
                onDragStart={() => setDragId(a.id)}
                onDragEnd={() => { setDragId(null); setOverSlot(null); }}
                title="Drag to another time slot to reschedule"
                className={`relative h-full rounded-md bg-white ring-1 ring-brand-200 shadow-sm hover:shadow-md hover:ring-brand-400 transition px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing ${dragId === a.id ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">{a.startLabel}</span><span>–</span><span>{a.endLabel}</span>
                  {balance[a.patientId] ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200 font-semibold" title="Outstanding balance">Bal {money(balance[a.patientId])}</span> : null}
                  <span className={`chip ml-auto ${colorForApptStatus(a.status)}`}>{a.status}</span>
                </div>
                <button type="button" onClick={() => router.push(`/patients/${a.patientId}`)} className="block w-full text-left">
                  <div className="text-sm font-semibold text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                  <div className="text-xs text-slate-600 truncate flex items-center gap-1">
                    {a.svcName && <span className={`chip ${colorForCategory(a.svcCat || "")}`}>{a.svcName}</span>}
                    {a.reason && !a.svcName && <span>{a.reason}</span>}
                    <span className="ml-auto">{a.provLast}</span>
                  </div>
                </button>
                <div className="absolute bottom-1 left-1 z-10"><CheckInButton appointmentId={a.id} status={a.status} /></div>
                <div className="absolute bottom-1 right-1 z-10"><CopayButton patientId={a.patientId} patientName={`${a.pLast}, ${a.pFirst}`} amountDefault={copay[a.patientId] || ""} /></div>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">Hover a time slot and click to add an appointment.</div>
          )}
        </div>
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
