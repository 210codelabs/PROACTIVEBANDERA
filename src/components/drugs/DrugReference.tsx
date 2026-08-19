"use client";
import { useEffect, useState } from "react";
import type { DrugLabel } from "@/lib/openfda";

type Props = { productNdc?: string; name?: string; title?: string; defaultOpen?: boolean };

function Section({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const short = text.length > 380 && !open ? text.slice(0, 380) + "…" : text;
  return (
    <div className="border-t border-slate-100 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-1">{label}</div>
      <p className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-line">{short}</p>
      {text.length > 380 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-brand-600 font-semibold mt-1">{open ? "Show less" : "Show more"}</button>
      )}
    </div>
  );
}

/** Real-time official product labeling (openFDA SPL). Informational only. */
export default function DrugReference({ productNdc, name, title = "FDA product labeling", defaultOpen = false }: Props) {
  const [data, setData] = useState<DrugLabel | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [show, setShow] = useState(defaultOpen);

  useEffect(() => {
    if (!show || loaded) return;
    if (!productNdc && !name) return;
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (productNdc) params.set("productNdc", productNdc);
        if (name) params.set("name", name);
        const r = await fetch(`/api/drugs/label?${params}`, { signal: ctrl.signal });
        const j = await r.json();
        setData(j.result || null);
      } catch { /* ignore */ } finally { setLoading(false); setLoaded(true); }
    })();
    return () => ctrl.abort();
  }, [show, productNdc, name, loaded]);

  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white">
      <button type="button" onClick={() => setShow((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="chip bg-sky-100 text-sky-800 ring-sky-200">openFDA · real-time</span>
          {title}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition ${show ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {show && (
        <div className="px-4 pb-4">
          {loading && <div className="text-sm text-slate-400 py-3">Loading FDA label…</div>}
          {!loading && loaded && !data && <div className="text-sm text-slate-400 py-3">No FDA labeling found for this product.</div>}
          {data && (
            <div>
              <div className="text-xs text-slate-500 mb-1">
                {[data.brandName, data.genericName && data.genericName !== data.brandName ? `(${data.genericName})` : null, data.manufacturer].filter(Boolean).join(" · ")}
              </div>
              {data.boxedWarning && (
                <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-2 my-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Boxed warning</div>
                  <p className="text-[13px] text-rose-800 whitespace-pre-line line-clamp-4">{data.boxedWarning}</p>
                </div>
              )}
              <Section label="Indications & usage" text={data.indications} />
              <Section label="Dosage & administration" text={data.dosage} />
              <Section label="Warnings" text={data.warnings} />
              <Section label="Contraindications" text={data.contraindications} />
              <Section label="Adverse reactions" text={data.adverseReactions} />
              <Section label="Drug interactions" text={data.drugInteractions} />
              <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                Source: openFDA Drug Labeling (SPL){data.effectiveTime ? ` · effective ${data.effectiveTime}` : ""}. Informational only — verify before clinical use; not a substitute for professional judgment.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
