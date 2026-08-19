"use client";
import { useEffect, useMemo, useState } from "react";

type Data = {
  drug: { brandName: string; genericName: string };
  interactionsText: string;
  flagged: { med: string; matchedTerm: string }[];
};

/**
 * Informational drug-interaction check. Given a candidate drug (ndc/name) and the
 * patient's current medications, it flags any current med mentioned in the drug's
 * openFDA SPL "drug interactions" section. Keyword-based, NOT a clinical engine.
 */
export default function InteractionCheck({
  ndc,
  name,
  meds,
  className = "",
}: {
  ndc?: string | null;
  name?: string | null;
  meds: string[];
  className?: string;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [showText, setShowText] = useState(false);
  const medsKey = useMemo(() => meds.join("|"), [meds]);

  useEffect(() => {
    if ((!ndc && !name) || meds.length === 0) { setData(null); return; }
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/drugs/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ndc, name, meds }),
          signal: ctrl.signal,
        });
        const j = await r.json();
        setData(j);
      } catch { /* stay quiet */ } finally { setLoading(false); }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndc, name, medsKey]);

  if (loading) return <div className={`text-[11px] text-slate-400 ${className}`}>Checking interactions…</div>;
  if (!data) return null;

  const flagged = data.flagged || [];
  const hasText = !!data.interactionsText;
  const drugLabel = data.drug?.brandName || data.drug?.genericName || "this drug";

  if (flagged.length === 0) {
    if (!hasText) return null;
    return (
      <div className={className}>
        <button type="button" onClick={() => setShowText((v) => !v)} className="text-[11px] font-semibold text-slate-500 underline">
          {showText ? "Hide FDA drug-interactions" : "View FDA drug-interactions (no overlap with current meds)"}
        </button>
        {showText && <p className="mt-1 text-[12px] text-slate-600 whitespace-pre-line max-h-40 overflow-auto ring-1 ring-slate-200 rounded p-2 bg-white">{data.interactionsText}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-lg bg-amber-50 ring-1 ring-amber-300 p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-amber-500 text-white ring-amber-500 text-[10px] font-bold">⚠ POTENTIAL INTERACTION</span>
        <span className="text-[11px] text-amber-800">{flagged.length} current medication{flagged.length > 1 ? "s" : ""} may interact</span>
      </div>
      <ul className="mt-1 text-[12px] text-amber-900 space-y-0.5">
        {flagged.map((f, i) => (
          <li key={i}>• <span className="font-semibold">{f.med}</span> — referenced in {drugLabel}&apos;s FDA interactions</li>
        ))}
      </ul>
      {hasText && (
        <button type="button" onClick={() => setShowText((v) => !v)} className="text-[11px] font-semibold text-amber-700 underline mt-1">
          {showText ? "Hide FDA interactions text" : "Show FDA interactions text"}
        </button>
      )}
      {showText && hasText && <p className="mt-1 text-[12px] text-amber-900 whitespace-pre-line max-h-40 overflow-auto ring-1 ring-amber-200 rounded p-2 bg-white/70">{data.interactionsText}</p>}
      <div className="text-[10px] text-amber-600 mt-1">Informational only — a keyword match against openFDA labeling, not a verified interaction checker. Confirm clinically.</div>
    </div>
  );
}
