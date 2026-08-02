"use client";

import React, { useState } from "react";

const NEW_SERVICES = ["Primary Care", "Physical Rehabilitation", "Pain Management", "Wellness & Recovery", "Telehealth", "Not sure yet"];
const EXISTING_SERVICES = ["Primary Care", "Physical Therapy", "Pain Management", "Chiropractic", "IV Therapy", "Wellness & Recovery", "Telehealth", "Follow-up Visit", "Lab / Imaging Review", "Medication Refill"];

export default function ScheduleForm() {
  const [mode, setMode] = useState<"choice" | "new" | "existing">("choice");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ confirmation: string; priorityCheckin: boolean } | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(patientType: "new" | "existing") {
    setBusy(true); setError("");
    try {
      const resp = await fetch("/api/appointments/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, patientType }),
      });
      const j = await resp.json();
      if (!resp.ok) { setError(j.error || "Something went wrong. Please try again."); setBusy(false); return; }
      setDone({ confirmation: j.confirmation, priorityCheckin: j.priorityCheckin });
    } catch { setError("Network error. Please try again."); }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="card card-pad text-center max-w-lg mx-auto">
        <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto text-2xl">✓</div>
        <h2 className="text-xl font-bold text-slate-900 mt-3">Request received</h2>
        <p className="text-slate-600 mt-1">Your confirmation number is</p>
        <div className="text-2xl font-extrabold text-brand-700 my-2 tracking-wider">{done.confirmation}</div>
        {done.priorityCheckin && (
          <div className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 mb-2">★ Priority check-in as a current patient</div>
        )}
        <p className="text-sm text-slate-500">Our front desk will contact you shortly to confirm your appointment. Please save your confirmation number.</p>
        <a href="/" className="btn-primary inline-block mt-4">Back to home</a>
      </div>
    );
  }

  if (mode === "choice") {
    return (
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <button onClick={() => { setForm({}); setError(""); setMode("new"); }} className="card card-pad text-left hover:ring-2 hover:ring-brand-300 transition">
          <div className="text-lg font-bold text-slate-900">New Patient</div>
          <p className="text-sm text-slate-500 mt-1">First time here? Share a few basics and we&apos;ll reach out to schedule your first visit.</p>
          <span className="chip bg-brand-100 text-brand-800 ring-brand-200 mt-3">Start →</span>
        </button>
        <button onClick={() => { setForm({}); setError(""); setMode("existing"); }} className="card card-pad text-left hover:ring-2 hover:ring-brand-300 transition">
          <div className="text-lg font-bold text-slate-900">Current Patient</div>
          <p className="text-sm text-slate-500 mt-1">Already have an MRN? Verify your identity for more services and <b>priority check-in</b>.</p>
          <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 mt-3">Verify &amp; schedule →</span>
        </button>
      </div>
    );
  }

  const services = mode === "new" ? NEW_SERVICES : EXISTING_SERVICES;

  return (
    <div className="card card-pad max-w-2xl mx-auto">
      <button onClick={() => setMode("choice")} className="text-sm text-brand-700 hover:underline mb-3">← Change patient type</button>
      <h2 className="text-lg font-bold text-slate-900">{mode === "new" ? "New Patient — Request a Visit" : "Current Patient — Request a Visit"}</h2>

      {mode === "new" && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900 mt-2">
          As a new patient you don&apos;t need a Medical Record Number (MRN). Your MRN is created and activated <b>in person at the clinic</b> during your first visit. This form submits a request; our team will contact you to confirm.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {mode === "existing" && (<>
          <label className="block"><span className="label">Medical Record Number (MRN)</span><input className="input" value={form.mrn || ""} onChange={(e) => set("mrn", e.target.value)} placeholder="PC-XXXXXX" /></label>
          <label className="block"><span className="label">Date of birth</span><input type="date" className="input" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} /></label>
        </>)}
        <label className="block"><span className="label">First name</span><input className="input" value={form.firstName || ""} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="block"><span className="label">Last name</span><input className="input" value={form.lastName || ""} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="block"><span className="label">Phone</span><input className="input" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="block"><span className="label">Email</span><input className="input" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></label>
        {mode === "new" && (
          <label className="block"><span className="label">Date of birth</span><input type="date" className="input" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} /></label>
        )}
        <label className="block"><span className="label">Service of interest</span>
          <select className="input" value={form.serviceInterest || ""} onChange={(e) => set("serviceInterest", e.target.value)}>
            <option value="">Select…</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Preferred date</span><input type="date" className="input" value={form.preferredDate || ""} onChange={(e) => set("preferredDate", e.target.value)} /></label>
        <label className="block"><span className="label">Preferred time</span><input type="time" className="input" value={form.preferredTime || ""} onChange={(e) => set("preferredTime", e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className="label">Notes (optional)</span><textarea className="input" rows={3} value={form.message || ""} onChange={(e) => set("message", e.target.value)} /></label>
      </div>

      {error && <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 text-sm text-rose-700 mt-3">{error}</div>}

      <button disabled={busy} onClick={() => submit(mode as "new" | "existing")} className="btn-primary w-full mt-4">
        {busy ? "Submitting…" : "Submit request"}
      </button>
    </div>
  );
}
