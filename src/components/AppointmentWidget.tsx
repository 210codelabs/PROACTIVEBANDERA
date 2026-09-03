"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APPT_OPEN, type ApptOpenDetail, notifyApptChanged } from "@/lib/apptEvents";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category?: string };
type Slot = { time: string; label: string; free: boolean; min: number };
type Hit = { id: string; mrn: string; firstName: string; lastName: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function labelFor(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Global, draggable floating "Appointment" window. Opened from anywhere via
 * openApptWidget({...}) (calendars day-click, New Appointment button, patient
 * chart Modify). Supports create + modify, a full day+time picker, live open-slot
 * suggestions, an inline day time-slot list, and an intentional double-book override.
 */
export default function AppointmentWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [apptId, setApptId] = useState<string | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const refsLoaded = useRef(false);

  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [day, setDay] = useState(todayStr());
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("in-office");

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggestions, setSuggestions] = useState<{ time: string; label: string }[]>([]);
  const [closedDay, setClosedDay] = useState(false);

  const [allowDouble, setAllowDouble] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Floating window position (draggable by the header).
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const loadRefs = useCallback(async () => {
    if (refsLoaded.current) return;
    try {
      const r = await fetch(`/api/appointments?from=2100-01-01&to=2100-01-01`);
      const d = await r.json();
      setProviders(d.providers || []);
      setServices(d.services || []);
      refsLoaded.current = true;
    } catch { /* ignore */ }
  }, []);

  // Open handler (global event).
  useEffect(() => {
    async function onOpen(e: Event) {
      const detail = ((e as CustomEvent).detail || {}) as ApptOpenDetail;
      await loadRefs();
      setMode(detail.mode || "new");
      setApptId(detail.appointmentId || null);
      setDay(detail.day || todayStr());
      setTime(detail.time || "09:00");
      setReason(detail.reason || "");
      setLocation(detail.location || "in-office");
      setProviderId(detail.providerId || "");
      setServiceTypeId(detail.serviceTypeId || "");
      setPatientId(detail.patientId || "");
      setPatientLabel(detail.patientName || "");
      setQ("");
      setHits([]);
      setAllowDouble(false);
      setError("");
      setOkMsg("");
      // Center the window on open.
      const w = 460, h = 560;
      setPos({
        x: Math.max(12, Math.round((window.innerWidth - w) / 2)),
        y: Math.max(12, Math.round((window.innerHeight - h) / 2.4)),
      });
      setOpen(true);
    }
    window.addEventListener(APPT_OPEN, onOpen as EventListener);
    return () => window.removeEventListener(APPT_OPEN, onOpen as EventListener);
  }, [loadRefs]);

  // Default provider once refs load and none preselected.
  useEffect(() => {
    if (open && !providerId && providers[0]) setProviderId(providers[0].id);
  }, [open, providerId, providers]);

  const duration = (() => {
    const s = services.find((x) => x.id === serviceTypeId);
    return s?.durationMin || 30;
  })();

  // Fetch the provider's slot grid + suggestions whenever provider/day/duration changes.
  useEffect(() => {
    if (!open || !providerId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) { setSlots([]); setSuggestions([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ providerId, day, duration: String(duration) });
        if (apptId) qs.set("excludeId", apptId);
        const r = await fetch(`/api/appointments/slots?${qs.toString()}`);
        const d = await r.json();
        if (cancel) return;
        setSlots(d.slots || []);
        setSuggestions(d.suggestions || []);
        setClosedDay(Boolean(d.hours?.closed));
      } catch { if (!cancel) { setSlots([]); setSuggestions([]); } }
    }, 150);
    return () => { cancel = true; clearTimeout(t); };
  }, [open, providerId, day, duration, apptId]);

  // Patient search (new mode only).
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=8`);
        const d = await r.json();
        setHits(d.results || []);
      } catch { setHits([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

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

  const selectedSlot = slots.find((s) => s.time === time);
  const timeIsTaken = Boolean(selectedSlot && !selectedSlot.free);

  async function save() {
    setError(""); setOkMsg("");
    if (mode === "new" && !patientId) { setError("Choose a patient first."); return; }
    if (!providerId) { setError("Choose a provider."); return; }
    if (timeIsTaken && !allowDouble) {
      setError("That time is already booked. Pick a suggested time, or tick “Allow double-book” to keep it.");
      return;
    }
    setBusy(true);
    try {
      const body: any = { providerId, serviceTypeId: serviceTypeId || null, day, time, reason, location };
      if (allowDouble) body.allowDoubleBook = true;
      let res: Response;
      if (mode === "edit" && apptId) {
        res = await fetch("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: apptId, ...body }) });
      } else {
        res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, ...body }) });
      }
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) { setError("Double-booking — tick “Allow double-book” to keep this time, or choose another."); setBusy(false); return; }
      if (!res.ok || d.error) { setError(d.error || "Could not save the appointment."); setBusy(false); return; }
      setOkMsg(mode === "edit" ? "Appointment updated." : "Appointment scheduled.");
      notifyApptChanged();
      router.refresh();
      setTimeout(() => setOpen(false), 500);
    } catch {
      setError("Scheduling is temporarily unavailable.");
    }
    setBusy(false);
  }

  if (!open) return null;

  return (
    <div className="fixed z-[120]" style={{ left: pos.x, top: pos.y }}>
      <div className="w-[460px] max-w-[94vw] rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
        {/* Draggable header */}
        <div
          onMouseDown={(e) => { drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white cursor-move select-none"
        >
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight">{mode === "edit" ? "Modify Appointment" : "New Appointment"}</div>
            <div className="text-[11px] text-white/75">{new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
          <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/15 text-lg leading-none">×</button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-4 space-y-3">
          {error && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
          {okMsg && <div className="rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 px-3 py-2 text-sm">{okMsg}</div>}

          {/* Patient */}
          <div>
            <span className="label">Patient</span>
            {mode === "edit" ? (
              <div className="chip bg-slate-100 text-slate-700 ring-slate-200">{patientLabel || "This patient"}</div>
            ) : patientId ? (
              <div className="flex items-center gap-2">
                <span className="chip bg-brand-100 text-brand-800 ring-brand-200">{patientLabel}</span>
                <button onClick={() => { setPatientId(""); setPatientLabel(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-900">change</button>
              </div>
            ) : (
              <>
                <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search registered patient…" />
                {hits.length > 0 && (
                  <ul className="mt-1 ring-1 ring-slate-200 rounded-md max-h-40 overflow-auto bg-white">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button type="button" onClick={() => { setPatientId(h.id); setPatientLabel(`${h.lastName}, ${h.firstName} (${h.mrn})`); setHits([]); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50">
                          {h.lastName}, {h.firstName} <span className="text-xs text-slate-500">MRN {h.mrn}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Provider</span>
              <select className="input" value={providerId} onChange={(e) => { setProviderId(e.target.value); setAllowDouble(false); }}>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Service</span>
              <select className="input" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
                <option value="">Default (30 min)</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin}m)</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Date</span>
              <input type="date" className="input" value={day} onChange={(e) => { setDay(e.target.value); setAllowDouble(false); }} />
            </label>
            <label className="block">
              <span className="label">Time</span>
              <input type="time" min="09:00" max="20:00" step={900} className="input" value={time} onChange={(e) => { setTime(e.target.value); setAllowDouble(false); }} />
            </label>
            <label className="block col-span-2">
              <span className="label">Location</span>
              <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="in-office">In office</option>
                <option value="home-visit">Home visit</option>
                <option value="telehealth">Telehealth</option>
              </select>
            </label>
          </div>

          {/* Slot suggestions */}
          {closedDay ? (
            <div className="rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-2 text-xs">The provider isn’t scheduled to work on this day.</div>
          ) : suggestions.length > 0 && (
            <div>
              <span className="label">Next open times</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s.time} type="button" onClick={() => { setTime(s.time); setAllowDouble(false); }} className={`chip ring-1 ${time === s.time ? "bg-brand-600 text-white ring-brand-600" : "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"}`}>{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Day time-slot list */}
          {!closedDay && slots.length > 0 && (
            <div>
              <span className="label">Day slots <span className="font-normal text-slate-400">({duration} min · green = open)</span></span>
              <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto rounded-lg ring-1 ring-slate-100 p-1.5">
                {slots.map((s) => {
                  const sel = time === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => { setTime(s.time); if (s.free) setAllowDouble(false); }}
                      className={`text-[11px] font-medium rounded-md px-1 py-1 ring-1 transition ${sel ? "bg-brand-600 text-white ring-brand-600" : s.free ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100" : "bg-rose-50 text-rose-500 ring-rose-200 hover:bg-rose-100"}`}
                      title={s.free ? "Open" : "Already booked"}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Double-book override */}
          {timeIsTaken && (
            <label className="flex items-start gap-2 rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={allowDouble} onChange={(e) => setAllowDouble(e.target.checked)} />
              <span><b>{labelFor(time)}</b> is already booked for this provider. Tick to intentionally double-book this slot.</span>
            </label>
          )}

          <label className="block">
            <span className="label">Reason / chief complaint</span>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Office visit" />
          </label>
        </div>

        <footer className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || (mode === "new" && !patientId)} className="btn-primary">{busy ? "Saving…" : mode === "edit" ? "Save changes" : "Schedule"}</button>
        </footer>
      </div>
    </div>
  );
}
