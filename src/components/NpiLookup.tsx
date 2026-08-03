"use client";

import React, { useState } from "react";

type Tax = { code: string; desc: string; primary: boolean; state: string; license: string };
type Addr = { address1: string; city: string; state: string; postal: string; phone: string; fax: string } | null;
type Provider = {
  npi: string; type: string; name: string; credential: string; gender: string; status: string;
  enumerationDate: string; lastUpdated: string; authorizedOfficial: string;
  primaryTaxonomy: Tax | null; taxonomies: Tax[]; practice: Addr; mailing: Addr;
};
type Pharmacy = { npi: string; name: string; taxonomy: string; address1: string; city: string; state: string; postal: string; phone: string; fax: string };

const US_STATES = ["", "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export default function NpiLookup() {
  const [tab, setTab] = useState<"provider" | "pharmacy">("provider");
  return (
    <div>
      <div className="inline-flex rounded-lg bg-slate-100 p-1 mb-4">
        <button onClick={() => setTab("provider")} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${tab === "provider" ? "bg-white shadow text-brand-700" : "text-slate-500"}`}>Provider / Credentialing</button>
        <button onClick={() => setTab("pharmacy")} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${tab === "pharmacy" ? "bg-white shadow text-brand-700" : "text-slate-500"}`}>Pharmacy Locator</button>
      </div>
      {tab === "provider" ? <ProviderSearch /> : <PharmacySearch />}
    </div>
  );
}

