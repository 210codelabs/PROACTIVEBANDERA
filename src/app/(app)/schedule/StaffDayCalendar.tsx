"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colorForApptStatus } from "@/lib/utils";
import {
  patchAppointment, buildSlotList, GRID_SLOTS, SLOT_PX, STATUS_DOT, type CalAppt,
} from "./reschedule";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };

// Staff (resource) view: one time-grid column per provider for a single day.
// Drag an appointment vertically to change its time, or across columns to
// reassign it to a different provider (and change the time in one move).
export default function StaffDayCalendar({ dayKey, providers, appts: initial }: {
  dayKey: string;
  providers: Provider[];
  appts: CalAppt[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CalAppt[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ prov: string; slot: number } | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const slots = useMemo(() => buildSlotList(), []);

  function slotFromY(clientY: number, rectTop: number): number {
    const y = clientY - rectTop;
    return Math.max(0, Math.min(GRID_SLOTS - 1, Math.floor(y / SLOT_PX)));
  }

  async function doDrop(provId: string, clientY: number, rectTop: number) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id) return;
    const idx = slotFromY(clientY, rectTop);
    const slot = slots[idx];
    const appt = rows.find((a) => a.id === id);
    if (!appt) return;
    if (appt.providerId === provId && appt.timeHHmm === slot.hhmm) return;
    const prev = rows;
    setRows((rs) => rs.map((r) => r.id === id
      ? { ...r, providerId: provId, timeHHmm: slot.hhmm, top: idx * SLOT_PX, startLabel: slot.label }
      : r));
    const changedProv = appt.providerId !== provId;
    const res = await patchAppointment({ id, day: dayKey, time: slot.hhmm, ...(changedProv ? { providerId: provId } : {}) });
    if (res.ok) {
      const p = providers.find((x) => x.id === provId);
      setToast({ kind: "ok", text: `Moved ${appt.pLast || "appointment"} to ${slot.label}${changedProv && p ? ` · ${p.firstName} ${p.lastName}` : ""}` });
      router.refresh();
    } else {
      setRows(prev);
      setToast({ kind: "err", text: (res.error || "Could not reschedule").slice(0, 140) });
    }
  }

  if (providers.length === 0) return <div className="p-8 text-center text-sm text-slate-400">No active providers to display.</div>;

  return (
    <div className="relative overflow-x-auto">
      <div className="flex min-w-max">
        {/* time gutter */}
        <div className="w-20 shrink-0 border-r border-slate-100">
          <div className="h-10 border-b border-slate-100" />
          {slots.map((s) => <div key={s.hhmm} className="h-16 px-2 py-1 text-[11px] font-mono text-slate-500 border-b border-slate-100">{s.label}</div>)}
        </div>
        {providers.map((prov) => {
          const list = rows.filter((a) => a.providerId === prov.id);
          return (
            <div key={prov.id} className="w-56 shrink-0 border-r border-slate-100">
              <div className="h-10 px-2 grid place-items-center border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 truncate">{prov.firstName} {prov.lastName}{prov.credential ? `, ${prov.credential}` : ""}</div>
              <div
                className="relative"
                onDragOver={(e) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setOver({ prov: prov.id, slot: slotFromY(e.clientY, rect.top) }); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o && o.prov === prov.id ? null : o)); }}
                onDrop={(e) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); doDrop(prov.id, e.clientY, rect.top); }}
              >
                {slots.map((s) => <div key={s.hhmm} className="h-16 border-b border-slate-100" />)}
                {over && over.prov === prov.id && dragId && (
                  <div className="pointer-events-none absolute left-0 right-0 h-16 ring-2 ring-inset ring-brand-400 bg-brand-50/60" style={{ top: over.slot * SLOT_PX }} />
                )}
                <div className="absolute inset-0 p-1 pointer-events-none">
                  {list.map((a) => (
                    <div key={a.id} className="absolute left-1 right-1 pointer-events-auto" style={{ top: a.top, height: a.height }}>
                      <div
                        draggable
                        onDragStart={() => setDragId(a.id)}
                        onDragEnd={() => { setDragId(null); setOver(null); }}
                        onClick={() => router.push(`/patients/${a.patientId}`)}
                        title={`${a.pLast}, ${a.pFirst} — drag to another time or provider column`}
                        className={`h-full rounded-md bg-white ring-1 ring-brand-200 shadow-sm hover:ring-brand-400 px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing ${dragId === a.id ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[a.status] || STATUS_DOT.scheduled}`} />
                          <span className="font-semibold text-slate-700">{a.startLabel}</span>
                          <span className={`chip ml-auto ${colorForApptStatus(a.status)}`}>{a.status}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                        {a.svcName && <div className="text-[10px] text-slate-500 truncate">{a.svcName}</div>}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <div className="absolute inset-x-0 top-2 text-center text-[11px] text-slate-300">—</div>}
                </div>
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
