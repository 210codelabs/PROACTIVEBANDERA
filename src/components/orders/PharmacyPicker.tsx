"use client";

import { useEffect, useRef, useState } from "react";

export type Pharmacy = {
  id: string;
  name: string;
  network: string;
  ncpdpId?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  hours?: string | null;
  services?: string | null;
  preferred?: boolean;
};

type Hit = {
  ncpdpId?: string | null;
  npi?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  source: "weno" | "local" | "nppes";
  routable?: boolean;
  wenoConnected?: boolean;
  isTest?: boolean;
};

export function networkBadge(network: string): string {
  switch (network) {
    case "weno": return "bg-teal-100 text-teal-800 ring-teal-200";
    case "nppes": return "bg-blue-100 text-blue-800 ring-blue-200";
    case "availity": return "bg-violet-100 text-violet-800 ring-violet-200";
    case "internal": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    default: return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export default function PharmacyPicker({
  selected,
  onSelect,
  compact = false,
  patientZip,
  showRecent = true,
}: {
  selected: Pharmacy | null;
  onSelect: (pharmacy: Pharmacy | null) => void;
  compact?: boolean;
  patientZip?: string | null;
  showRecent?: boolean;
}) {
  const [f, setF] = useState({ q: "", city: "", state: "", zip: "", address: "", npi: "" });
  const [showMore, setShowMore] = useState(false);
  const [results, setResults] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Hit[]>([]);
  const [byDistance, setByDistance] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zip5 = (patientZip || "").replace(/[^0-9]/g, "").slice(0, 5);
  const hasCriteria = Boolean(f.q || f.city || f.state || f.zip || f.address || f.npi);

  // Load the clinic's recently-used pharmacies once (quick-pick).
  useEffect(() => {
    if (!showRecent) return;
    let cancel = false;
    fetch("/api/weno/pharmacies/recent")
      .then((r) => r.json())
      .then((d) => { if (!cancel) setRecent(Array.isArray(d.pharmacies) ? d.pharmacies : []); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [showRecent]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!hasCriteria) { setResults([]); setTotal(0); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        if (f.q) p.set("q", f.q);
        if (f.city) p.set("city", f.city);
        if (f.state) p.set("state", f.state);
        if (f.zip) p.set("zip", f.zip);
        if (f.address) p.set("address", f.address);
        if (f.npi) p.set("npi", f.npi);
        if (byDistance && zip5) p.set("sortZip", zip5);
        const res = await fetch(`/api/weno/pharmacies?${p.toString()}`);
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.pharmacies) ? data.pharmacies : [];
        setResults(list);
        setTotal(typeof data.total === "number" ? data.total : list.length);
        setOpen(true);
      } catch { setResults([]); setTotal(0); } finally { setLoading(false); }
    }, 260);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q, f.city, f.state, f.zip, f.address, f.npi, byDistance, zip5]);

  function reset() { setF({ q: "", city: "", state: "", zip: "", address: "", npi: "" }); setResults([]); setTotal(0); }

  async function choose(h: Hit) {
    // National-registry (NPPES) hits have no NCPDP, so import them into the local
    // directory first (creates a routable record), then select.
    if (h.source === "nppes" && h.npi) {
      setImportingId(h.ncpdpId || h.npi);
      try {
        const r = await fetch("/api/pharmacies/import", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ npi: h.npi, name: h.name, address1: h.address, city: h.city, state: h.state, postal: h.zip, phone: h.phone }),
        });
        const j = await r.json();
        if (r.ok && j.pharmacy) {
          onSelect({ id: j.pharmacy.id, name: j.pharmacy.name, network: j.pharmacy.network || "weno", ncpdpId: j.pharmacy.ncpdpId, city: j.pharmacy.city, state: j.pharmacy.state, phone: j.pharmacy.phone });
          setOpen(false); reset();
        }
      } finally { setImportingId(null); }
      return;
    }
    onSelect({
      id: h.ncpdpId || h.name, ncpdpId: h.ncpdpId || null, name: h.name,
      network: h.source === "local" ? "internal" : "weno",
      city: h.city || null, state: h.state || null, phone: h.phone || null,
      services: h.isTest ? "test pharmacy" : (h.wenoConnected ? "Weno-connected" : null),
    });
    setOpen(false); reset();
  }

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg ring-1 ring-brand-200 bg-brand-50/70 px-3 py-2 animate-fade-in-up">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 truncate">{selected.name}</span>
            <span className={`chip ${networkBadge(selected.network)} capitalize`}>{selected.network}</span>
            {selected.preferred && <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Preferred</span>}
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            {[selected.city, selected.state].filter(Boolean).join(", ")}
            {selected.ncpdpId ? ` · NCPDP ${selected.ncpdpId}` : ""}
            {selected.phone ? ` · ${selected.phone}` : ""}
          </div>
        </div>
        <button type="button" className="chip bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 shrink-0" onClick={() => onSelect(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      <input
        value={f.q}
        onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
        onFocus={() => setOpen(true)}
        placeholder="Search pharmacy by name, NCPDP, or NPI…"
        className="input"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowMore((v) => !v)} className="text-[11px] font-medium text-brand-700 hover:underline">
          {showMore ? "Fewer fields" : "Search by address / city / state / zip / NPI"}
        </button>
        {zip5 && (
          <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
            <input type="checkbox" checked={byDistance} onChange={(e) => setByDistance(e.target.checked)} />
            Sort by distance to {zip5}
          </label>
        )}
        {hasCriteria && <button type="button" onClick={reset} className="text-[11px] text-slate-400 hover:underline">Clear</button>}
      </div>

      {showRecent && recent.length > 0 && !hasCriteria && (
        <div className="rounded-lg ring-1 ring-slate-200 bg-slate-50/60 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Recently used</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((h, i) => (
              <button
                key={`${h.ncpdpId || h.name}-${i}`}
                type="button"
                onClick={() => choose(h)}
                className="inline-flex items-center gap-1 rounded-full bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:bg-brand-50 px-2.5 py-1 text-[11px] text-slate-700"
                title={[h.city, h.state, h.zip].filter(Boolean).join(", ")}
              >
                <span className="font-medium truncate max-w-[160px]">{h.name}</span>
                {h.city && <span className="text-slate-400">· {h.city}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {showMore && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input className="input" placeholder="Address" value={f.address} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} />
          <input className="input" placeholder="City" value={f.city} onChange={(e) => setF((s) => ({ ...s, city: e.target.value }))} />
          <input className="input" placeholder="State" value={f.state} onChange={(e) => setF((s) => ({ ...s, state: e.target.value.toUpperCase().slice(0, 2) }))} />
          <input className="input" placeholder="Zip" value={f.zip} onChange={(e) => setF((s) => ({ ...s, zip: e.target.value }))} />
          <input className="input" placeholder="NPI" inputMode="numeric" value={f.npi} onChange={(e) => setF((s) => ({ ...s, npi: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) }))} />
        </div>
      )}

      {open && hasCriteria && (
        <div className={`rounded-lg ring-1 ring-slate-200 bg-white shadow-lg overflow-hidden`}>
          {/* Sticky count header so staff can see the full match count and scroll. */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px]">
            <span className="text-slate-600">
              {loading ? "Searching Weno directory + national registry…"
                : results.length === 0 ? "No pharmacies match that search."
                : total > results.length
                  ? <>Showing <b>{results.length}</b> of <b>{total}</b> matches — refine city/zip/NPI to narrow</>
                  : <><b>{results.length}</b> {results.length === 1 ? "match" : "matches"}</>}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <div className={`${compact ? "max-h-72" : "max-h-96"} overflow-y-auto divide-y divide-slate-100`}>
          {results.map((h, i) => (
            <button
              key={`${h.ncpdpId || h.npi || h.name}-${i}`}
              type="button"
              onClick={() => choose(h)}
              disabled={importingId === (h.ncpdpId || h.npi)}
              className="w-full text-left px-3 py-2 hover:bg-brand-50 transition flex items-start justify-between gap-2 disabled:opacity-60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 truncate">{h.name}</span>
                  {h.isTest && <span className="chip bg-amber-100 text-amber-800 text-[9px]">TEST</span>}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {[h.address, h.city, h.state, h.zip].filter(Boolean).join(", ")}
                  {h.ncpdpId && !String(h.ncpdpId).startsWith("nppes:") ? ` · NCPDP ${h.ncpdpId}` : ""}
                  {h.npi ? ` · NPI ${h.npi}` : ""}
                  {h.wenoConnected ? " · ✓ Weno-connected" : ""}
                  {h.source === "nppes" ? " · not on Weno — will be added" : ""}
                </div>
              </div>
              <span className={`chip ${networkBadge(h.source)} capitalize shrink-0`}>
                {importingId === (h.ncpdpId || h.npi) ? "…" : h.source === "nppes" ? "National" : h.source === "local" ? "Saved" : "Weno"}
              </span>
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
