"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Analytics } from "@/lib/analytics";
import { KpiStat, BarChart, LineArea, Donut, HBars, CHART_COLORS, fmtNum, fmtMoney } from "@/components/analytics/charts";

type Mode = "dashboard" | "present";

type Widget = {
  id: string;
  title: string;
  category: string;
  span: 1 | 2 | 4;
  render: (a: Analytics) => React.ReactNode;
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const dictToArr = (d: Record<string, number> = {}) => Object.entries(d).map(([label, value]) => ({ label: cap(label), value }));

// ---- Widget registry (segregated by domain) ----
const WIDGETS: Widget[] = [
  { id: "kpi-patients", title: "Active patients", category: "Overview", span: 1, render: (a) => <KpiStat label="Active patients" value={fmtNum(a.kpis.patientsTotal)} accent={CHART_COLORS[0]} /> },
  { id: "kpi-new-patients", title: "New patients", category: "Overview", span: 1, render: (a) => <KpiStat label="New patients (range)" value={fmtNum(a.kpis.patientsNew)} accent={CHART_COLORS[1]} /> },
  { id: "kpi-appointments", title: "Appointments", category: "Overview", span: 1, render: (a) => <KpiStat label="Appointments (range)" value={fmtNum(a.kpis.appointmentsTotal)} accent={CHART_COLORS[6]} /> },
  { id: "kpi-encounters", title: "Encounters", category: "Overview", span: 1, render: (a) => <KpiStat label="Encounters (range)" value={fmtNum(a.kpis.encountersTotal)} accent={CHART_COLORS[4]} /> },
  { id: "kpi-charges", title: "Billed charges", category: "Overview", span: 1, render: (a) => <KpiStat label="Billed charges" value={fmtMoney(a.kpis.revenueChargesCents)} accent={CHART_COLORS[2]} /> },
  { id: "kpi-paid", title: "Payments", category: "Overview", span: 1, render: (a) => <KpiStat label="Payments posted" value={fmtMoney(a.kpis.revenuePaidCents)} accent={CHART_COLORS[1]} /> },
  { id: "kpi-pos", title: "POS sales", category: "Overview", span: 1, render: (a) => <KpiStat label="POS sales" value={fmtMoney(a.kpis.posSalesCents)} sub={`${fmtNum(a.kpis.posCount)} sales`} accent={CHART_COLORS[3]} /> },
  { id: "kpi-noshow", title: "No-show rate", category: "Overview", span: 1, render: (a) => <KpiStat label="No-show rate" value={`${a.kpis.noShowRate}%`} accent={CHART_COLORS[5]} /> },
  { id: "kpi-inv-value", title: "Inventory value", category: "Overview", span: 1, render: (a) => <KpiStat label="Inventory on-hand value" value={fmtMoney(a.kpis.inventoryValueCents)} sub={`${fmtNum(a.kpis.lowStockCount)} low-stock`} accent={CHART_COLORS[7]} /> },
  { id: "kpi-elig", title: "Eligibility active", category: "Overview", span: 1, render: (a) => <KpiStat label="Eligibility active rate" value={`${a.kpis.eligibilityActiveRate}%`} accent={CHART_COLORS[0]} /> },

  { id: "patients-trend", title: "New patients over time", category: "Patients", span: 2, render: (a) => <LineArea series={a.patients.newByMonth} color={CHART_COLORS[1]} /> },
  { id: "patients-sex", title: "Patients by sex (all)", category: "Patients", span: 1, render: (a) => <Donut data={dictToArr(a.patients.bySex).map((d) => ({ ...d, label: d.label }))} /> },
  { id: "patients-status", title: "Patients by status (all)", category: "Patients", span: 1, render: (a) => <Donut data={dictToArr(a.patients.byStatus)} /> },

  { id: "appts-trend", title: "Appointments over time", category: "Scheduling", span: 2, render: (a) => <LineArea series={a.appointments.byMonth} color={CHART_COLORS[6]} /> },
  { id: "appts-status", title: "Appointments by status", category: "Scheduling", span: 1, render: (a) => <Donut data={dictToArr(a.appointments.byStatus)} /> },
  { id: "appts-location", title: "Appointments by location", category: "Scheduling", span: 1, render: (a) => <BarChart data={dictToArr(a.appointments.byLocation)} color={CHART_COLORS[0]} /> },
  { id: "top-providers", title: "Top providers (visits)", category: "Scheduling", span: 2, render: (a) => <HBars data={a.scheduling.topProviders} /> },
  { id: "by-service", title: "Top service types", category: "Scheduling", span: 2, render: (a) => <HBars data={a.scheduling.byService} /> },

  { id: "claims-status", title: "Claims by status", category: "Revenue", span: 1, render: (a) => <Donut data={dictToArr(a.revenue.claims.byStatus)} /> },
  { id: "pos-trend", title: "POS revenue over time", category: "Revenue", span: 2, render: (a) => <LineArea series={a.revenue.pos.byMonth.map((m) => ({ month: m.month, count: Math.round(m.count / 100) }))} color={CHART_COLORS[3]} /> },
  { id: "elig-status", title: "Eligibility results", category: "Revenue", span: 1, render: (a) => <Donut data={dictToArr(a.revenue.eligibility.byStatus)} /> },

  { id: "rx", title: "Prescriptions", category: "Pharmacy & Inventory", span: 1, render: (a) => <BarChart data={dictToArr(a.pharmacy.rxByStatus)} color={CHART_COLORS[1]} /> },
  { id: "orders-type", title: "Orders by type", category: "Pharmacy & Inventory", span: 1, render: (a) => <BarChart data={dictToArr(a.pharmacy.ordersByType)} color={CHART_COLORS[4]} /> },
  { id: "inv-category", title: "Inventory value by category", category: "Pharmacy & Inventory", span: 2, render: (a) => <HBars data={a.inventory.byCategory.map((c) => ({ name: cap(c.category), value: c.valueCents }))} money /> },

  { id: "specialties", title: "Patients by specialty", category: "Specialties", span: 2, render: (a) => <HBars data={a.specialties.map((s) => ({ name: s.name, value: s.patientCount }))} /> },
  { id: "providers-role", title: "Staff by role", category: "Specialties", span: 1, render: (a) => <Donut data={dictToArr(a.providers.byRole)} /> },
];

const DEFAULT_ORDER = WIDGETS.map((w) => w.id);
const LS_KEY = "pc-analytics-layout-v2";
const SAVED_KEY = "pc-analytics-saved-v1";

// ---- Custom widgets (user-added text / heading / image) ----
type CustomKind = "text" | "heading" | "image";
type CustomWidget = { id: string; kind: CustomKind; span: 1 | 2 | 4; title?: string; text?: string; src?: string };

type Layout = { order: string[]; hidden: string[]; custom: CustomWidget[]; spans: Record<string, number> };

function baseLayout(): Layout {
  return { order: [...DEFAULT_ORDER], hidden: [], custom: [], spans: {} };
}

function normalizeLayout(p: any): Layout {
  const known = new Set(DEFAULT_ORDER);
  const custom: CustomWidget[] = Array.isArray(p?.custom)
    ? p.custom.filter((c: any) => c && typeof c.id === "string" && (c.kind === "text" || c.kind === "heading" || c.kind === "image"))
        .map((c: any) => ({ id: c.id, kind: c.kind, span: (c.span === 1 || c.span === 2 || c.span === 4 ? c.span : 2), title: c.title || "", text: c.text || "", src: c.src || "" }))
    : [];
  const customIds = new Set(custom.map((c) => c.id));
  const all = new Set<string>([...known, ...customIds]);
  const order: string[] = (Array.isArray(p?.order) ? p.order : []).filter((id: string) => all.has(id));
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  for (const id of customIds) if (!order.includes(id)) order.push(id);
  const hidden: string[] = (Array.isArray(p?.hidden) ? p.hidden : []).filter((id: string) => known.has(id));
  const spans: Record<string, number> = p?.spans && typeof p.spans === "object" ? p.spans : {};
  return { order, hidden, custom, spans };
}

function loadLayout(): Layout {
  if (typeof window === "undefined") return baseLayout();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return baseLayout();
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return baseLayout();
  }
}

