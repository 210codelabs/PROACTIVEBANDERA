"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category: string };
type Appt = {
  id: string; startsAt: string; endsAt: string; status: string;
  providerId: string; serviceTypeId: string | null; providerName?: string | null;
  serviceName?: string | null; reason?: string | null; location?: string | null;
};

const CAN_MANAGE = ["admin", "provider", "nurse", "frontdesk"];
const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700 ring-slate-200",
  "checked-in": "bg-amber-100 text-amber-800 ring-amber-200",
  "in-room": "bg-violet-100 text-violet-800 ring-violet-200",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "no-show": "bg-rose-100 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-200 text-slate-500 ring-slate-300 line-through",
};

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function toDay(dt?: string) { return dt ? new Date(dt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10); }
function toTime(dt?: string) { const d = dt ? new Date(dt) : new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

export default function PatientAppointments({ patientId, role }: { patientId: string; role: string }) {
  const router = useRouter();
  const canManage = CAN_MANAGE.includes(role);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<{ id?: string; providerId: string; serviceTypeId: string; day: string; time: string; reason: string; location: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/appointments?patientId=${patientId}`);
      if (r.ok) {
        const d = await r.json();
        setAppts(d.appointments || []);
        setProviders(d.providers || []);
        setServices(d.services || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setMsg(null);
    setForm({ providerId: providers[0]?.id || "", serviceTypeId: services[0]?.id || "", day: toDay(), time: "09:00", reason: "", location: "in-office" });
  }
  function openEdit(a: Appt) {
    setMsg(null);
    setForm({ id: a.id, providerId: a.providerId, serviceTypeId: a.serviceTypeId || (services[0]?.id || ""), day: toDay(a.startsAt), time: toTime(a.startsAt), reason: a.reason || "", location: a.location || "in-office" });
  }

  async function save() {
    if (!form) return;
    setBusy(true); setMsg(null);
    try {
      const isEdit = Boolean(form.id);
      const r = await fetch("/api/appointments", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: form.id } : { patientId }),
          providerId: form.providerId,
          serviceTypeId: form.serviceTypeId || null,
          day: form.day, time: form.time,
          reason: form.reason, location: form.location,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Could not save appointment."); return; }
      setForm(null); await load(); router.refresh();
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  async function cancel(a: Appt) {
    if (!confirm("Cancel this appointment?")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/appointments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, status: "cancelled" }),
      });
      if (!r.ok) { const d = await r.json(); setMsg(d.error || "Could not cancel."); return; }
      await load(); router.refresh();
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  const now = Date.now();
  const upcoming = appts.filter((a) => new Date(a.startsAt).getTime() >= now && a.status !== "cancelled");
  const others = appts.filter((a) => !(new Date(a.startsAt).getTime() >= now && a.status !== "cancelled"));

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Appointments</h2>
        {canManage && <button onClick={openNew} className="btn-primary py-1 px-3 text-sm">+ Book appointment</button>}
      </header>
      <div className="p-4 space-y-4">
        {msg && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{msg}</div>}
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Upcoming</h3>
              {upcoming.length === 0 ? <p className="text-sm text-slate-500">No upcoming appointments.</p> : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((a) => <Row key={a.id} a={a} canManage={canManage} onEdit={() => openEdit(a)} onCancel={() => cancel(a)} busy={busy} />)}
                </ul>
              )}
            </div>
            {others.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Past / cancelled</h3>
                <ul className="divide-y divide-slate-100">
                  {others.slice(0, 10).map((a) => <Row key={a.id} a={a} canManage={canManage} onEdit={() => openEdit(a)} onCancel={() => cancel(a)} busy={busy} past />)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between">
              <span>{form.id ? "Reschedule / modify appointment" : "Book appointment"}</span>
              <button onClick={() => setForm(null)} className="text-slate-500">✕</button>
            </header>
            <div className="p-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Provider</span>
                <select className="input" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Service</span>
                <select className="input" value={form.serviceTypeId} onChange={(e) => setForm({ ...form, serviceTypeId: e.target.value })}>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin}m)</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Date</span>
                <input type="date" className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Time</span>
                <input type="time" min="09:00" max="20:00" step={900} className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Location</span>
                <select className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                  <option value="in-office">In office</option>
                  <option value="home-visit">Home visit</option>
                  <option value="telehealth">Telehealth</option>
                </select>
              </label>
              <label className="block col-span-2">
                <span className="label">Reason / chief complaint</span>
                <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </label>
            </div>
            <footer className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={busy || !form.providerId} className="btn-primary">{busy ? "Saving…" : (form.id ? "Save changes" : "Book")}</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ a, canManage, onEdit, onCancel, busy, past }: { a: Appt; canManage: boolean; onEdit: () => void; onCancel: () => void; busy: boolean; past?: boolean }) {
  return (
    <li className="py-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="w-48 text-slate-700">{fmt(a.startsAt)}</span>
      <span className="flex-1 min-w-[120px] text-slate-800">{a.serviceName || a.reason || "Office visit"}</span>
      <span className="text-xs text-slate-500">{a.providerName || ""}</span>
      <span className={`chip ring-1 ${STATUS_STYLE[a.status] || STATUS_STYLE.scheduled}`}>{a.status}</span>
      {canManage && !past && a.status !== "cancelled" && (
        <span className="flex items-center gap-2">
          <button onClick={onEdit} disabled={busy} className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50">Modify</button>
          <button onClick={onCancel} disabled={busy} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">Cancel</button>
        </span>
      )}
    </li>
  );
}
