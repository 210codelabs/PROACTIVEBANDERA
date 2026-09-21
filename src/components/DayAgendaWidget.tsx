"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DAY_AGENDA_OPEN, APPT_CHANGED, type DayAgendaDetail,
  openApptWidget, notifyApptChanged,
} from "@/lib/apptEvents";
import { PROVIDER_PALETTE } from "@/app/(app)/schedule/palette";
import { clinicDayKey, clinicHHmm, clinicTimeLabel } from "@/lib/clinic";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Slot = { time: string; label: string; free: boolean; min: number };
type Appt = {
  id: string; patientId: string; providerId: string;
  startsAt: string; endsAt: string; status: string; reason: string | null;
  serviceTypeId: string | null; patientName: string | null; providerName: string | null; serviceName: string | null;
};
type WaitEntry = {
  id: string; patientId: string; patientName: string; mrn: string;
  providerId: string | null; providerName: string; serviceTypeId: string | null;
  reason: string | null; preferredFrom: string | null; note: string | null; priority: number;
};
type Pending = { kind: "move" | "offer"; id: string } | null;

const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700 ring-slate-200",
  "checked-in": "bg-amber-100 text-amber-800 ring-amber-200",
  "in-room": "bg-violet-100 text-violet-800 ring-violet-200",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "no-show": "bg-rose-100 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-400 ring-slate-200",
};

function todayStr() {
  return clinicDayKey(new Date());
}
function hhmmFromISO(iso: string) {
  return clinicHHmm(iso);
}
function timeLabel(iso: string) {
  return clinicTimeLabel(iso);
}

/**
 * Global, draggable floating "Day agenda" window opened by clicking a date box
 * (or a day/staff date header) via openDayAgenda({ day, providerId }). Shows the
 * day's appointments (tinted by provider color) + the provider's time-slot grid,
 * plus the next matching waitlisted patients. Staff can:
 *   • Move an appointment to another slot (click "Move" then a slot, OR drag it).
 *   • Offer a freed/open slot to a waitlisted patient (click "Offer" then a slot,
 *     OR drag the waitlist row onto a slot) — generates a self-confirm link.
 *   • Click an open slot (nothing pending) to quick-add a new appointment.
 */