function ProviderSearch() {
  const [f, setF] = useState<Record<string, string>>({ type: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<Provider[] | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function search() {
    setBusy(true); setErr(""); setResults(null);
    const p = new URLSearchParams();
    if (f.npi) p.set("npi", f.npi);
    if (f.first_name) p.set("first_name", f.first_name);
    if (f.last_name) p.set("last_name", f.last_name);
    if (f.organization_name) p.set("organization_name", f.organization_name);
    if (f.taxonomy) p.set("taxonomy", f.taxonomy);
    if (f.city) p.set("city", f.city);
    if (f.state) p.set("state", f.state);
    if (f.postal) p.set("postal", f.postal);
    if (f.type) p.set("type", f.type);
    const r = await fetch(`/api/nppes/search?${p.toString()}`);
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Search failed."); return; }
    setResults(j.results || []);
  }

  return (
    <div>
      <div className="card card-pad">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <L label="NPI number"><input className="input" value={f.npi || ""} onChange={(e) => set("npi", e.target.value)} placeholder="10 digits" /></L>
          <L label="First name"><input className="input" value={f.first_name || ""} onChange={(e) => set("first_name", e.target.value)} /></L>
          <L label="Last name"><input className="input" value={f.last_name || ""} onChange={(e) => set("last_name", e.target.value)} /></L>
          <L label="Organization"><input className="input" value={f.organization_name || ""} onChange={(e) => set("organization_name", e.target.value)} /></L>
          <L label="Taxonomy / specialty"><input className="input" value={f.taxonomy || ""} onChange={(e) => set("taxonomy", e.target.value)} placeholder="e.g. Physical Therapist" /></L>
          <L label="City"><input className="input" value={f.city || ""} onChange={(e) => set("city", e.target.value)} /></L>
          <L label="State"><select className="input" value={f.state || ""} onChange={(e) => set("state", e.target.value)}>{US_STATES.map((s) => <option key={s} value={s}>{s || "Any"}</option>)}</select></L>
          <L label="ZIP"><input className="input" value={f.postal || ""} onChange={(e) => set("postal", e.target.value)} /></L>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button disabled={busy} onClick={search} className="btn-primary">{busy ? "Searching…" : "Search NPPES"}</button>
          <span className="text-xs text-slate-400">Tip: NPI alone gives an exact match. Combine name + state to narrow results.</span>
        </div>
        {err && <div className="text-sm text-rose-700 mt-2">{err}</div>}
      </div>

      {results && (
        <div className="mt-4 space-y-3">
          {results.length === 0 && <div className="card card-pad text-sm text-slate-500">No matching providers found.</div>}
          {results.map((r) => (
            <div key={r.npi} className="card card-pad">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{r.name || "(no name)"}</span>
                {r.credential && <span className="chip bg-brand-100 text-brand-800 ring-brand-200 text-xs">{r.credential}</span>}
                <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-xs">{r.type}</span>
                <span className={`chip text-xs ${r.status === "A" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{r.status === "A" ? "Active" : (r.status || "?")}</span>
              </div>
              <div className="text-sm text-slate-600 mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
                <span>NPI: <b>{r.npi}</b></span>
                {r.primaryTaxonomy && <span>Specialty: {r.primaryTaxonomy.desc}</span>}
                {r.primaryTaxonomy?.license && <span>License: {r.primaryTaxonomy.license} ({r.primaryTaxonomy.state})</span>}
                {r.gender && <span>Gender: {r.gender}</span>}
                {r.practice && <span>{r.practice.address1}, {r.practice.city} {r.practice.state} {r.practice.postal}</span>}
                {r.practice?.phone && <span>☎ {r.practice.phone}</span>}
                {r.enumerationDate && <span>Enumerated: {r.enumerationDate}</span>}
                {r.authorizedOfficial && <span>Authorized official: {r.authorizedOfficial}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PharmacySearch() {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<Pharmacy[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function search() {
    setBusy(true); setErr(""); setResults(null);
    const p = new URLSearchParams();
    if (f.name) p.set("name", f.name);
    if (f.city) p.set("city", f.city);
    if (f.state) p.set("state", f.state);
    if (f.postal) p.set("postal", f.postal);
    const r = await fetch(`/api/pharmacies/nppes?${p.toString()}`);
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Search failed."); return; }
    setResults(j.pharmacies || []);
  }

  async function importPharmacy(ph: Pharmacy) {
    setSaved((s) => ({ ...s, [ph.npi]: "saving" }));
    const r = await fetch("/api/pharmacies/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ph) });
    setSaved((s) => ({ ...s, [ph.npi]: r.ok ? "saved" : "error" }));
  }

  return (
    <div>
      <div className="card card-pad">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <L label="Pharmacy name"><input className="input" value={f.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="CVS, Walgreens…" /></L>
          <L label="City"><input className="input" value={f.city || ""} onChange={(e) => set("city", e.target.value)} /></L>
          <L label="State"><select className="input" value={f.state || ""} onChange={(e) => set("state", e.target.value)}>{US_STATES.map((s) => <option key={s} value={s}>{s || "Any"}</option>)}</select></L>
          <L label="ZIP"><input className="input" value={f.postal || ""} onChange={(e) => set("postal", e.target.value)} /></L>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button disabled={busy} onClick={search} className="btn-primary">{busy ? "Searching…" : "Find pharmacies"}</button>
          <span className="text-xs text-slate-400">Searches all US pharmacies in the NPPES registry. Import one to use it for e-prescribe routing.</span>
        </div>
        {err && <div className="text-sm text-rose-700 mt-2">{err}</div>}
      </div>

      {results && (
        <div className="mt-4 space-y-3">
          {results.length === 0 && <div className="card card-pad text-sm text-slate-500">No pharmacies found. Try a city or ZIP.</div>}
          {results.map((ph) => (
            <div key={ph.npi} className="card card-pad flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">{ph.name}</div>
                <div className="text-sm text-slate-600 mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
                  <span>NPI: {ph.npi}</span>
                  {ph.taxonomy && <span>{ph.taxonomy}</span>}
                  <span>{ph.address1}, {ph.city} {ph.state} {ph.postal}</span>
                  {ph.phone && <span>☎ {ph.phone}</span>}
                  {ph.fax && <span>Fax {ph.fax}</span>}
                </div>
              </div>
              <button
                onClick={() => importPharmacy(ph)}
                disabled={saved[ph.npi] === "saving" || saved[ph.npi] === "saved"}
                className={`chip text-xs ${saved[ph.npi] === "saved" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-brand-600 text-white"}`}
              >
                {saved[ph.npi] === "saved" ? "✓ Imported" : saved[ph.npi] === "saving" ? "Saving…" : saved[ph.npi] === "error" ? "Retry" : "Import to directory"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