function loadSaved(): Record<string, Layout> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "{}") || {}; } catch { return {}; }
}
function persistSaved(d: Record<string, Layout>) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(d)); } catch { /* ignore */ } }

// ---- Preconfigured templates ----
const KPI_IDS = WIDGETS.filter((w) => w.id.startsWith("kpi-")).map((w) => w.id);
function orderHidden(keep: string[]): { order: string[]; hidden: string[] } {
  const rest = DEFAULT_ORDER.filter((id) => !keep.includes(id));
  return { order: [...keep, ...rest], hidden: rest };
}
const TEMPLATES: { key: string; label: string; desc: string; build: () => { order: string[]; hidden: string[] } }[] = [
  { key: "full", label: "Full dashboard", desc: "Every widget, default order", build: () => ({ order: [...DEFAULT_ORDER], hidden: [] }) },
  { key: "exec", label: "Executive overview", desc: "KPIs + headline trends", build: () => orderHidden([...KPI_IDS, "patients-trend", "appts-trend", "claims-status", "specialties"]) },
  { key: "revenue", label: "Revenue & RCM", desc: "Billing, claims, POS, eligibility", build: () => orderHidden(["kpi-charges", "kpi-paid", "kpi-pos", "kpi-elig", "claims-status", "pos-trend", "elig-status", "by-service"]) },
  { key: "ops", label: "Operations", desc: "Scheduling, pharmacy & inventory", build: () => orderHidden(["kpi-appointments", "kpi-noshow", "kpi-inv-value", "appts-trend", "appts-status", "appts-location", "top-providers", "rx", "orders-type", "inv-category"]) },
  { key: "clinical", label: "Clinical & patients", desc: "Patients, encounters & specialties", build: () => orderHidden(["kpi-patients", "kpi-new-patients", "kpi-encounters", "patients-trend", "patients-sex", "patients-status", "specialties", "providers-role"]) },
];

