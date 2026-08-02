"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Hit = { id: string; mrn: string; firstName: string; lastName: string; dob: string; sex?: string; status?: string; phone?: string };

const SORT_OPTIONS = [
  { value: "name_asc", label: "Last name (A–Z)" },
  { value: "name_desc", label: "Last name (Z–A)" },
  { value: "dob_asc", label: "DOB (oldest)" },
  { value: "dob_desc", label: "DOB (newest)" },
  { value: "created_desc", label: "Recently added" },
  { value: "mrn_asc", label: "MRN" },
];

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("");
  const [sex, setSex] = useState("");
  const [sort, setSort] = useState("name_asc");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeFilters = (status ? 1 : 0) + (sex ? 1 : 0) + (sort !== "name_asc" ? 1 : 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowFilters(false); }
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    if (!q.trim() && !status && !sex) { setHits([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (sex) params.set("sex", sex);
      params.set("sort", sort);
      params.set("limit", "20");
      const res = await fetch(`/api/patients/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.results || []);
        setOpen(true);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, status, sex, sort]);

  const clearFilters = () => { setStatus(""); setSex(""); setSort("name_asc"); };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </span>
        <input
          ref={inputRef}
          className="w-full pl-9 pr-24 py-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search by name, last name, DOB, MRN…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => (q || hits.length) && setOpen(true)}
          suppressHydrationWarning
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            title="Filters & sorting"
            className={`relative h-7 w-7 grid place-items-center rounded-md transition ${showFilters || activeFilters ? "bg-brand-100 text-brand-700" : "text-slate-400 hover:bg-slate-100"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-brand-600 text-white text-[9px] font-bold grid place-items-center">{activeFilters}</span>}
          </button>
          <span className="hidden md:flex gap-1"><kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd></span>
        </span>
      </div>

      {showFilters && (
        <div className="absolute mt-1 left-0 right-0 bg-white rounded-md ring-1 ring-slate-200 shadow-lg z-50 p-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full text-sm rounded-md border border-slate-200 py-1.5 px-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deceased">Deceased</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Sex</span>
              <select value={sex} onChange={e => setSex(e.target.value)} className="mt-1 w-full text-sm rounded-md border border-slate-200 py-1.5 px-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">All</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="X">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Sort by</span>
              <select value={sort} onChange={e => setSort(e.target.value)} className="mt-1 w-full text-sm rounded-md border border-slate-200 py-1.5 px-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[11px] text-slate-400">Tip: type a date like 1958-04-12 or a year to search by DOB.</span>
            {activeFilters > 0 && <button onClick={clearFilters} className="text-xs text-brand-700 hover:underline">Clear filters</button>}
          </div>
        </div>
      )}

      {open && !showFilters && (
        <div className="absolute mt-1 left-0 right-0 bg-white rounded-md ring-1 ring-slate-200 shadow-lg max-h-96 overflow-auto z-40">
          {loading && hits.length === 0 && <div className="px-3 py-3 text-sm text-slate-400">Searching…</div>}
          {!loading && hits.length === 0 && (q || status || sex) && <div className="px-3 py-3 text-sm text-slate-400">No patients match.</div>}
          {hits.map(h => (
            <Link
              key={h.id}
              href={`/patients/${h.id}`}
              prefetch={false}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-50"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-slate-900 truncate">{h.lastName}, {h.firstName}</span>
                {h.status && h.status !== "active" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${h.status === "deceased" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{h.status}</span>
                )}
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap">MRN {h.mrn} · DOB {new Date(h.dob).toLocaleDateString()}</span>
            </Link>
          ))}
          {hits.length >= 20 && <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100">Showing first 20 — refine your search or filters.</div>}
        </div>
      )}
    </div>
  );
}
