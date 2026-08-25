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

export function networkBadge(network: string): string {
  switch (network) {
    case "weno":
      return "bg-teal-100 text-teal-800 ring-teal-200";
    case "availity":
      return "bg-violet-100 text-violet-800 ring-violet-200";
    case "internal":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export default function PharmacyPicker({
  selected,
  onSelect,
  compact = false,
}: {
  selected: Pharmacy | null;
  onSelect: (pharmacy: Pharmacy | null) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // National registry (NPPES) fallback search
  const [nppesOpen, setNppesOpen] = useState(false);
  const [nf, setNf] = useState<{ name: string; city: string; state: string }>({ name: "", city: "", state: "" });
  const [nppesResults, setNppesResults] = useState<Array<{ npi: string; name: string; address1: string; city: string; state: string; postal: string; phone: string; fax: string }>>([]);
  const [nppesLoading, setNppesLoading] = useState(false);
  const [nppesErr, setNppesErr] = useState("");
  const [importingNpi, setImportingNpi] = useState<string | null>(null);

  async function searchNppes() {
    setNppesLoading(true); setNppesErr(""); setNppesResults([]);
    const p = new URLSearchParams();
    if (nf.name) p.set("name", nf.name);
    if (nf.city) p.set("city", nf.city);
    if (nf.state) p.set("state", nf.state);
    if (!nf.name && !nf.city) { setNppesErr("Enter a name or city."); setNppesLoading(false); return; }
    try {
      const r = await fetch(`/api/pharmacies/nppes?${p.toString()}`);
      const j = await r.json();
      if (!r.ok) { setNppesErr(j.error || "Search failed."); }
      else setNppesResults(j.pharmacies || []);
    } catch { setNppesErr("Search failed."); }
    setNppesLoading(false);
  }

  async function importAndSelect(ph: { npi: string; name: string; address1: string; city: string; state: string; postal: string; phone: string; fax: string }) {
    setImportingNpi(ph.npi);
    try {
      const r = await fetch("/api/pharmacies/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ph) });
      const j = await r.json();
      if (r.ok && j.pharmacy) {
        onSelect({ id: j.pharmacy.id, name: j.pharmacy.name, network: j.pharmacy.network || "weno", ncpdpId: j.pharmacy.ncpdpId, city: j.pharmacy.city, state: j.pharmacy.state, phone: j.pharmacy.phone });
        setOpen(false); setNppesOpen(false); setQuery("");
      }
    } finally { setImportingNpi(null); }
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/weno/pharmacies?q=${encodeURIComponent(query)}`);
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.pharmacies) ? data.pharmacies : [];
        setResults(
          list.map((p: any) => ({
            id: p.ncpdpId || p.id || p.name,
            ncpdpId: p.ncpdpId || null,
            name: p.name,
            network: "weno",
            city: p.city || null,
            state: p.state || null,
            phone: p.phone || null,
            preferred: false,
            services: p.isTest ? "test pharmacy" : null,
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-start justify-between gap-2 rounded-lg ring-1 ring-brand-200 bg-brand-50/70 px-3 py-2 animate-fade-in-up">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 truncate">{selected.name}</span>
              <span className={`chip ${networkBadge(selected.network)} capitalize`}>{selected.network}</span>
              {selected.preferred && <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Preferred</span>}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {[selected.city, selected.state].filter(Boolean).join(", ")}
              {selected.phone ? ` · ${selected.phone}` : ""}
              {selected.hours ? ` · ${selected.hours}` : ""}
            </div>
          </div>
          <button type="button" className="chip bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 shrink-0" onClick={() => onSelect(null)}>
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search Weno pharmacy directory by name, city, or NCPDP…"
            className="input"
          />
          {(open || query) && (
            <div className={`mt-1.5 rounded-lg ring-1 ring-slate-200 bg-white shadow-lg overflow-hidden ${compact ? "max-h-56" : "max-h-72"} overflow-y-auto divide-y divide-slate-100`}>
              {loading && <div className="px-3 py-2 text-xs text-slate-500">Searching the Weno directory…</div>}
              {!loading && results.length === 0 && (
                <div className="px-3 py-3 text-xs text-slate-500">No pharmacies match that search.</div>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-50 transition flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      {p.preferred && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Preferred" />}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {[p.city, p.state].filter(Boolean).join(", ")}
                      {p.hours ? ` · ${p.hours}` : ""}
                    </div>
                  </div>
                  <span className={`chip ${networkBadge(p.network)} capitalize shrink-0`}>{p.network}</span>
                </button>
              ))}
              <div className="px-3 py-2 bg-slate-50">
                {!nppesOpen ? (
                  <button type="button" onClick={() => setNppesOpen(true)} className="text-xs font-semibold text-brand-700 hover:underline">
                    Can&apos;t find it? Search the national registry (NPPES) →
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" placeholder="Name" value={nf.name} onChange={(e) => setNf((s) => ({ ...s, name: e.target.value }))} />
                      <input className="input" placeholder="City" value={nf.city} onChange={(e) => setNf((s) => ({ ...s, city: e.target.value }))} />
                      <input className="input" placeholder="State" value={nf.state} onChange={(e) => setNf((s) => ({ ...s, state: e.target.value.toUpperCase() }))} />
                    </div>
                    <button type="button" onClick={searchNppes} disabled={nppesLoading} className="chip bg-brand-600 text-white text-xs">{nppesLoading ? "Searching…" : "Search national registry"}</button>
                    {nppesErr && <div className="text-xs text-rose-600">{nppesErr}</div>}
                    <div className="max-h-48 overflow-auto divide-y divide-slate-100">
                      {nppesResults.map((ph) => (
                        <div key={ph.npi} className="flex items-start justify-between gap-2 py-1.5">
                          <div className="min-w-0 text-xs">
                            <div className="font-medium text-slate-900 truncate">{ph.name}</div>
                            <div className="text-slate-500 truncate">{ph.city}, {ph.state} {ph.phone ? `· ${ph.phone}` : ""}</div>
                          </div>
                          <button type="button" onClick={() => importAndSelect(ph)} disabled={importingNpi === ph.npi} className="chip bg-emerald-600 text-white text-[11px] shrink-0">{importingNpi === ph.npi ? "…" : "Add & select"}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