function spanClass(span: number) {
  if (span === 4) return "col-span-2 lg:col-span-4";
  if (span === 2) return "col-span-2 lg:col-span-2";
  return "col-span-1";
}

const PRESETS: { key: string; label: string; from: () => Date }[] = [
  { key: "30d", label: "30 days", from: () => new Date(Date.now() - 30 * 86400000) },
  { key: "90d", label: "90 days", from: () => new Date(Date.now() - 90 * 86400000) },
  { key: "12m", label: "12 months", from: () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 11); d.setUTCDate(1); return d; } },
  { key: "ytd", label: "YTD", from: () => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const closeMenu = (el: HTMLElement | null) => el?.closest("details")?.removeAttribute("open");

// ---- Custom widget views ----
function CustomView({ c }: { c: CustomWidget }) {
  if (c.kind === "image") {
    if (!c.src) return <div className="text-slate-300 text-sm py-10 text-center">No image set</div>;
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <figure className="m-0">
        <img src={c.src} alt={c.title || "image"} className="w-full rounded-md object-contain max-h-80" />
        {c.title && <figcaption className="mt-1 text-center text-[11px] text-slate-400">{c.title}</figcaption>}
      </figure>
    );
  }
  if (c.kind === "heading") {
    return (
      <div className="py-2">
        <h3 className="text-lg font-bold text-slate-900">{c.title || "Section"}</h3>
        {c.text && <p className="text-sm text-slate-500 mt-0.5">{c.text}</p>}
      </div>
    );
  }
  return <p className="text-sm text-slate-700 whitespace-pre-wrap py-1 leading-relaxed">{c.text || ""}</p>;
}

function CustomEdit({ c, onPatch, onFile }: { c: CustomWidget; onPatch: (p: Partial<CustomWidget>) => void; onFile: (f: File) => void }) {
  if (c.kind === "image") {
    return (
      <div className="space-y-2">
        <input className="input" placeholder="Image URL (https://…)" value={c.src && c.src.startsWith("data:") ? "" : c.src || ""} onChange={(e) => onPatch({ src: e.target.value })} />
        <div className="flex items-center gap-2">
          <label className="chip bg-slate-100 ring-1 ring-slate-200 text-xs cursor-pointer hover:bg-slate-200">
            Upload image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
          {c.src ? <img src={c.src} alt="preview" className="h-10 rounded ring-1 ring-slate-200" /> : <span className="text-[11px] text-slate-400">max 2MB</span>}
        </div>
        <input className="input" placeholder="Caption (optional)" value={c.title || ""} onChange={(e) => onPatch({ title: e.target.value })} />
      </div>
    );
  }
  if (c.kind === "heading") {
    return (
      <div className="space-y-2">
        <input className="input font-semibold" placeholder="Section title" value={c.title || ""} onChange={(e) => onPatch({ title: e.target.value })} />
        <input className="input" placeholder="Subtitle (optional)" value={c.text || ""} onChange={(e) => onPatch({ text: e.target.value })} />
      </div>
    );
  }
  return <textarea className="input min-h-[96px]" placeholder="Notes / narrative…" value={c.text || ""} onChange={(e) => onPatch({ text: e.target.value })} />;
}

