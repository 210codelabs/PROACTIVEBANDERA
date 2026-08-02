"use client";

import React, { useEffect, useState } from "react";

type Req = {
  id: string; patientType: string; firstName: string; lastName: string; phone?: string; email?: string;
  dob?: string; mrn?: string; serviceInterest?: string; preferredDate?: string; preferredTime?: string;
  message?: string; priorityCheckin: boolean; status: string; confirmation: string; createdAt: string;
  appointmentId?: string | null; scheduledStartsAt?: string | null;
};

export default function AppointmentRequestsList() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [sched, setSched] = useState<{ date: string; time: string; location: string }>({ date: "", time: "", location: "in-office" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/appointments/request");
    const j = await r.json();
    setItems(j.requests || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/appointments/request/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  function openSchedule(r: Req) {
    setErr("");
    setScheduling(r.id);
    setSched({ date: r.preferredDate || "", time: r.preferredTime || "", location: "in-office" });
  }

  async function convert(id: string) {
    setBusy(true); setErr("");
    const resp = await fetch(`/api/appointments/request/${id}/convert`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sched),
    });
    const j = await resp.json();
    setBusy(false);
    if (!resp.ok) { setErr(j.error || "Could not schedule."); return; }
    setScheduling(null);
    load();
  }

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (items.length === 0) return <div className="card card-pad text-sm text-slate-500">No appointment requests yet.</div>;

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.id} className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">{r.firstName} {r.lastName}</span>
                <span className={`chip text-xs ${r.patientType === "existing" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{r.patientType === "existing" ? "Current patient" : "New patient"}</span>
                {r.priorityCheckin && <span className="chip text-xs bg-amber-100 text-amber-800 ring-amber-200">★ Priority check-in</span>}
                <span className={`chip text-xs ${r.status === "pending" ? "bg-blue-100 text-blue-800 ring-blue-200" : r.status === "confirmed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-700 ring-rose-200"}`}>{r.status}</span>
                {r.appointmentId && <span className="chip text-xs bg-indigo-100 text-indigo-800 ring-indigo-200">📅 Scheduled</span>}
              </div>
              <div className="text-sm text-slate-600 mt-1 grid sm:grid-cols-2 gap-x-6">
                <span>Conf: <b>{r.confirmation}</b></span>
                {r.mrn && <span>MRN: {r.mrn}</span>}
                {r.phone && <span>☎ {r.phone}</span>}
                {r.email && <span>✉ {r.email}</span>}
                {r.serviceInterest && <span>Service: {r.serviceInterest}</span>}
                {(r.preferredDate || r.preferredTime) && <span>Preferred: {r.preferredDate} {r.preferredTime}</span>}
                {r.scheduledStartsAt && <span className="text-indigo-700 font-medium">Scheduled: {new Date(r.scheduledStartsAt).toLocaleString()}</span>}
              </div>
              {r.message && <div className="text-sm text-slate-500 mt-1 italic">“{r.message}”</div>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!r.appointmentId && (
                <button onClick={() => openSchedule(r)} className="chip bg-indigo-600 text-white text-xs">Schedule appointment</button>
              )}
              {r.status !== "confirmed" && <button onClick={() => setStatus(r.id, "confirmed")} className="chip bg-emerald-600 text-white text-xs">Confirm</button>}
              {r.status !== "declined" && <button onClick={() => setStatus(r.id, "declined")} className="chip bg-white ring-slate-200 text-slate-600 text-xs">Decline</button>}
            </div>
          </div>

          {scheduling === r.id && (
            <div className="mt-3 rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-800 mb-2">Create a scheduled appointment</div>
              {r.patientType === "new" && !r.mrn && (
                <div className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded p-2 mb-2">
                  This is a new patient — scheduling will create a patient record with a new MRN.
                </div>
              )}
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="block"><span className="label">Date</span><input type="date" className="input" value={sched.date} onChange={(e) => setSched((s) => ({ ...s, date: e.target.value }))} /></label>
                <label className="block"><span className="label">Time</span><input type="time" className="input" value={sched.time} onChange={(e) => setSched((s) => ({ ...s, time: e.target.value }))} /></label>
                <label className="block"><span className="label">Location</span>
                  <select className="input" value={sched.location} onChange={(e) => setSched((s) => ({ ...s, location: e.target.value }))}>
                    <option value="in-office">In-office</option>
                    <option value="telehealth">Telehealth</option>
                    <option value="home-visit">Home visit</option>
                  </select>
                </label>
              </div>
              {err && <div className="text-sm text-rose-700 mt-2">{err}</div>}
              <div className="flex gap-2 mt-3">
                <button disabled={busy} onClick={() => convert(r.id)} className="btn-primary text-sm">{busy ? "Creating…" : "Create appointment"}</button>
                <button onClick={() => { setScheduling(null); setErr(""); }} className="chip bg-white ring-slate-200 text-slate-600 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
