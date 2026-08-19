"use client";

import React, { useCallback, useEffect, useState } from "react";

type Specialty = { id: string; slug: string; name: string; description?: string | null; providerCount: number; patientCount: number };
type ProviderLink = { id: string; userId: string; role?: string | null; name: string; credential?: string | null; specialty?: string | null };
type PatientLink = { id: string; patientId: string; name: string; mrn?: string | null; note?: string | null; providerId?: string | null; providerName?: string | null };
type ProviderOpt = { id: string; name: string; credential?: string | null; specialty?: string | null; role: string };
type Detail = { specialty: { id: string; name: string; description?: string | null }; providers: ProviderLink[]; patients: PatientLink[] };

export default function SpecialtiesClient() {
  const [list, setList] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [providerOpts, setProviderOpts] = useState<ProviderOpt[]>([]);
  const [provPick, setProvPick] = useState("");
  const [provRole, setProvRole] = useState("");

  const [patQ, setPatQ] = useState("");
  const [patResults, setPatResults] = useState<{ id: string; firstName: string; lastName: string; mrn: string }[]>([]);
  const [patProvider, setPatProvider] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/specialties");
      const d = await r.json();
      setList(d.specialties || []);
      if (!selectedId && d.specialties?.length) setSelectedId(d.specialties[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailBusy(true);
    try {
      const r = await fetch(`/api/specialties/${id}`);
      const d = await r.json();
      if (r.ok) setDetail(d);
    } finally {
      setDetailBusy(false);
    }
  }, []);

  useEffect(() => { loadList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => { fetch("/api/providers").then((r) => r.json()).then((d) => setProviderOpts(d.providers || [])).catch(() => {}); }, []);

  // Patient typeahead
  useEffect(() => {
    if (patQ.trim().length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/patients/search?q=${encodeURIComponent(patQ.trim())}&limit=8`);
      const d = await r.json();
      setPatResults(d.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [patQ]);

  async function addSpecialty(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddBusy(true); setErr(null);
    try {
      const r = await fetch("/api/specialties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not add specialty."); return; }
      setNewName("");
      await loadList();
      setSelectedId(d.specialty.id);
    } finally {
      setAddBusy(false);
    }
  }

  async function linkProvider() {
    if (!selectedId || !provPick) return;
    const r = await fetch(`/api/specialties/${selectedId}/providers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: provPick, role: provRole || null }) });
    if (r.ok) { setProvPick(""); setProvRole(""); await loadDetail(selectedId); await loadList(); }
  }
  async function unlinkProvider(linkId: string) {
    if (!selectedId) return;
    await fetch(`/api/specialties/${selectedId}/providers?linkId=${linkId}`, { method: "DELETE" });
    await loadDetail(selectedId); await loadList();
  }
  async function connectPatient(patientId: string) {
    if (!selectedId) return;
    const r = await fetch(`/api/specialties/${selectedId}/patients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, providerId: patProvider || null }) });
    if (r.ok) { setPatQ(""); setPatResults([]); setPatProvider(""); await loadDetail(selectedId); await loadList(); }
  }
  async function disconnectPatient(linkId: string) {
    if (!selectedId) return;
    await fetch(`/api/specialties/${selectedId}/patients?linkId=${linkId}`, { method: "DELETE" });
    await loadDetail(selectedId); await loadList();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: specialty list + add */}
      <section className="card overflow-hidden lg:col-span-1">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Specialties</header>
        <form onSubmit={addSpecialty} className="p-3 flex gap-2 border-b border-slate-100">
          <input className="input flex-1" placeholder="Add specialty (e.g. Cardiology)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn-primary" disabled={addBusy} type="submit">{addBusy ? "…" : "Add"}</button>
        </form>
        {err && <div className="px-3 py-2 text-xs text-rose-600">{err}</div>}
        <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
          {loading && <li className="px-4 py-6 text-center text-slate-400 text-sm">Loading…</li>}
          {!loading && list.length === 0 && <li className="px-4 py-6 text-center text-slate-400 text-sm">No specialties yet.</li>}
          {list.map((s) => (
            <li key={s.id}>
              <button onClick={() => setSelectedId(s.id)} className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 ${selectedId === s.id ? "bg-sky-50" : ""}`}>
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="text-[11px] text-slate-500">{s.providerCount} provider{s.providerCount === 1 ? "" : "s"} · {s.patientCount} patient{s.patientCount === 1 ? "" : "s"}</div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Right: detail */}
      <section className="lg:col-span-2 space-y-4">
        {!detail && <div className="card card-pad text-slate-400">Select a specialty to manage its providers and patients.</div>}
        {detail && (
          <>
            <div className="card card-pad">
              <h2 className="text-lg font-bold text-slate-900">{detail.specialty.name}</h2>
              {detail.specialty.description && <p className="text-sm text-slate-500">{detail.specialty.description}</p>}
            </div>

            {/* Providers */}
            <div className="card overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Providers / specialists</header>
              <div className="p-3 flex flex-wrap gap-2 border-b border-slate-100">
                <select className="input flex-1 min-w-[180px]" value={provPick} onChange={(e) => setProvPick(e.target.value)}>
                  <option value="">Select a provider…</option>
                  {providerOpts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.credential ? `, ${p.credential}` : ""}{p.specialty ? ` · ${p.specialty}` : ""}</option>)}
                </select>
                <input className="input w-32" placeholder="Role (opt.)" value={provRole} onChange={(e) => setProvRole(e.target.value)} />
                <button className="btn-primary" onClick={linkProvider} disabled={!provPick}>Link</button>
              </div>
              <ul className="divide-y divide-slate-100">
                {detail.providers.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">No providers linked.</li>}
                {detail.providers.map((p) => (
                  <li key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                    <div className="flex-1">
                      <span className="font-medium text-slate-900">{p.name}</span>
                      {p.credential && <span className="text-slate-500">, {p.credential}</span>}
                      {p.role && <span className="chip bg-sky-100 text-sky-800 ring-sky-200 text-[10px] ml-2">{p.role}</span>}
                    </div>
                    <button onClick={() => unlinkProvider(p.id)} className="text-rose-600 text-xs hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Patients */}
            <div className="card overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Connected patients</header>
              <div className="p-3 border-b border-slate-100 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[180px]" placeholder="Search patient by name / MRN…" value={patQ} onChange={(e) => setPatQ(e.target.value)} />
                  <select className="input w-48" value={patProvider} onChange={(e) => setPatProvider(e.target.value)}>
                    <option value="">Assign specialist (opt.)</option>
                    {detail.providers.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                  </select>
                </div>
                {patResults.length > 0 && (
                  <ul className="rounded-lg ring-1 ring-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {patResults.map((p) => (
                      <li key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
                        <span>{p.lastName}, {p.firstName} <span className="text-slate-400 font-mono text-xs">{p.mrn}</span></span>
                        <button onClick={() => connectPatient(p.id)} className="btn-secondary py-1 px-2 text-xs">Connect</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ul className="divide-y divide-slate-100">
                {detail.patients.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">No patients connected.</li>}
                {detail.patients.map((p) => (
                  <li key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                    <div className="flex-1">
                      <a href={`/patients/${p.patientId}`} className="font-medium text-brand-700 hover:underline">{p.name}</a>
                      {p.mrn && <span className="text-slate-400 font-mono text-xs ml-2">{p.mrn}</span>}
                      {p.providerName && <span className="text-slate-500 text-xs ml-2">· {p.providerName}</span>}
                    </div>
                    <button onClick={() => disconnectPatient(p.id)} className="text-rose-600 text-xs hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {detailBusy && <div className="text-xs text-slate-400">Updating…</div>}
      </section>
    </div>
  );
}