export default function AnalyticsBoard({
  mode = "dashboard",
  initialFrom,
  initialTo,
  autoPrint = false,
}: {
  mode?: Mode;
  initialFrom?: string;
  initialTo?: string;
  autoPrint?: boolean;
}) {
  const [from, setFrom] = useState(initialFrom || iso(PRESETS[2].from()));
  const [to, setTo] = useState(initialTo || iso(new Date()));
  const [preset, setPreset] = useState(initialFrom ? "custom" : "12m");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [layout, setLayout] = useState<Layout>(baseLayout());
  const [saved, setSaved] = useState<Record<string, Layout>>({});
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { setLayout(loadLayout()); setSaved(loadSaved()); }, []);

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); }, []);

  const persist = useCallback((next: Layout) => {
    setLayout(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/analytics?from=${from}&to=${to}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Failed to load analytics."); return; }
      setData(d.analytics);
    } catch {
      setErr("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoPrint && data && !loading) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [autoPrint, data, loading]);

  function applyPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setFrom(iso(p.from()));
    setTo(iso(new Date()));
  }

  const baseMap = useMemo(() => Object.fromEntries(WIDGETS.map((w) => [w.id, w])), []);
  const customMap = useMemo(() => Object.fromEntries(layout.custom.map((c) => [c.id, c])), [layout.custom]);
  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const effSpan = (id: string): number => layout.spans[id] ?? baseMap[id]?.span ?? customMap[id]?.span ?? 1;
  const titleOf = (id: string) => baseMap[id]?.title || (customMap[id] ? (customMap[id].kind === "image" ? "Image" : customMap[id].kind === "heading" ? "Heading" : "Text note") : id);

  // ---- drag: SWAP positions ----
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const order = [...layout.order];
    const i = order.indexOf(dragId);
    const j = order.indexOf(targetId);
    if (i < 0 || j < 0) { setDragId(null); setDragOverId(null); return; }
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp; // swap
    persist({ ...layout, order });
    setDragId(null); setDragOverId(null);
  }

  function toggleHidden(id: string) {
    const hidden = layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
    persist({ ...layout, hidden });
  }

  function cycleSpan(id: string) {
    const cur = effSpan(id);
    const nextSpan = cur === 1 ? 2 : cur === 2 ? 4 : 1;
    persist({ ...layout, spans: { ...layout.spans, [id]: nextSpan } });
  }

  function resetLayout() { persist(baseLayout()); flash("Layout reset to default."); }

  // ---- custom widgets ----
  function addCustom(kind: CustomKind) {
    const id = `custom-${kind}-${Date.now().toString(36)}`;
    const w: CustomWidget = { id, kind, span: kind === "heading" ? 4 : 2, title: kind === "heading" ? "New section" : "", text: kind === "text" ? "" : "", src: "" };
    persist({ ...layout, custom: [...layout.custom, w], order: [...layout.order, id] });
    setEditing(true);
    flash(`${cap(kind)} added — scroll down to edit it.`);
  }
  function updateCustom(id: string, patch: Partial<CustomWidget>) {
    persist({ ...layout, custom: layout.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  function deleteCustom(id: string) {
    persist({ ...layout, custom: layout.custom.filter((c) => c.id !== id), order: layout.order.filter((x) => x !== id) });
  }
  function onImageFile(id: string, file: File) {
    if (file.size > 2_000_000) { flash("Image too large (max 2MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => updateCustom(id, { src: String(reader.result) });
    reader.readAsDataURL(file);
  }

  // ---- templates & saved layouts ----
  function applyTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    const { order, hidden } = t.build();
    const custOrder = layout.custom.map((c) => c.id);
    persist({ ...layout, order: [...order.filter((id) => !custOrder.includes(id)), ...custOrder], hidden });
    flash(`Applied “${t.label}” template.`);
  }
  function saveAs() {
    const name = window.prompt("Name this layout (e.g. Board Meeting):");
    if (!name || !name.trim()) return;
    const d = { ...loadSaved(), [name.trim()]: layout };
    persistSaved(d); setSaved(d); flash(`Saved layout “${name.trim()}”.`);
  }
  function loadNamed(name: string) {
    const d = loadSaved();
    if (d[name]) { persist(normalizeLayout(d[name])); flash(`Loaded “${name}”.`); }
  }
  function deleteNamed(name: string) {
    const d = loadSaved(); delete d[name]; persistSaved(d); setSaved({ ...d });
  }
  function copyLayoutJson() {
    const json = JSON.stringify(layout);
    navigator.clipboard?.writeText(json).then(() => flash("Layout JSON copied to clipboard."), () => window.prompt("Copy layout JSON:", json));
  }
  function importLayoutJson() {
    const raw = window.prompt("Paste a layout JSON to import:");
    if (!raw) return;
    try { persist(normalizeLayout(JSON.parse(raw))); flash("Layout imported."); } catch { flash("Invalid layout JSON."); }
  }

  // ---- share / export ----
  const shareUrl = () => (typeof window === "undefined" ? "" : `${window.location.origin}/analytics?from=${from}&to=${to}`);
  async function onShare() {
    const url = shareUrl();
    try { if (navigator.share) { await navigator.share({ title: "Practice Analytics", url }); return; } } catch { /* fall through */ }
    try { await navigator.clipboard.writeText(url); flash("Analytics link copied (staff login required)."); }
    catch { window.prompt("Copy this analytics link:", url); }
  }
  function onPresent() { window.open(`/analytics/present?from=${from}&to=${to}`, "_blank", "noopener"); }
  function onExportPdf() {
    if (mode === "present") { window.print(); return; }
    window.open(`/analytics/present?from=${from}&to=${to}&print=1`, "_blank", "noopener");
  }

  const savedNames = Object.keys(saved);

  return (
    <div className="space-y-4">
      {/* Toolbar / filters */}
      <div className="no-print flex flex-wrap items-center gap-2 rounded-lg bg-white ring-1 ring-slate-200 p-3">
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)} className={`chip ring-1 ring-inset text-xs ${preset === p.key ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200"}`}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <input type="date" className="input py-1 w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
          <span>to</span>
          <input type="date" className="input py-1 w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
        </div>

        {mode === "dashboard" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Templates */}
            <details className="relative">
              <summary className="btn-secondary py-1.5 text-sm list-none cursor-pointer select-none">Templates ▾</summary>
              <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg bg-white ring-1 ring-slate-200 shadow-xl p-1">
                {TEMPLATES.map((t) => (
                  <button key={t.key} onClick={(e) => { applyTemplate(t.key); closeMenu(e.currentTarget); }} className="w-full text-left rounded-md px-3 py-2 hover:bg-brand-50">
                    <div className="text-sm font-medium text-slate-800">{t.label}</div>
                    <div className="text-[11px] text-slate-500">{t.desc}</div>
                  </button>
                ))}
              </div>
            </details>

            {/* Saved layouts */}
            <details className="relative">
              <summary className="btn-secondary py-1.5 text-sm list-none cursor-pointer select-none">Layouts ▾</summary>
              <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg bg-white ring-1 ring-slate-200 shadow-xl p-1">
                <button onClick={(e) => { saveAs(); closeMenu(e.currentTarget); }} className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">＋ Save current as…</button>
                <div className="my-1 border-t border-slate-100" />
                {savedNames.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No saved layouts yet.</div>}
                {savedNames.map((name) => (
                  <div key={name} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-50">
                    <button onClick={(e) => { loadNamed(name); closeMenu(e.currentTarget); }} className="flex-1 text-left text-sm text-slate-700 truncate">{name}</button>
                    <button onClick={() => deleteNamed(name)} className="text-rose-400 hover:text-rose-600 text-xs shrink-0" title="Delete">🗑</button>
                  </div>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <button onClick={(e) => { copyLayoutJson(); closeMenu(e.currentTarget); }} className="w-full text-left rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Copy layout JSON</button>
                <button onClick={(e) => { importLayoutJson(); closeMenu(e.currentTarget); }} className="w-full text-left rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Import layout JSON…</button>
              </div>
            </details>

            <button onClick={() => setEditing((v) => !v)} className={`btn-secondary py-1.5 text-sm ${editing ? "ring-2 ring-brand-300" : ""}`}>{editing ? "Done editing" : "Customize"}</button>
            <button onClick={onExportPdf} className="btn-secondary py-1.5 text-sm">Export PDF</button>
            <button onClick={onShare} className="btn-secondary py-1.5 text-sm">Share</button>
            <button onClick={onPresent} className="btn-primary py-1.5 text-sm">Presentation</button>
          </div>
        )}
        {mode === "present" && (
          <button onClick={onExportPdf} className="no-print ml-auto btn-primary py-1.5 text-sm">Export PDF</button>
        )}
      </div>

      {/* Edit toolbar: add widgets */}
      {mode === "dashboard" && editing && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 ring-1 ring-brand-200 p-3">
          <span className="text-xs font-semibold text-brand-800">Add to dashboard:</span>
          <button onClick={() => addCustom("heading")} className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-100">🔠 Heading</button>
          <button onClick={() => addCustom("text")} className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-100">📝 Text note</button>
          <button onClick={() => addCustom("image")} className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-100">🖼 Image</button>
          <span className="mx-1 h-4 w-px bg-brand-200" />
          <span className="text-[11px] text-brand-700">Drag any card onto another to <b>swap</b> · use <b>S/M/L</b> to resize · <b>✕</b> hides charts · <b>🗑</b> deletes custom items</span>
          <button onClick={resetLayout} className="ml-auto chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-100">Reset layout</button>
        </div>
      )}

      {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
      {loading && !data && <div className="text-slate-400 text-sm py-10 text-center">Loading analytics…</div>}

      {/* Hidden widgets tray (edit mode) */}
      {editing && layout.hidden.length > 0 && (
        <div className="no-print rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Hidden widgets — click to restore</div>
          <div className="flex flex-wrap gap-2">
            {layout.hidden.map((id) => (
              <button key={id} onClick={() => toggleHidden(id)} className="chip bg-white ring-1 ring-slate-200 text-slate-600 text-xs hover:bg-slate-100">+ {titleOf(id)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {visible.map((id) => {
            const isCustom = !!customMap[id];
            const w = baseMap[id];
            const c = customMap[id];
            if (!w && !c) return null;
            const span = effSpan(id);
            const isOver = editing && dragOverId === id && dragId && dragId !== id;
            return (
              <div
                key={id}
                className={`${spanClass(span)} rounded-lg bg-white ring-1 transition ${dragId === id ? "opacity-40" : ""} ${isOver ? "ring-2 ring-brand-400 scale-[1.01]" : "ring-slate-200"}`}
                onDragEnter={() => { if (editing && dragId && id !== dragId) setDragOverId(id); }}
                onDragOver={(e) => { if (editing) { e.preventDefault(); if (dragOverId !== id && dragId && dragId !== id) setDragOverId(id); } }}
                onDrop={() => onDrop(id)}
              >
                <div
                  className={`px-3 pt-2.5 pb-1 flex items-center gap-2 ${editing ? "cursor-move" : ""}`}
                  draggable={editing}
                  onDragStart={() => setDragId(id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                >
                  {editing && <span className="text-slate-300 select-none" title="Drag to swap">⠿</span>}
                  <span className="text-xs font-semibold text-slate-700 truncate">{isCustom ? (c.kind === "heading" ? "Heading" : c.kind === "image" ? "Image" : "Text note") : w.title}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-300">{isCustom ? "Custom" : w.category}</span>
                  {editing && <button onClick={() => cycleSpan(id)} className="rounded px-1 text-[10px] font-mono font-semibold text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Resize (Small / Medium / Large)">{span === 1 ? "S" : span === 2 ? "M" : "L"}</button>}
                  {editing && (isCustom
                    ? <button onClick={() => deleteCustom(id)} className="text-rose-400 hover:text-rose-600 text-xs" title="Delete">🗑</button>
                    : <button onClick={() => toggleHidden(id)} className="text-rose-400 hover:text-rose-600 text-xs" title="Hide">✕</button>)}
                </div>
                <div className="px-3 pb-3">
                  {isCustom
                    ? (editing ? <CustomEdit c={c} onPatch={(p) => updateCustom(id, p)} onFile={(f) => onImageFile(id, f)} /> : <CustomView c={c} />)
                    : w.render(data)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>
      )}

      {mode === "dashboard" && (
        <p className="no-print text-[10px] text-slate-400">
          Layout, custom items &amp; filters are saved to this browser. Use “Customize” to add text/headings/images, drag cards to swap, resize (S/M/L), hide or restore. Templates &amp; saved Layouts let you switch presets fast; Presentation/Export reflect the current layout &amp; date range.
        </p>
      )}
    </div>
  );
}
