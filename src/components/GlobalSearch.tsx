"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Hit = { id: string; mrn: string; firstName: string; lastName: string; dob: string };

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.results || []);
        setOpen(true);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </span>
        <input
          className="w-full pl-9 pr-16 py-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search patients by name, MRN, DOB…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q && setOpen(true)}
          suppressHydrationWarning
        />
        <span className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 gap-1">
          <kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd>
        </span>
      </div>
      {open && hits.length > 0 && (
        <div className="absolute mt-1 left-0 right-0 bg-white rounded-md ring-1 ring-slate-200 shadow-lg max-h-80 overflow-auto z-40">
          {hits.map(h => (
            <Link
              key={h.id}
              href={`/patients/${h.id}`}
              prefetch={false}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-50"
              onClick={() => setOpen(false)}
            >
              <span className="font-medium text-slate-900">{h.lastName}, {h.firstName}</span>
              <span className="text-xs text-slate-500">MRN {h.mrn} · DOB {new Date(h.dob).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
