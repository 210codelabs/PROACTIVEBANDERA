"use client";
import { useMemo, useState } from "react";
import type { DrugHit } from "@/lib/openfda";
import DrugSearch from "@/components/drugs/DrugSearch";
import DrugReference from "@/components/drugs/DrugReference";
import RecallAlert from "@/components/drugs/RecallAlert";

type InvLite = { id: string; name: string; sku: string; ndc?: string | null; quantityOnHand: number; reorderLevel: number; unit?: string | null };

/**
 * Inventory "FDA drug reference vs stock" panel. Search the openFDA NDC
 * Directory, view the official product record + real-time SPL labeling, and
 * see side-by-side whether the item is stocked in this clinic's inventory.
 */
export default function InventoryDrugLookup({ inventory }: { inventory: InvLite[] }) {
  const [drug, setDrug] = useState<DrugHit | null>(null);

  const matches = useMemo(() => {
    if (!drug) return [];
    const ndc = drug.productNdc?.toLowerCase();
    const names = [drug.brandName, drug.genericName, ...drug.activeIngredients.map((a) => a.name)]
      .filter(Boolean).map((s) => s.toLowerCase());
    return inventory.filter((it) => {
      if (ndc && it.ndc && it.ndc.toLowerCase().startsWith(ndc)) return true;
      const n = it.name.toLowerCase();
      return names.some((nm) => nm && (n.includes(nm) || nm.includes(n)));
    });
  }, [drug, inventory]);

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <span className="font-semibold text-slate-900">FDA Drug Reference &amp; NDC lookup</span>
        <span className="chip bg-sky-100 text-sky-800 ring-sky-200">openFDA · real-time</span>
      </header>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-500">Search the official FDA database to view product labeling and NDC details, and compare against your on-hand stock.</p>
        <DrugSearch onSelect={setDrug} placeholder="Search a drug or product to label (openFDA)…" />

        {drug && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Open FDA recall alert (spans both columns) */}
            {drug.productNdc && (
              <div className="lg:col-span-2">
                <RecallAlert ndc={drug.productNdc} />
              </div>
            )}
            {/* FDA product record */}
            <div className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-1">National database (openFDA)</div>
              <div className="font-semibold text-slate-900">{drug.brandName || drug.genericName}</div>
              <div className="text-sm text-slate-600">{[drug.genericName && drug.genericName !== drug.brandName ? drug.genericName : null, drug.strengths[0], drug.dosageForm, drug.route].filter(Boolean).join(" · ")}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-slate-400">Product NDC</dt><dd className="font-mono text-slate-700">{drug.productNdc || "—"}</dd>
                <dt className="text-slate-400">Labeler</dt><dd className="text-slate-700 truncate">{drug.labelerName || "—"}</dd>
                <dt className="text-slate-400">Type</dt><dd className="text-slate-700">{drug.productType || "—"}</dd>
                {drug.deaSchedule ? (<><dt className="text-slate-400">DEA schedule</dt><dd className="text-amber-700 font-semibold">{drug.deaSchedule}</dd></>) : null}
              </dl>
              {drug.pharmClass.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {drug.pharmClass.slice(0, 4).map((c, i) => <span key={i} className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[11px]">{c}</span>)}
                </div>
              )}
              {drug.packaging.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Packaging</div>
                  <ul className="text-[12px] text-slate-600 space-y-0.5 mt-0.5">
                    {drug.packaging.slice(0, 4).map((p, i) => <li key={i}><span className="font-mono">{p.ndc}</span> — {p.description}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Local inventory stock */}
            <div className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Your inventory (stock on hand)</div>
              {matches.length === 0 ? (
                <div className="text-sm text-slate-500 py-2">Not currently stocked in this clinic. <span className="text-slate-400">(No inventory item matches this product.)</span></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {matches.map((it) => {
                    const out = it.quantityOnHand <= 0;
                    const low = !out && it.quantityOnHand <= it.reorderLevel;
                    return (
                      <li key={it.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">{it.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{it.sku}{it.ndc ? ` · NDC ${it.ndc}` : ""}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-slate-900">{it.quantityOnHand} <span className="text-xs text-slate-500">{it.unit || "each"}</span></div>
                          <span className={`chip ${out ? "bg-rose-100 text-rose-800 ring-rose-200" : low ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-emerald-100 text-emerald-800 ring-emerald-200"}`}>{out ? "Out of stock" : low ? "Reorder" : "In stock"}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Real-time SPL labeling spans both columns */}
            <div className="lg:col-span-2">
              <DrugReference productNdc={drug.productNdc || undefined} name={drug.genericName || drug.brandName} title="Official product labeling (real-time)" defaultOpen />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
