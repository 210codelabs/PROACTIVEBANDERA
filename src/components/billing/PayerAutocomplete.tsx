"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Typeahead for insurer / payer. As staff type an insurer name it searches the
 * Stedi payer directory (live) and the local payer directory, and lets them
 * pick a match — which fills the payer name and the Stedi payer ID.
 */

type Suggestion = { name: string; payerId: string; source: "stedi" | "local" };

export default function PayerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an insurer name…",
  className = "input",
}: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (sel: { name: string; payerId: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) { setItems([]); return; }
    setLoading(true);
    const out: Suggestion[] = [];
    try {
      // Live Stedi search
      const r = await fetch(`/api/stedi/payers?stedi=${encodeURIComponent(q)}`);
      if (r.ok) {
        const d = await r.json();
        for (const x of d.results || []) {
          const name = x.displayName || x.name || x.payerName;
          const payerId = x.stediId || x.payerId || x.primaryPayerId || "";
          if (name && payerId) out.push({ name, payerId, source: "stedi" });
        }
      }
    } catch { /* ignore */ }
    if (out.length === 0) {
      try {
        // Local directory fallback
        const r = await fetch(`/api/stedi/payers`);
        if (r.ok) {
          const d = await r.json();
          const ql = q.toLowerCase();
          for (const x of d.payers || []) {
            if (x.name && x.stediId && x.name.toLowerCase().includes(ql)) {
              out.push({ name: x.name, payerId: x.stediId, source: "local" });
            }
          }
        }
      } catch { /* ignore */ }
    }
    setItems(out.slice(0, 8));
    setLoading(false);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 300);
  }

  function pick(s: Suggestion) {
    onSelect({ name: s.name, payerId: s.payerId });
    setOpen(false);
    setItems([]);
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true); }}
        autoComplete="off"
      />
      {open && (loading || items.length > 0) && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Searching payers…</div>}
          {!loading && items.map((s, i) => (
            <button
              key={`${s.payerId}-${i}`}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="truncate text-slate-800">{s.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{s.payerId}{s.source === "local" ? " · dir" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
