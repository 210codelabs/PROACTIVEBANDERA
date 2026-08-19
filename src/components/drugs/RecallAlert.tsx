"use client";
import { useEffect, useState } from "react";
import type { DrugRecall } from "@/lib/openfda";

/**
 * Flags open FDA drug recalls for a product NDC (openFDA Drug Enforcement).
 * Renders nothing while loading or when there are no open recalls (unless
 * `showClear` is set). Informational — verify with the FDA/manufacturer.
 *
 * - compact: renders a small inline chip instead of the full banner.
 */
export default function RecallAlert({
  ndc,
  compact = false,
  showClear = false,
  className = "",
}: {
  ndc?: string | null;
  compact?: boolean;
  showClear?: boolean;
  className?: string;
}) {
  const [recalls, setRecalls] = useState<DrugRecall[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ndc) { setRecalls(null); return; }
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/drugs/recall?ndc=${encodeURIComponent(ndc)}`, { signal: ctrl.signal });
        const j = await r.json();
        setRecalls(Array.isArray(j.recalls) ? j.recalls : []);
      } catch { /* stay quiet on error */ }
    })();
    return () => ctrl.abort();
  }, [ndc]);

  if (!ndc || recalls === null) return null;

  const openRecalls = recalls.filter((x) => x.open);
  const others = recalls.filter((x) => !x.open);

  if (openRecalls.length === 0) {
    if (!showClear) return null;
    return (
      <span className={`chip bg-emerald-50 text-emerald-700 ring-emerald-200 text-[11px] ${className}`}>
        No open FDA recalls
      </span>
    );
  }

  const top = openRecalls[0];

  if (compact) {
    return (
      <span
        className={`chip bg-rose-100 text-rose-800 ring-rose-300 text-[11px] font-semibold ${className}`}
        title={`${top.classification ? top.classification + " · " : ""}${top.reason}`}
      >
        ⚠ FDA recall{openRecalls.length > 1 ? ` ×${openRecalls.length}` : ""}{top.classification ? ` · ${top.classification}` : ""}
      </span>
    );
  }

  return (
    <div className={`rounded-lg bg-rose-50 ring-1 ring-rose-300 p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-rose-600 text-white ring-rose-600 text-[10px] font-bold">FDA RECALL · OPEN</span>
        {top.classification && <span className="chip bg-rose-100 text-rose-800 ring-rose-200 text-[10px]">{top.classification}</span>}
        <span className="text-[11px] text-rose-700">{openRecalls.length} open recall{openRecalls.length > 1 ? "s" : ""} for NDC {ndc}</span>
      </div>
      <p className="text-[13px] text-rose-900 mt-1 whitespace-pre-line line-clamp-3">{top.reason}</p>
      <div className="text-[11px] text-rose-700 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {top.firm && <span>Firm: {top.firm}</span>}
        {top.initiatedOn && <span>Initiated {top.initiatedOn}</span>}
        {top.distribution && <span className="truncate max-w-[260px]">{top.distribution}</span>}
      </div>
      {(top.codeInfo || openRecalls.length > 1 || others.length > 0) && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[11px] font-semibold text-rose-700 mt-1 underline">
          {expanded ? "Hide details" : "Show affected lots & details"}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-2">
          {openRecalls.map((r, i) => (
            <div key={i} className="rounded-md bg-white/70 ring-1 ring-rose-200 p-2 text-[12px] text-rose-900">
              <div className="font-semibold">{r.status}{r.classification ? ` · ${r.classification}` : ""}</div>
              <div className="whitespace-pre-line">{r.reason}</div>
              {r.codeInfo && <div className="text-[11px] text-rose-700 mt-0.5">Affected lots: {r.codeInfo}</div>}
            </div>
          ))}
          {others.length > 0 && (
            <div className="text-[11px] text-rose-600">+ {others.length} closed/terminated recall{others.length > 1 ? "s" : ""} on record.</div>
          )}
        </div>
      )}
      <div className="text-[10px] text-rose-500 mt-1">Source: openFDA Drug Enforcement — informational; verify with the manufacturer/FDA before dispensing.</div>
    </div>
  );
}
