"use client";
import { useState } from "react";
import DrugSearch from "@/components/drugs/DrugSearch";
import DrugReference from "@/components/drugs/DrugReference";
import RecallAlert from "@/components/drugs/RecallAlert";
import type { DrugHit } from "@/lib/openfda";

type Enrich = { matched: { rxcui: string; name: string; tty: string } | null; classes: string[]; education: { title: string; url: string }[] };
type Item = { drug: DrugHit; enrich?: Enrich | "loading" | "error" };

// Intake-time medication reference tool. Lets front-desk staff look up a patient's
// REPORTED medications against public sources (openFDA + RxNorm + MedlinePlus) to
// standardize names before the chart exists. Reference only — nothing is persisted.
export default function MedNormalizeTool() {
  const [items, setItems] = useState<Item[]>([]);

  async function add(d: DrugHit) {
    const idx = items.length;
    setItems((p) => [...p, { drug: d, enrich: "loading" }]);
    try {
      const q = `${d.genericName || d.brandName || d.display}${d.strengths[0] ? ` ${d.strengths[0]}` : ""}`.trim();
      const r = await fetch(`/api/enrichment/rxnorm?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setItems((p) => p.map((it, i) => (i === idx ? { ...it, enrich: { matched: j.matched, classes: j.classes || [], education: j.education || [] } } : it)));
    } catch {
      setItems((p) => p.map((it, i) => (i === idx ? { ...it, enrich: "error" } : it)));
    }
  }
  function remove(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="section-title">Medication reference</h3>
        <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 text-[10px]">openFDA · RxNorm · MedlinePlus</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">Search the official FDA / RxNorm databases to standardize the patient&apos;s reported medications at intake. Reference only — record the actual medication list on the chart after registration.</p>
      <DrugSearch onSelect={add} placeholder="Search a reported medication…" />
      <div className="mt-3 space-y-2">
        {items.map((it, i) => {
          const d = it.drug;
          const e = it.enrich;
          return (
            <div key={i} className="rounded-lg ring-1 ring-slate-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{d.brandName || d.genericName}{d.strengths[0] ? ` ${d.strengths[0]}` : ""}</div>
                  <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                    {d.productNdc && <span>NDC {d.productNdc}</span>}
                    {d.dosageForm && <span>{d.dosageForm}</span>}
                    {d.route && <span>{d.route}</span>}
                    {d.deaSchedule && <span className="text-amber-600 font-semibold">C-{d.deaSchedule}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-xs text-slate-400 hover:text-rose-600 shrink-0">Remove</button>
              </div>
              {e === "loading" && <div className="text-[11px] text-slate-400 mt-1">Normalizing…</div>}
              {e && e !== "loading" && e !== "error" && (
                <div className="mt-1 space-y-1">
                  {e.matched && (
                    <div className="text-[12px] text-slate-700"><span className="chip bg-slate-100 text-slate-700 ring-slate-200 text-[10px] mr-1">RxNorm</span>{e.matched.name} <span className="text-slate-400">· RxCUI {e.matched.rxcui}</span></div>
                  )}
                  {e.classes.length > 0 && <div className="flex flex-wrap gap-1">{e.classes.map((c) => <span key={c} className="chip bg-brand-50 text-brand-800 ring-brand-200 text-[10px]">{c}</span>)}</div>}
                  {e.education.length > 0 && (
                    <div className="text-[11px]"><span className="text-slate-500">Education: </span>{e.education.map((x, j) => <a key={j} href={x.url} target="_blank" rel="noreferrer" className="text-brand-700 underline mr-2">{x.title}</a>)}</div>
                  )}
                </div>
              )}
              {d.productNdc && <RecallAlert ndc={d.productNdc} className="mt-1" />}
              <DrugReference productNdc={d.productNdc} name={d.genericName || d.brandName} title="Official FDA labeling (reference)" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
