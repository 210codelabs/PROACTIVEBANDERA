"use client";

import React, { useEffect, useState } from "react";

type Provider = { id: string; npi: string; firstName: string; lastName: string; credential?: string; taxonomy?: string; status: string; nppesVerified: boolean; oigClear: boolean | null; samClear: boolean | null; hasPortalPassword?: boolean; validationResult?: any; portalUsername?: string | null };
type Job = { id: string; providerName: string; npi: string; status: string; webhookToken: string; error?: string | null; logs?: any[]; mfaReceivedAt?: string | null };

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600", validating: "bg-sky-100 text-sky-700", validated: "bg-emerald-100 text-emerald-700",
  awaiting_mfa: "bg-amber-100 text-amber-800", processing: "bg-indigo-100 text-indigo-700", completed: "bg-emerald-100 text-emerald-800", failed: "bg-rose-100 text-rose-700", pending: "bg-slate-100 text-slate-600",
};

function Chip({ s }: { s: string }) { return <span className={`chip ${STATUS_TONE[s] || "bg-slate-100 text-slate-600"}`}>{s.replace(/_/g, " ")}</span>; }

export default function CredentialingBoard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ npi: "", firstName: "", lastName: "", credential: "", email: "", phone: "", portalUsername: "", portalPassword: "", caqhAttestationDate: "", licenseExpDate: "", licenseState: "" });
  const [origin, setOrigin] = useState("");
  const [reminders, setReminders] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [p, j, rem] = await Promise.all([
        fetch("/api/credentialing/providers").then((r) => r.json()),
        fetch("/api/credentialing/jobs").then((r) => r.json()),
        fetch("/api/credentialing/reminders?days=90").then((r) => r.json()).catch(() => ({ items: [] })),
      ]);
      setProviders(p.providers || []); setJobs(j.jobs || []); setReminders(rem.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); setOrigin(window.location.origin); }, []);

  async function addProvider(e: React.FormEvent) {
    e.preventDefault(); setBusy("add"); setMsg(null);
    try {
      const r = await fetch("/api/credentialing/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || "Could not add provider.");
      else { setForm({ npi: "", firstName: "", lastName: "", credential: "", email: "", phone: "", portalUsername: "", portalPassword: "", caqhAttestationDate: "", licenseExpDate: "", licenseState: "" }); await load(); }
    } catch { setMsg("Network error."); } finally { setBusy(null); }
  }

  async function validate(id: string) {
    setBusy(id); setMsg(null);
    try { const r = await fetch(`/api/credentialing/providers/${id}/validate`, { method: "POST" }); const d = await r.json(); if (!r.ok) setMsg(d.error || "Validation failed."); await load(); }
    catch { setMsg("Validation request failed."); } finally { setBusy(null); }
  }

  async function startJob(providerId: string) {
    setBusy(providerId); setMsg(null);
    try { const r = await fetch("/api/credentialing/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId }) }); const d = await r.json(); if (!r.ok && !d.job) setMsg(d.error || "Could not start job."); await load(); }
    catch { setMsg("Could not start job."); } finally { setBusy(null); }
  }

  async function removeProvider(id: string) {
    if (!confirm("Remove this provider and its jobs?")) return;
    setBusy(id);
    try { await fetch(`/api/credentialing/providers/${id}`, { method: "DELETE" }); await load(); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <section className="card card-pad">
        <h1 className="text-xl font-bold text-slate-900">Credentialing Automation</h1>
        <p className="text-sm text-slate-500">Validate providers against federal sources (NPPES · OIG LEIE · SAM.gov), then hand a validated CAQH package + MFA webhook to your external RPA/SMS agent.</p>
        <div className="mt-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-800">
          <b>How MFA works:</b> This system validates data and holds job state. It does <b>not</b> log into CAQH or intercept SMS itself. Your external agent drives the portal; when it hits MFA it POSTs the code to the job&apos;s webhook to resume.
        </div>
        {msg && <div className="mt-2 text-xs text-rose-600">{msg}</div>}
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900 mb-2">Add provider</h2>
        <form onSubmit={addProvider} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input required value={form.npi} onChange={(e) => setForm({ ...form, npi: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="NPI (10 digits)" className="input font-mono" />
          <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="input" />
          <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="input" />
          <input value={form.credential} onChange={(e) => setForm({ ...form, credential: e.target.value })} placeholder="Credential (MD/DO/NP)" className="input" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="input" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="input" />
          <input value={form.portalUsername} onChange={(e) => setForm({ ...form, portalUsername: e.target.value })} placeholder="CAQH portal username" className="input" />
          <input type="password" value={form.portalPassword} onChange={(e) => setForm({ ...form, portalPassword: e.target.value })} placeholder="CAQH portal password (encrypted)" className="input" />
          <label className="text-[11px] text-slate-500">CAQH attestation due<input type="date" value={form.caqhAttestationDate} onChange={(e) => setForm({ ...form, caqhAttestationDate: e.target.value })} className="input mt-0.5" /></label>
          <label className="text-[11px] text-slate-500">License expiration<input type="date" value={form.licenseExpDate} onChange={(e) => setForm({ ...form, licenseExpDate: e.target.value })} className="input mt-0.5" /></label>
          <input value={form.licenseState} onChange={(e) => setForm({ ...form, licenseState: e.target.value.toUpperCase().slice(0, 2) })} placeholder="License state (TX)" className="input" />
          <button disabled={busy === "add"} className="btn-primary">{busy === "add" ? "Adding…" : "Add provider"}</button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Providers ({providers.length})</header>
        {loading ? <div className="p-4 text-sm text-slate-400">Loading…</div> : providers.length === 0 ? <div className="p-5 text-sm text-slate-500">No providers yet.</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="text-left px-4 py-2">Provider</th><th className="text-left px-4 py-2">NPI</th><th className="text-left px-4 py-2">Checks</th><th className="text-left px-4 py-2">Status</th><th className="px-4 py-2">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><div className="font-medium text-slate-800">{p.lastName}, {p.firstName}{p.credential ? `, ${p.credential}` : ""}</div><div className="text-[11px] text-slate-400">{p.taxonomy || "—"}</div></td>
                  <td className="px-4 py-2 font-mono text-xs">{p.npi}</td>
                  <td className="px-4 py-2 text-[11px]"><span className={p.nppesVerified ? "text-emerald-600" : "text-slate-400"}>NPPES {p.nppesVerified ? "✓" : "–"}</span> · <span className={p.oigClear === false ? "text-rose-600" : p.oigClear ? "text-emerald-600" : "text-slate-400"}>OIG {p.oigClear === false ? "✗" : p.oigClear ? "✓" : "?"}</span> · <span className={p.samClear === false ? "text-rose-600" : p.samClear ? "text-emerald-600" : "text-slate-400"}>SAM {p.samClear === false ? "✗" : p.samClear ? "✓" : "?"}</span></td>
                  <td className="px-4 py-2"><Chip s={p.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => validate(p.id)} disabled={busy === p.id} className="rounded-lg ring-1 ring-slate-300 text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">{busy === p.id ? "…" : "Validate"}</button>
                      <button onClick={() => startJob(p.id)} disabled={busy === p.id || p.status !== "validated"} title={p.status !== "validated" ? "Validate first" : "Create automation job"} className="rounded-lg bg-indigo-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">Start job</button>
                      <button onClick={() => removeProvider(p.id)} disabled={busy === p.id} className="text-xs text-rose-500 hover:underline">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card card-pad">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Re-credentialing reminders <span className="text-xs font-normal text-slate-400">(next 90 days & overdue)</span></h2>
          <span className="text-[11px] text-slate-400">{reminders.length} due</span>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-slate-500 mt-1">Nothing due soon. Add CAQH attestation / license dates to a provider to get alerts.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {reminders.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-700"><b>{r.name}</b> <span className="text-[11px] text-slate-400">· {r.type}{r.licenseState ? ` (${r.licenseState})` : ""}</span></span>
                <span className={`chip ${r.overdue ? "bg-rose-100 text-rose-700" : r.dueInDays <= 30 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                  {r.overdue ? `Overdue ${Math.abs(r.dueInDays)}d` : `in ${r.dueInDays}d`} · {new Date(r.date).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900">Twilio SMS relay</h2>
        <p className="text-sm text-slate-500">Point your Twilio number&apos;s <b>inbound-message webhook</b> at the URL below. When the CAQH OTP text arrives, Twilio forwards it here and the awaiting job resumes automatically.</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <code className="text-[11px] bg-slate-100 rounded px-2 py-1 text-slate-600 break-all">POST {origin}/api/credentialing/twilio/sms</code>
          <button onClick={() => navigator.clipboard?.writeText(`${origin}/api/credentialing/twilio/sms`)} className="text-[11px] text-indigo-600 hover:underline">copy URL</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Set <code>TWILIO_AUTH_TOKEN</code> to enable request-signature verification.</p>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Automation jobs ({jobs.length})</header>
        {jobs.length === 0 ? <div className="p-5 text-sm text-slate-500">No jobs yet. Validate a provider, then Start job.</div> : (
          <ul className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <li key={j.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium text-slate-800">{j.providerName} <span className="text-[11px] text-slate-400 font-mono">{j.npi}</span></div>
                  <div className="flex items-center gap-2"><Chip s={j.status} />{j.mfaReceivedAt && <span className="text-[11px] text-emerald-600">MFA received</span>}</div>
                </div>
                {j.error && <div className="text-[11px] text-rose-600 mt-1">{j.error}</div>}
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <code className="text-[10px] bg-slate-100 rounded px-2 py-1 text-slate-600 break-all">POST {origin}/api/credentialing/jobs/{j.id}/mfa</code>
                  <button onClick={() => navigator.clipboard?.writeText(`${origin}/api/credentialing/jobs/${j.id}/mfa`)} className="text-[11px] text-indigo-600 hover:underline">copy URL</button>
                  <button onClick={() => navigator.clipboard?.writeText(j.webhookToken)} className="text-[11px] text-indigo-600 hover:underline">copy token</button>
                  <a href={`/api/credentialing/jobs/${j.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-500 hover:underline">view package</a>
                </div>
                {Array.isArray(j.logs) && j.logs.length > 0 && (
                  <div className="mt-1 text-[10px] text-slate-400">{(j.logs as any[]).slice(-2).map((l, i) => <div key={i}>{new Date(l.at).toLocaleTimeString()} · {l.message}</div>)}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
