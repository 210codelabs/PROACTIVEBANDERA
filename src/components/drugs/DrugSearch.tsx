"use client";
import { useEffect, useRef, useState } from "react";
import type { DrugHit } from "@/lib/openfda";

/**
 * Medication typeahead backed by the openFDA NDC Directory.
 * Additive: it sits above existing manual fields; selecting a result calls
 * onSelect with the normalized drug so the parent can auto-fill.
 */
export default function DrugSearch({
  onSelect,
  placeholder = "Search medications (openFDA)…",
  className = "",
  autoFocus = false,
  searchUrl = "/api/drugs/search",
}: {
  onSelect: (d: DrugHit) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  searchUrl?: string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<DrugHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const justPicked = useRef(false);

  useEffect(() => {
    // Skip the search that would otherwise fire right after a programmatic pick
    // (we set the input value to the selected drug's display name).
    if (justPicked.current) { justPicked.current = false; setItems([]); setOpen(false); return; }
    if (q.trim().length < 2) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setErr(false);
      try {
        const r = await fetch(`${searchUrl}?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const j = await r.json();
        setItems(j.results || []);
        setOpen(true);
      } catch (e: any) {
        if (e?.name !== "AbortError") { setErr(true); setItems([]); }
      } finally { setLoading(false); }
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(d: DrugHit) {
    onSelect(d);
    justPicked.current = true;
    setQ(d.display || d.brandName || d.genericName || "");
    setItems([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
        <input
          className="input w-full pl-9"
          placeholder={placeholder}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
        />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">searching…</span>}
      </div>

      {open && (q.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-auto rounded-lg bg-white ring-1 ring-slate-200 shadow-lg">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>openFDA NDC Directory</span>
            {err && <span className="text-rose-500">lookup unavailable</span>}
          </div>
          {(!loading && items.length === 0) && (
            <div className="px-3 py-4 text-sm text-slate-400">No matching FDA products.</div>
          )}
          {items.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => pick(d)}
              className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-slate-50 last:border-0"
            >
              <div className="font-medium text-slate-900">
                {d.brandName || d.genericName}
                {d.strengths[0] ? <span className="text-slate-500 font-normal"> · {d.strengths[0]}</span> : null}
              </div>
              <div className="text-xs text-slate-500">
                {[d.genericName && d.genericName !== d.brandName ? d.genericName : null, d.dosageForm, d.route].filter(Boolean).join(" · ")}
              </div>
              <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                {d.productNdc && <span>NDC {d.productNdc}</span>}
                {d.deaSchedule && <span className="text-amber-600 font-semibold">C-{d.deaSchedule.replace(/[^IV]/gi, "") || d.deaSchedule}</span>}
                {d.labelerName && <span className="truncate max-w-[220px]">{d.labelerName}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
