"use client";

import React, { useEffect, useState } from "react";

type Member = { id: string; npi?: string | null; name: string; credential?: string | null; specialty?: string | null; role?: string | null; phone?: string | null; address?: string | null };
type Hit = { npi: string; type: string; name: string; credential: string; status: string; primaryTaxonomy: { desc: string; license: string; state: string } | null; practice: { address1: string; city: string; state: string; postal: string; phone: string } | null };

const ROLES = ["Referring", "PCP", "Specialist", "Consultant", "Other"];

export default function PatientCareTeam({ patientId }: { patientId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);

  // search state
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [role, setRole] = useState("Referring");
  const [savingNpi, setSavingNpi] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/patients/${patientId}/care-team`);
    if (r.ok) setMembers((await r.json()).members || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    setBusy(true); setErr(""); setHits(null);
    const p = new URLSearchParams();
    if (f.npi) p.set("npi", f.npi);
    if (f.first_name) p.set("first_name", f.first_name);
    if (f.last_name) p.set("last_name", f.last_name);
    if (f.state) p.set("state", f.state);
    p.set("type", "NPI-1");
    const r = await fetch(`/api/nppes/search?${p.toString()}`);
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Search failed."); return; }
    setHits(j.results || []);
  }

  async function attach(h: Hit) {
    setSavingNpi(h.npi); setErr("");
    const body = {
      npi: h.npi, name: h.name, credential: h.credential,
      specialty: h.primaryTaxonomy?.desc || "",
      phone: h.practice?.phone || "",
      address: h.practice ? `${h.practice.address1}, ${h.practice.city} ${h.practice.state} ${h.practice.postal}` : "",
      role, source: "nppes",
    };
    const r = await fetch(`/api/patients/${patientId}/care-team`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setSavingNpi(null);
    if (!r.ok) { setErr(j.error || "Could not add."); return; }
    setAdding(false); setHits(null); setF({});
    load();
  }

  async function remove(memberId: string) {
    await fetch(`/api/patients/${patientId}/care-team?memberId=${memberId}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">Referring & external providers attached from the NPI registry.</p>
        <button onClick={() => { setAdding((v) => !v); setErr(""); setHits(null); }} className="chip bg-brand-600 text-white text-xs">{adding ? "Close" : "+ Add provider (NPI)"}</button>
      </div>

      {adding && (
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 mb-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input className="input" placeholder="NPI" value={f.npi || ""} onChange={(e) => setF((s) => ({ ...s, npi: e.target.value }))} />
            <input className="input" placeholder="First name" value={f.first_name || ""} onChange={(e) => setF((s) => ({ ...s, first_name: e.target.value }))} />
            <input className="input" placeholder="Last name" value={f.last_name || ""} onChange={(e) => setF((s) => ({ ...s, last_name: e.target.value }))} />
            <input className="input" placeholder="State (TX)" value={f.state || ""} onChange={(e) => setF((s) => ({ ...s, state: e.target.value.toUpperCase() }))} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button disabled={busy} onClick={search} className="btn-primary text-sm">{busy ? "Searching…" : "Search NPPES"}</button>
            <span className="text-xs text-slate-400">Role applies to the provider you attach.</span>
          </div>
          {err && <div className="text-sm text-rose-700 mt-2">{err}</div>}
          {hits && (
            <div className="mt-3 space-y-2 max-h-72 overflow-auto">
              {hits.length === 0 && <div className="text-sm text-slate-500">No providers found.</div>}
              {hits.map((h) => (
                <div key={h.npi} className="flex items-start justify-between gap-3 rounded-md bg-white ring-1 ring-slate-200 p-2">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">{h.name}</span>
                    {h.credential && <span className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px] ml-2">{h.credential}</span>}
                    <div className="text-xs text-slate-500">NPI {h.npi}{h.primaryTaxonomy ? ` · ${h.primaryTaxonomy.desc}` : ""}{h.practice ? ` · ${h.practice.city}, ${h.practice.state}` : ""}</div>
                  </div>
                  <button disabled={savingNpi === h.npi} onClick={() => attach(h)} className="chip bg-emerald-600 text-white text-xs shrink-0">{savingNpi === h.npi ? "Saving…" : "Attach"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No care-team providers yet.</div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-md ring-1 ring-slate-200 p-2">
              <div className="text-sm">
                <span className="font-semibold text-slate-900">{m.name}</span>
                {m.credential && <span className="text-slate-500">, {m.credential}</span>}
                {m.role && <span className="chip bg-violet-100 text-violet-800 ring-violet-200 text-[10px] ml-2">{m.role}</span>}
                <div className="text-xs text-slate-500">{[m.npi ? `NPI ${m.npi}` : "", m.specialty, m.phone, m.address].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={() => remove(m.id)} className="chip bg-white ring-slate-200 text-slate-500 text-xs shrink-0">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
