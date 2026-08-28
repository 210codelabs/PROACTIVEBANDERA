"use client";

import React, { useEffect, useState } from "react";
import { HEALTH_HISTORY } from "@/lib/dot/forms";

type Props = { loadUrl: string; submitUrl: string; heading?: string };

export default function DriverDotForm({ loadUrl, submitUrl, heading }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [info, setInfo] = useState<any>({ licenseNumber: "", licenseState: "", hasCdl: true, address: "", phone: "", dob: "", diabetesTreatment: "none", medications: "" });
  const [hh, setHh] = useState<Record<string, { yes?: boolean; detail?: string }>>({});
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(loadUrl);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Unable to load"); setLoaded(true); return; }
        const e = d.exam;
        setDriverName(e.driverName || "");
        setInfo((p: any) => ({ ...p, ...(e.driverInfo || {}) }));
        setHh(e.healthHistory || {});
        setAlreadySigned(Boolean(e.alreadySigned || e.driverSignedAt));
        setLoaded(true);
      } catch { setErr("Network error"); setLoaded(true); }
    })();
  }, [loadUrl]);

  const setAns = (key: string, yes: boolean) => setHh((p) => ({ ...p, [key]: { ...(p[key] || {}), yes } }));
  const setDetail = (key: string, detail: string) => setHh((p) => ({ ...p, [key]: { ...(p[key] || {}), detail } }));

  const submit = async () => {
    if (!sig.trim()) { setErr("Please type your full name to sign."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(submitUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driverInfo: info, healthHistory: hh, driverSignature: sig }) });
      const d = await r.json();
      if (r.ok) setDone(true); else setErr(d.error || "Submission failed");
    } catch { setErr("Network error"); } finally { setBusy(false); }
  };

  if (!loaded) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (done || alreadySigned) return (
    <div className="max-w-xl mx-auto p-8 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl">✓</div>
      <h2 className="text-xl font-bold text-slate-900">Thank you{driverName ? `, ${driverName}` : ""}!</h2>
      <p className="text-slate-600 mt-2">Your medical history has been submitted. Please hand the tablet back to the clinic staff — the examiner will complete your DOT physical.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">{heading || "DOT Medical History"}</h1>
      <p className="text-sm text-slate-500 mb-4">Driver section of FMCSA Form MCSA-5875. Please answer honestly — this is part of your commercial driver medical exam.</p>
      {driverName && <p className="text-sm font-medium text-slate-700 mb-4">Driver: {driverName}</p>}

      <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4 mb-4">
        <h3 className="font-semibold text-slate-900 mb-3">Your information</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <F label="Driver license #"><input value={info.licenseNumber} onChange={(e) => setInfo({ ...info, licenseNumber: e.target.value })} className="inp" /></F>
          <F label="License state"><input value={info.licenseState} onChange={(e) => setInfo({ ...info, licenseState: e.target.value })} className="inp" /></F>
          <F label="Date of birth"><input type="date" value={info.dob || ""} onChange={(e) => setInfo({ ...info, dob: e.target.value })} className="inp" /></F>
          <F label="Phone"><input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} className="inp" /></F>
          <F label="Address"><input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} className="inp" /></F>
          <F label="Do you hold a CDL?"><select value={info.hasCdl ? "yes" : "no"} onChange={(e) => setInfo({ ...info, hasCdl: e.target.value === "yes" })} className="inp"><option value="yes">Yes</option><option value="no">No</option></select></F>
        </div>
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4 mb-4">
        <h3 className="font-semibold text-slate-900 mb-1">Health history</h3>
        <p className="text-xs text-slate-500 mb-3">Do you have, or have you ever had, any of the following?</p>
        <div className="space-y-2">
          {HEALTH_HISTORY.map((q) => {
            const a = hh[q.key] || {};
            return (
              <div key={q.key} className="border-b border-slate-100 pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex gap-1 pt-0.5">
                    <button type="button" onClick={() => setAns(q.key, true)} className={`px-2 py-0.5 rounded text-xs font-semibold ${a.yes === true ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}>Yes</button>
                    <button type="button" onClick={() => setAns(q.key, false)} className={`px-2 py-0.5 rounded text-xs font-semibold ${a.yes === false ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>No</button>
                  </div>
                  <span className="text-sm text-slate-700">{q.label}</span>
                </div>
                {a.yes && <input value={a.detail || ""} onChange={(e) => setDetail(q.key, e.target.value)} placeholder="Details (condition, dates, treatment)" className="inp mt-1 text-xs" />}
              </div>
            );
          })}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
          <F label="Diabetes treatment"><select value={info.diabetesTreatment} onChange={(e) => setInfo({ ...info, diabetesTreatment: e.target.value })} className="inp"><option value="none">None</option><option value="diet">Diet</option><option value="oral">Oral medication</option><option value="insulin">Insulin</option></select></F>
        </div>
        <F label="List ALL current medications (prescription, OTC, herbal)"><textarea value={info.medications} onChange={(e) => setInfo({ ...info, medications: e.target.value })} rows={3} className="inp" /></F>
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4 mb-4">
        <h3 className="font-semibold text-slate-900 mb-2">Certification &amp; signature</h3>
        <p className="text-xs text-slate-500 mb-2">I certify that the above information is complete and true. I understand that inaccurate, false or missing information may invalidate the examination and my Medical Examiner's Certificate.</p>
        <F label="Type your full name to sign"><input value={sig} onChange={(e) => setSig(e.target.value)} className="inp" placeholder="Full legal name" /></F>
      </section>

      {err && <div className="rounded-lg bg-rose-50 text-rose-700 text-sm p-3 mb-3">{err}</div>}
      <button onClick={submit} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">{busy ? "Submitting…" : "Submit my medical history"}</button>

      <style jsx>{`:global(.inp){width:100%;border:1px solid #cbd5e1;border-radius:0.375rem;padding:0.5rem 0.75rem;font-size:0.875rem}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
