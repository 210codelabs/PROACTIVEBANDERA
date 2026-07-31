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
    case "surescripts":
      return "bg-brand-100 text-brand-800 ring-brand-200";
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

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pharmacies/search?q=${encodeURIComponent(query)}`);
        const data = await res.json().catch(() => ({}));
        setResults(Array.isArray(data.pharmacies) ? data.pharmacies : []);
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
            placeholder="Search pharmacy by name, city, ZIP, or service…"
            className="input"
          />
          {(open || query) && (
            <div className={`mt-1.5 rounded-lg ring-1 ring-slate-200 bg-white shadow-lg overflow-hidden ${compact ? "max-h-56" : "max-h-72"} overflow-y-auto divide-y divide-slate-100`}>
              {loading && <div className="px-3 py-2 text-xs text-slate-500">Searching the pharmacy network…</div>}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
