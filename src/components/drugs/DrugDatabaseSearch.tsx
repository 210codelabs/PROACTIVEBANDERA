"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { DrugHit } from "@/lib/openfda";

/**
 * Full openFDA NDC database search with filters + pagination (25/50/100 per
 * page) and a merged NLM RxNorm/RxNav panel (the other public database already
 * connected). Reusable across the app (pharmacy, inventory, product editor).
 *
 * If `onSelect` is provided, each result row shows a "Use" button so the parent
 * (e.g. the inventory product editor) can prefill from the selected product.
 */

const FORMS = ["", "TABLET", "CAPSULE", "SOLUTION", "INJECTION", "CREAM", "OINTMENT", "SUSPENSION", "SYRUP", "PATCH", "AEROSOL", "GEL", "LOTION", "POWDER", "SUPPOSITORY"];
const ROUTES = ["", "ORAL", "TOPICAL", "INTRAVENOUS", "INTRAMUSCULAR", "SUBCUTANEOUS", "OPHTHALMIC", "OTIC", "NASAL", "INHALATION", "RECTAL", "TRANSDERMAL"];
const SCHEDULES = ["", "CII", "CIII", "CIV", "CV"];
const TYPES = ["", "HUMAN PRESCRIPTION DRUG", "HUMAN OTC DRUG"];
const PAGE_SIZES = [25, 50, 100];

type RxNorm = {
  matched: { rxcui: string; name: string; tty: string } | null;
  classes: string[];
  education: { title: string; url: string }[];
  source: string;
} | null;

export default function DrugDatabaseSearch({
  onSelect,
  title = "Medication database search",
  initialQuery = "",
}: {
  onSelect?: (d: DrugHit) => void;
  title?: string;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [form, setForm] = useState("");
  const [route, setRoute] = useState("");
  const [schedule, setSchedule] = useState("");
  const [ptype, setPtype] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<DrugHit[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rxnorm, setRxnorm] = useState<RxNorm>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (targetPage: number) => {
    if (q.trim().length < 2 && !form && !route && !schedule && !ptype) {
      setErr("Enter at least 2 characters or pick a filter.");
      return;
    }
    setLoading(true); setErr(null); setSearched(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), page: String(targetPage), pageSize: String(pageSize) });
      if (form) params.set("form", form);
      if (route) params.set("route", route);
      if (schedule) params.set("schedule", schedule);
      if (ptype) params.set("productType", ptype);
      const r = await fetch(`/api/drugs/search?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Search failed."); setResults([]); return; }
      setResults(d.results || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      setPage(d.page || targetPage);
      if (targetPage === 1) setRxnorm(d.rxnorm || null);
    } catch {
      setErr("Could not reach the medication database.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, form, route, schedule, ptype, pageSize]);

  // Re-run when page size or filters change (only if a search was already made).
  useEffect(() => {
    if (searched) runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, form, route, schedule, ptype]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(1); };

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <section className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="chip bg-teal-100 text-teal-800 ring-teal-200 text-[10px]">openFDA</span>
        <span className="chip bg-indigo-100 text-indigo-800 ring-indigo-200 text-[10px]">RxNorm / RxNav</span>
      </header>

      <div className="p-4 space-y-3">
        <form onSubmit={onSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="col-span-2 md:col-span-2">
            <input className="input w-full" placeholder="Search brand or generic name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={form} onChange={(e) => setForm(e.target.value)} title="Dosage form">
            {FORMS.map((f) => <option key={f} value={f}>{f || "Any form"}</option>)}
          </select>
          <select className="input" value={route} onChange={(e) => setRoute(e.target.value)} title="Route">
            {ROUTES.map((r) => <option key={r} value={r}>{r || "Any route"}</option>)}
          </select>
          <select className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} title="DEA schedule">
            {SCHEDULES.map((s) => <option key={s} value={s}>{s || "Any schedule"}</option>)}
          </select>
          <button className="btn-primary" disabled={loading} type="submit">{loading ? "Searching…" : "Search"}</button>
        </form>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <select className="input py-1 w-auto" value={ptype} onChange={(e) => setPtype(e.target.value)} title="Product type">
            {TYPES.map((t) => <option key={t} value={t}>{t || "Any product type"}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <span>Per page</span>
            <select className="input py-1 w-auto" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {searched && !loading && (
            <span className="ml-auto text-slate-500">
              {total.toLocaleString()} match{total === 1 ? "" : "es"}{total > 0 ? ` · showing ${showingFrom}–${showingTo}` : ""}
            </span>
          )}
        </div>

        {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}

        {/* RxNorm merged panel */}
        {rxnorm?.matched && (
          <div className="rounded-lg bg-indigo-50 ring-1 ring-indigo-200 p-3 text-sm">
            <div className="font-medium text-indigo-900">RxNorm: {rxnorm.matched.name} <span className="text-indigo-500 font-mono text-[11px]">RxCUI {rxnorm.matched.rxcui}</span></div>
            {rxnorm.classes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {rxnorm.classes.map((c) => <span key={c} className="chip bg-white text-indigo-700 ring-indigo-200 text-[10px]">{c}</span>)}
              </div>
            )}
            {rxnorm.education.length > 0 && (
              <div className="mt-1 text-[12px] text-indigo-700">
                {rxnorm.education.map((e, i) => (
                  <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" className="underline mr-3">{e.title}</a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {searched && (
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Form / Route</th>
                  <th className="px-3 py-2">NDC</th>
                  <th className="px-3 py-2">Labeler</th>
                  {onSelect && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && !loading && (
                  <tr><td colSpan={onSelect ? 5 : 4} className="text-center text-slate-400 py-8">No matching FDA products.</td></tr>
                )}
                {results.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{d.brandName || d.genericName}{d.strengths[0] ? <span className="text-slate-500 font-normal"> · {d.strengths[0]}</span> : null}</div>
                      <div className="text-xs text-slate-500">{[d.genericName && d.genericName !== d.brandName ? d.genericName : null, d.productType].filter(Boolean).join(" · ")}</div>
                      {d.deaSchedule && <span className="chip bg-amber-100 text-amber-800 ring-amber-200 text-[10px] mt-1">C-{d.deaSchedule.replace(/[^IV]/gi, "") || d.deaSchedule}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{[d.dosageForm, d.route].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{d.productNdc || "—"}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[220px]">{d.labelerName || "—"}</td>
                    {onSelect && (
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onSelect(d)} className="btn-secondary py-1 px-2 text-xs">Use</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {searched && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <button className="btn-secondary py-1 px-2 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)}>‹ Prev</button>
            <span className="text-slate-600">Page {page} of {totalPages.toLocaleString()}</span>
            <button className="btn-secondary py-1 px-2 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => runSearch(page + 1)}>Next ›</button>
          </div>
        )}

        <p className="text-[10px] text-slate-400">
          Sources: openFDA NDC Directory + NLM RxNorm/RxNav (public, informational). Reference data only — not a substitute for clinical judgment.
        </p>
      </div>
    </section>
  );
}
