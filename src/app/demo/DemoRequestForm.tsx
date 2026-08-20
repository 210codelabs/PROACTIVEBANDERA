"use client";

import React, { useState } from "react";

const INTERESTS = [
  "EHR / Charting", "Billing & RCM", "Scheduling", "Patient Portal", "Pharmacy / e-Rx",
  "Inventory / POS", "Interoperability (FHIR/HL7)", "Legal / PI Workflows", "Analytics", "Telehealth",
];
const SIZES = ["1–5 providers", "6–20 providers", "21–50 providers", "50+ providers", "Multi-location group"];

export default function DemoRequestForm() {
  const [f, setF] = useState({ name: "", email: "", phone: "", organization: "", role: "", practiceSize: "", preferredTime: "", message: "", company_website: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (i: string) => setInterests((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, interests, source: "demo-page" }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Something went wrong. Please try again."); return; }
      setDone(true);
    } catch {
      setErr("Could not submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-6 text-center">
        <div className="text-2xl">✅</div>
        <h3 className="mt-2 text-lg font-bold text-emerald-900">Thank you — request received!</h3>
        <p className="mt-1 text-sm text-emerald-800">Our team will reach out shortly to schedule your personalized demo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
      {/* honeypot (hidden) */}
      <input type="text" tabIndex={-1} autoComplete="off" value={f.company_website} onChange={set("company_website")} className="hidden" aria-hidden="true" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm block"><span className="label">Full name *</span><input className="input w-full" required value={f.name} onChange={set("name")} /></label>
        <label className="text-sm block"><span className="label">Work email *</span><input type="email" className="input w-full" required value={f.email} onChange={set("email")} /></label>
        <label className="text-sm block"><span className="label">Phone</span><input className="input w-full" value={f.phone} onChange={set("phone")} /></label>
        <label className="text-sm block"><span className="label">Organization / Practice</span><input className="input w-full" value={f.organization} onChange={set("organization")} /></label>
        <label className="text-sm block"><span className="label">Your role / title</span><input className="input w-full" value={f.role} onChange={set("role")} /></label>
        <label className="text-sm block"><span className="label">Practice size</span>
          <select className="input w-full" value={f.practiceSize} onChange={set("practiceSize")}>
            <option value="">Select…</option>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="label">What are you interested in?</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => (
            <button type="button" key={i} onClick={() => toggle(i)} className={`chip ring-1 ring-inset text-xs ${interests.includes(i) ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200"}`}>{i}</button>
          ))}
        </div>
      </div>

      <label className="text-sm block"><span className="label">Best time to reach you</span><input className="input w-full" placeholder="e.g. weekday mornings CT" value={f.preferredTime} onChange={set("preferredTime")} /></label>
      <label className="text-sm block"><span className="label">Anything specific you&apos;d like to see?</span><textarea className="input w-full" rows={3} value={f.message} onChange={set("message")} /></label>

      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">{busy ? "Sending…" : "Request my demo"}</button>
      <p className="text-[11px] text-slate-400 text-center">By submitting, you agree to be contacted about a ProactiveClinic demo.</p>
    </form>
  );
}
