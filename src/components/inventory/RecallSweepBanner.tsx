"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Flagged = {
  id: string;
  name: string;
  sku: string;
  ndc: string;
  quantityOnHand: number;
  location: string | null;
  recalls: { classification: string; reason: string; initiatedOn: string; firm: string }[];
};

/**
 * Dashboard banner: scans clinic inventory for stocked products whose NDC has an
 * OPEN FDA recall. Renders nothing when the shelf is clean.
 */
export default function RecallSweepBanner() {
  const [data, setData] = useState<{ flaggedCount: number; flagged: Flagged[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/inventory/recall-sweep", { signal: ctrl.signal });
        const j = await r.json();
        setData(j);
      } catch { /* stay quiet */ }
    })();
    return () => ctrl.abort();
  }, []);

  if (!data || !data.flaggedCount) return null;

  return (
    <div className="lg:col-span-3 card card-pad border-l-4 border-l-rose-500 bg-rose-50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-rose-600 text-white ring-rose-600 text-[10px] font-bold">FDA RECALL</span>
        <span className="font-semibold text-rose-900">
          {data.flaggedCount} stocked product{data.flaggedCount > 1 ? "s" : ""} {data.flaggedCount > 1 ? "have" : "has"} an open FDA recall — pull from the shelf.
        </span>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-rose-700 underline ml-auto">{open ? "Hide" : "Review"}</button>
      </div>
      {open && (
        <ul className="mt-2 space-y-2">
          {data.flagged.map((it) => (
            <li key={it.id} className="rounded-md bg-white ring-1 ring-rose-200 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{it.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{it.sku} · NDC {it.ndc} · {it.quantityOnHand} on hand{it.location ? ` · ${it.location}` : ""}</div>
                </div>
                <Link href="/inventory?category=medication" prefetch={false} className="chip bg-rose-100 text-rose-800 ring-rose-200 shrink-0">Manage stock</Link>
              </div>
              {it.recalls?.[0] && (
                <div className="text-[12px] text-rose-800 mt-1">
                  <span className="font-semibold">{it.recalls[0].classification}</span>: {it.recalls[0].reason}
                  {it.recalls[0].firm ? <span className="text-rose-600"> · {it.recalls[0].firm}</span> : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] text-rose-500 mt-1">Source: openFDA Drug Enforcement — verify with the FDA/manufacturer before removing stock.</div>
    </div>
  );
}