export default function DayAgendaWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(todayStr());
  const [providerId, setProviderId] = useState("");

  const [providers, setProviders] = useState<Provider[]>([]);
  const refsLoaded = useRef(false);

  const [appts, setAppts] = useState<Appt[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [waitlist, setWaitlist] = useState<WaitEntry[]>([]);
  const [closedDay, setClosedDay] = useState(false);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<Pending>(null);
  const dragRef = useRef<Pending>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; link?: string } | null>(null);

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Provider color index by array order (matches the schedule/month palette).
  const colorIndex = useCallback((pid: string) => {
    const i = providers.findIndex((p) => p.id === pid);
    return (i < 0 ? 0 : i) % PROVIDER_PALETTE.length;
  }, [providers]);
  const colorFor = (pid: string) => PROVIDER_PALETTE[colorIndex(pid)];

  const loadRefs = useCallback(async () => {
    if (refsLoaded.current) return;
    try {
      const r = await fetch(`/api/appointments?from=2100-01-01&to=2100-01-01`);
      const d = await r.json();
      setProviders(d.providers || []);
      refsLoaded.current = true;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function onOpen(e: Event) {
      const detail = ((e as CustomEvent).detail || {}) as DayAgendaDetail;
      await loadRefs();
      setDay(detail.day || todayStr());
      setProviderId(detail.providerId || "");
      setPending(null);
      dragRef.current = null;
      setMsg(null);
      const w = 500, h = 600;
      setPos({
        x: Math.max(12, Math.round((window.innerWidth - w) / 2)),
        y: Math.max(12, Math.round((window.innerHeight - h) / 2.6)),
      });
      setOpen(true);
    }
    window.addEventListener(DAY_AGENDA_OPEN, onOpen as EventListener);
    return () => window.removeEventListener(DAY_AGENDA_OPEN, onOpen as EventListener);
  }, [loadRefs]);

  useEffect(() => {
    if (open && !providerId && providers[0]) setProviderId(providers[0].id);
  }, [open, providerId, providers]);

  const movingAppt = pending?.kind === "move" ? appts.find((a) => a.id === pending.id) || null : null;
  const movingDuration = movingAppt
    ? Math.max(15, Math.round((new Date(movingAppt.endsAt).getTime() - new Date(movingAppt.startsAt).getTime()) / 60000))
    : 30;

  const refresh = useCallback(async () => {
    if (!open || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setLoading(true);
    try {
      const qp = new URLSearchParams({ from: day, to: day });
      if (providerId) qp.set("providerId", providerId);
      const [ar, wr] = await Promise.all([
        fetch(`/api/appointments?${qp.toString()}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/waitlist`).then((r) => r.json()).catch(() => ({})),
      ]);
      const rows: Appt[] = (ar.appointments || []).sort(
        (a: Appt, b: Appt) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
      setAppts(rows);
      // Matching waitlist: preferred provider = selected OR "any", and preferredFrom <= day.
      const entries: WaitEntry[] = (wr.entries || []).filter((e: WaitEntry) =>
        (!e.providerId || e.providerId === providerId) &&
        (!e.preferredFrom || e.preferredFrom <= day),
      );
      setWaitlist(entries);
    } catch { /* keep */ } finally { setLoading(false); }
  }, [open, day, providerId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Slot grid for the selected provider (duration reflects a moving appt).
  useEffect(() => {
    if (!open || !providerId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) { setSlots([]); return; }
    let cancel = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ providerId, day, duration: String(movingDuration) });
        if (pending?.kind === "move") qs.set("excludeId", pending.id);
        const r = await fetch(`/api/appointments/slots?${qs.toString()}`);
        const d = await r.json();
        if (cancel) return;
        setSlots(d.slots || []);
        setClosedDay(Boolean(d.hours?.closed));
      } catch { if (!cancel) setSlots([]); }
    })();
    return () => { cancel = true; };
  }, [open, providerId, day, pending, movingDuration]);

  useEffect(() => {
    if (!open) return;
    const h = () => refresh();
    window.addEventListener(APPT_CHANGED, h);
    return () => window.removeEventListener(APPT_CHANGED, h);
  }, [open, refresh]);

  // Window drag.
  useEffect(() => {
    function move(ev: MouseEvent) {
      if (!drag.current) return;
      setPos({ x: Math.max(0, ev.clientX - drag.current.dx), y: Math.max(0, ev.clientY - drag.current.dy) });
    }
    function up() { drag.current = null; }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  async function moveToSlot(apptId: string, slot: Slot) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apptId, day, time: slot.time, autoShift: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error || "Could not move the appointment.");
      const landed = d.time ? (slots.find((s) => s.time === d.time)?.label || d.time) : slot.label;
      setMsg({ kind: "ok", text: d.shifted ? `Moved to ${landed} (nearest open)` : `Moved to ${slot.label}` });
      notifyApptChanged();
      await refresh();
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: String(e?.message || "Could not move the appointment.").slice(0, 140) });
    }
    setPending(null); setBusy(false);
  }

  async function offerToSlot(entryId: string, slot: Slot) {
    setBusy(true); setMsg(null);
    const entry = waitlist.find((e) => e.id === entryId);
    try {
      const res = await fetch(`/api/waitlist/${entryId}/offer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, time: slot.time, providerId, serviceTypeId: entry?.serviceTypeId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error || "Could not send the offer.");
      const bits: string[] = [];
      if (d.sms && d.sms !== "skipped") bits.push("SMS sent");
      if (d.email && d.email !== "skipped") bits.push("email sent");
      const via = bits.length ? ` (${bits.join(" + ")})` : " — copy the link to share";
      setMsg({ kind: "ok", text: `Offered ${slot.label} to ${entry?.patientName || "patient"}${via}`, link: d.link || undefined });
      await refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: String(e?.message || "Could not send the offer.").slice(0, 140) });
    }
    setPending(null); setBusy(false);
  }

  // Apply a pending/dropped action to a slot.
  function applyToSlot(slot: Slot, action: Pending) {
    if (!action) {
      // Nothing pending: quick-add a new appointment at this slot.
      openApptWidget({ mode: "new", day, time: slot.time, providerId });
      return;
    }
    if (action.kind === "move") moveToSlot(action.id, slot);
    else offerToSlot(action.id, slot);
  }

  function firstOpenSlot(): Slot | null {
    return slots.find((s) => s.free) || null;
  }

  function editAppt(a: Appt) {
    openApptWidget({
      mode: "edit", appointmentId: a.id, patientId: a.patientId, patientName: a.patientName || "",
      providerId: a.providerId, serviceTypeId: a.serviceTypeId || "", day, time: hhmmFromISO(a.startsAt), reason: a.reason || "",
    });
  }

  if (!open) return null;

  const dateLabel = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const active = pending; // for slot-highlight + click
  const pendingLabel = active?.kind === "move"
    ? `Pick a new time slot for ${movingAppt?.patientName || "this appointment"}`
    : active?.kind === "offer"
      ? `Pick a slot to offer ${waitlist.find((e) => e.id === active.id)?.patientName || "this patient"}`
      : "";

  return (
    <div className="fixed z-[120]" style={{ left: pos.x, top: pos.y }}>
      <div className="w-[500px] max-w-[95vw] rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
        <div
          onMouseDown={(e) => { drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white cursor-move select-none"
        >
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight">Day Agenda</div>
            <div className="text-[11px] text-white/80">{dateLabel}</div>
          </div>
          <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/15 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className={`h-3 w-3 rounded-sm shrink-0 ${providerId ? colorFor(providerId).legend : "bg-slate-300"}`} />
          <select className="input w-full" value={providerId} onChange={(e) => { setProviderId(e.target.value); setPending(null); }}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
          </select>
          <button onClick={() => openApptWidget({ mode: "new", day, providerId })} className="btn-primary whitespace-nowrap">+ New</button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-4 space-y-4">
          {msg && (
            <div className={`rounded-md px-3 py-2 text-sm ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
              <div>{msg.text}</div>
              {msg.link && (
                <div className="mt-1 flex items-center gap-2">
                  <input readOnly value={msg.link} className="flex-1 rounded bg-white/70 ring-1 ring-emerald-200 px-2 py-1 text-[11px]" onFocus={(e) => e.currentTarget.select()} />
                  <button onClick={() => navigator.clipboard?.writeText(msg.link!)} className="text-[11px] font-semibold rounded px-2 py-1 bg-emerald-600 text-white">Copy link</button>
                </div>
              )}
            </div>
          )}

          {active && (
            <div className="rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
              <span>{pendingLabel} below. {active.kind === "move" ? "Booked times auto-shift to the nearest open slot." : "The patient gets a self-confirm link."}</span>
              <button onClick={() => setPending(null)} className="font-semibold hover:underline shrink-0">Cancel</button>
            </div>
          )}

          {/* Appointments */}
          <div>
            <div className="flex items-center justify-between">
              <span className="label mb-0">Appointments {loading && <span className="font-normal text-slate-400">· loading…</span>}</span>
              <span className="text-[11px] text-slate-400">{appts.length} booked</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {appts.length === 0 ? (
                <div className="rounded-md bg-slate-50 ring-1 ring-slate-100 px-3 py-4 text-center text-xs text-slate-400">No appointments for this provider on this day.</div>
              ) : appts.map((a) => {
                const c = colorFor(a.providerId);
                const isMoving = pending?.kind === "move" && pending.id === a.id;
                return (
                  <div
                    key={a.id}
                    draggable={!busy}
                    onDragStart={() => { dragRef.current = { kind: "move", id: a.id }; setDragging(true); }}
                    onDragEnd={() => { dragRef.current = null; setDragging(false); }}
                    className={`flex items-center gap-2 rounded-lg ring-1 border-l-4 px-2.5 py-2 cursor-grab active:cursor-grabbing ${c.bg} ${c.border} ${isMoving ? "ring-amber-300" : "ring-slate-200"}`}
                    title="Drag onto a time slot to move, or use the Move button"
                  >
                    <div className="w-16 shrink-0 text-xs font-semibold text-slate-700">{timeLabel(a.startsAt)}</div>
                    <div className="min-w-0 flex-1">
                      <button onClick={() => router.push(`/patients/${a.patientId}`)} className="block truncate text-sm font-medium text-slate-900 hover:underline text-left">
                        {a.patientName || "Patient"}
                      </button>
                      <div className="truncate text-[11px] text-slate-500 flex items-center gap-1">
                        <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
                        {a.providerName || "Provider"}{a.serviceName ? ` · ${a.serviceName}` : ""}
                      </div>
                    </div>
                    <span className={`chip ${STATUS_CHIP[a.status] || STATUS_CHIP.scheduled} text-[10px] shrink-0`}>{a.status}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setPending(isMoving ? null : { kind: "move", id: a.id }); setMsg(null); }} className={`text-[11px] font-semibold rounded px-2 py-1 ${isMoving ? "bg-amber-200 text-amber-900" : "bg-white/70 text-slate-700 hover:bg-white"}`}>
                        {isMoving ? "Moving…" : "Move"}
                      </button>
                      <button onClick={() => editAppt(a)} className="text-[11px] font-semibold rounded px-2 py-1 bg-white/70 text-slate-700 hover:bg-white">Edit</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waitlist */}
          {waitlist.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <span className="label mb-0">Next on waitlist</span>
                <span className="text-[11px] text-slate-400">{waitlist.length} waiting</span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {waitlist.slice(0, 6).map((e) => {
                  const isOffering = pending?.kind === "offer" && pending.id === e.id;
                  return (
                    <div
                      key={e.id}
                      draggable={!busy}
                      onDragStart={() => { dragRef.current = { kind: "offer", id: e.id }; setDragging(true); }}
                      onDragEnd={() => { dragRef.current = null; setDragging(false); }}
                      className={`flex items-center gap-2 rounded-lg ring-1 border-l-4 border-l-indigo-300 bg-indigo-50/60 px-2.5 py-2 cursor-grab active:cursor-grabbing ${isOffering ? "ring-amber-300" : "ring-indigo-100"}`}
                      title="Drag onto an open slot to offer it, or use the Offer button"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{e.patientName}</div>
                        <div className="truncate text-[11px] text-slate-500">
                          {e.providerName}{e.reason ? ` · ${e.reason}` : ""}{e.priority > 0 ? ` · priority ${e.priority}` : ""}
                        </div>
                      </div>
                      <button
                        disabled={busy || !firstOpenSlot()}
                        onClick={() => { const s = firstOpenSlot(); if (s) offerToSlot(e.id, s); }}
                        className="text-[11px] font-semibold rounded px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                        title={firstOpenSlot() ? `Offer the next open slot (${firstOpenSlot()?.label})` : "No open slots"}
                      >
                        Offer next open
                      </button>
                      <button
                        onClick={() => { setPending(isOffering ? null : { kind: "offer", id: e.id }); setMsg(null); }}
                        className={`text-[11px] font-semibold rounded px-2 py-1 ${isOffering ? "bg-amber-200 text-amber-900" : "bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200"}`}
                      >
                        {isOffering ? "Pick slot…" : "Pick slot"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time-slot grid */}
          <div>
            <span className="label">Time slots <span className="font-normal text-slate-400">({movingDuration} min · green = open{active ? " · click to place" : dragging ? " · drop here" : ""})</span></span>
            {closedDay ? (
              <div className="rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-2 text-xs">This provider isn’t scheduled to work on this day.</div>
            ) : slots.length === 0 ? (
              <div className="rounded-md bg-slate-50 ring-1 ring-slate-100 px-3 py-3 text-center text-xs text-slate-400">No slots to show.</div>
            ) : (
              <div className="grid grid-cols-4 gap-1 max-h-44 overflow-y-auto rounded-lg ring-1 ring-slate-100 p-1.5">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={busy}
                    onDragOver={(ev) => { if (dragRef.current) ev.preventDefault(); }}
                    onDrop={(ev) => { ev.preventDefault(); const a = dragRef.current; dragRef.current = null; setDragging(false); applyToSlot(s, a); }}
                    onClick={() => applyToSlot(s, active)}
                    className={`text-[11px] font-medium rounded-md px-1 py-1.5 ring-1 transition disabled:opacity-50 ${s.free ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100" : "bg-rose-50 text-rose-500 ring-rose-200 hover:bg-rose-100"} ${dragging && s.free ? "ring-2 ring-emerald-400" : ""}`}
                    title={active ? "Place here" : s.free ? "Add an appointment at this time" : "Booked"}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button onClick={() => setOpen(false)} className="btn-secondary">Close</button>
        </footer>
      </div>
    </div>
  );
}
