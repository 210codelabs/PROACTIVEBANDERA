"use client";

import React, { useCallback, useEffect, useState } from "react";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number };
type Hit = { id: string; mrn: string; firstName: string; lastName: string };
type Entry = {
  id: string; patientId: string; patientName: string; mrn: string;
  providerId: string | null; providerName: string; reason: string | null;
  preferredFrom: string | null; note: string | null; priority: number; createdAt: string;
};

export default function WaitlistManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // add form
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [reason, setReason] = useState("");
  const [preferredFrom, setPreferredFrom] = useState("");
  const [priority, setPriority] = useState(0);

  const load = useCallback(async () => {
    try {
      const [w, refs] = await Promise.all([
        fetch("/api/waitlist").then((r) => r.json()),
        fetch("/api/appointments?from=2100-01-01&to=2100-01-01").then((r) => r.json()),
      ]);
      setEntries(w.entries || []);
      setProviders(refs.providers || []);
      setServices(refs.services || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      try { const d = await (await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=8`)).json(); setHits(d.results || []); }
      catch { setHits([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function add() {
    if (!patientId) { setMsg("Choose a patient first."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, providerId: providerId || null, serviceTypeId: serviceTypeId || null, reason, preferredFrom: preferredFrom || null, priority }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Could not add."); return; }
      setPatientId(""); setPatientLabel(""); setQ(""); setReason(""); setPreferredFrom(""); setPriority(0); setServiceTypeId("");
      await load();
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try { await fetch(`/api/waitlist/${id}`, { method: "DELETE" }); await load(); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900 mb-3">Add to waitlist</h2>
        {msg && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm mb-3">{msg}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <span className="label">Patient</span>
            {patientId ? (
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
                      <li key={h.id}><button onClick={() => { setPatientId(h.id); setPatientLabel(`${h.lastName}, ${h.firstName} (${h.mrn})`); setHits([]); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50">{h.lastName}, {h.firstName} <span className="text-xs text-slate-500">MRN {h.mrn}</span></button></li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <label className="block">
            <span className="label">Preferred provider</span>
            <select className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Any provider</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Service</span>
            <select className="input" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
              <option value="">Any</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin}m)</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Earliest acceptable date</span>
            <input type="date" className="input" value={preferredFrom} onChange={(e) => setPreferredFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Priority</span>
            <select className="input" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              <option value={0}>Normal</option>
              <option value={5}>High</option>
              <option value={10}>Urgent</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Reason / note</span>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wants earlier PT slot" />
          </label>
        </div>
        <div className="mt-3">
          <button onClick={add} disabled={busy || !patientId} className="btn-primary">Add to waitlist</button>
        </div>
      </section>

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Waiting ({entries.length})</h2>
        </header>
        <div className="p-4">
          {loading ? <p className="text-sm text-slate-400">Loading…</p> : entries.length === 0 ? (
            <p className="text-sm text-slate-500">No one is on the waitlist. When an appointment is cancelled, the next matching patient here is offered the freed slot.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e.id} className="py-2.5 flex flex-wrap items-center gap-2 text-sm">
                  {e.priority >= 10 ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200">Urgent</span> : e.priority >= 5 ? <span className="chip bg-amber-100 text-amber-800 ring-amber-200">High</span> : null}
                  <span className="font-medium text-slate-900">{e.patientName}</span>
                  <span className="text-xs text-slate-500">MRN {e.mrn}</span>
                  <span className="text-xs text-slate-600">· {e.providerName}</span>
                  {e.reason && <span className="text-xs text-slate-500 truncate">· {e.reason}</span>}
                  {e.preferredFrom && <span className="chip bg-slate-100 text-slate-600 ring-slate-200">from {e.preferredFrom}</span>}
                  <button onClick={() => remove(e.id)} disabled={busy} className="ml-auto text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
