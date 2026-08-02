"use client";

import React, { useEffect, useState } from "react";

type Req = {
  id: string; patientType: string; firstName: string; lastName: string; phone?: string; email?: string;
  dob?: string; mrn?: string; serviceInterest?: string; preferredDate?: string; preferredTime?: string;
  message?: string; priorityCheckin: boolean; status: string; confirmation: string; createdAt: string;
};

export default function AppointmentRequestsList() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (items.length === 0) return <div className="card card-pad text-sm text-slate-500">No appointment requests yet.</div>;

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div key={r.id} className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{r.firstName} {r.lastName}</span>
                <span className={`chip text-xs ${r.patientType === "existing" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{r.patientType === "existing" ? "Current patient" : "New patient"}</span>
                {r.priorityCheckin && <span className="chip text-xs bg-amber-100 text-amber-800 ring-amber-200">★ Priority check-in</span>}
                <span className={`chip text-xs ${r.status === "pending" ? "bg-blue-100 text-blue-800 ring-blue-200" : r.status === "confirmed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-700 ring-rose-200"}`}>{r.status}</span>
              </div>
              <div className="text-sm text-slate-600 mt-1 grid sm:grid-cols-2 gap-x-6">
                <span>Conf: <b>{r.confirmation}</b></span>
                {r.mrn && <span>MRN: {r.mrn}</span>}
                {r.phone && <span>☎ {r.phone}</span>}
                {r.email && <span>✉ {r.email}</span>}
                {r.serviceInterest && <span>Service: {r.serviceInterest}</span>}
                {(r.preferredDate || r.preferredTime) && <span>Preferred: {r.preferredDate} {r.preferredTime}</span>}
              </div>
              {r.message && <div className="text-sm text-slate-500 mt-1 italic">“{r.message}”</div>}
            </div>
            <div className="flex gap-2">
              {r.status !== "confirmed" && <button onClick={() => setStatus(r.id, "confirmed")} className="chip bg-emerald-600 text-white text-xs">Confirm</button>}
              {r.status !== "declined" && <button onClick={() => setStatus(r.id, "declined")} className="chip bg-white ring-slate-200 text-slate-600 text-xs">Decline</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
