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
const LS_KEY = "pc-analytics-layout-v1";

function spanClass(span: number) {
  if (span === 4) return "col-span-2 lg:col-span-4";
  if (span === 2) return "col-span-2 lg:col-span-2";
  return "col-span-1";
}

type Layout = { order: string[]; hidden: string[] };

function loadLayout(): Layout {
  if (typeof window === "undefined") return { order: DEFAULT_ORDER, hidden: [] };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { order: DEFAULT_ORDER, hidden: [] };
    const p = JSON.parse(raw);
    const known = new Set(DEFAULT_ORDER);
    const order = (p.order || []).filter((id: string) => known.has(id));
    for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
    return { order, hidden: (p.hidden || []).filter((id: string) => known.has(id)) };
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] };
  }
}

const PRESETS: { key: string; label: string; from: () => Date }[] = [
  { key: "30d", label: "30 days", from: () => new Date(Date.now() - 30 * 86400000) },
  { key: "90d", label: "90 days", from: () => new Date(Date.now() - 90 * 86400000) },
  { key: "12m", label: "12 months", from: () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 11); d.setUTCDate(1); return d; } },
  { key: "ytd", label: "YTD", from: () => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

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

  const [layout, setLayout] = useState<Layout>({ order: DEFAULT_ORDER, hidden: [] });
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { setLayout(loadLayout()); }, []);

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

  const widgetMap = useMemo(() => Object.fromEntries(WIDGETS.map((w) => [w.id, w])), []);
  const visible = layout.order.filter((id) => !layout.hidden.includes(id));

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const order = [...layout.order];
    const fromIdx = order.indexOf(dragId);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, dragId);
    persist({ ...layout, order });
    setDragId(null);
  }

  function toggleHidden(id: string) {
    const hidden = layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
    persist({ ...layout, hidden });
  }

  function resetLayout() { persist({ order: DEFAULT_ORDER, hidden: [] }); }

  // ---- toolbar actions ----
  const shareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/analytics?from=${from}&to=${to}`;
  };
  async function onShare() {
    const url = shareUrl();
    try {
      if (navigator.share) { await navigator.share({ title: "Practice Analytics", url }); return; }
    } catch { /* fall through */ }
    try { await navigator.clipboard.writeText(url); alert("Analytics link copied to clipboard (staff login required)."); }
    catch { prompt("Copy this analytics link:", url); }
  }
  function onPresent() {
    window.open(`/analytics/present?from=${from}&to=${to}`, "_blank", "noopener");
  }
  function onExportPdf() {
    if (mode === "present") { window.print(); return; }
    window.open(`/analytics/present?from=${from}&to=${to}&print=1`, "_blank", "noopener");
  }

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
            <button onClick={() => setEditing((v) => !v)} className={`btn-secondary py-1.5 text-sm ${editing ? "ring-2 ring-brand-300" : ""}`}>{editing ? "Done editing" : "Customize layout"}</button>
            {editing && <button onClick={resetLayout} className="btn-secondary py-1.5 text-sm">Reset</button>}
            <button onClick={onExportPdf} className="btn-secondary py-1.5 text-sm">Export PDF</button>
            <button onClick={onShare} className="btn-secondary py-1.5 text-sm">Share</button>
            <button onClick={onPresent} className="btn-primary py-1.5 text-sm">Presentation</button>
          </div>
        )}
        {mode === "present" && (
          <button onClick={onExportPdf} className="no-print ml-auto btn-primary py-1.5 text-sm">Export PDF</button>
        )}
      </div>

      {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
      {loading && !data && <div className="text-slate-400 text-sm py-10 text-center">Loading analytics…</div>}

      {/* Hidden widgets tray (edit mode) */}
      {editing && layout.hidden.length > 0 && (
        <div className="no-print rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Hidden widgets — click to restore</div>
          <div className="flex flex-wrap gap-2">
            {layout.hidden.map((id) => (
              <button key={id} onClick={() => toggleHidden(id)} className="chip bg-white ring-1 ring-slate-200 text-slate-600 text-xs hover:bg-slate-100">+ {widgetMap[id]?.title || id}</button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {visible.map((id) => {
            const w = widgetMap[id];
            if (!w) return null;
            return (
              <div
                key={id}
                className={`${spanClass(w.span)} rounded-lg bg-white ring-1 ring-slate-200 ${dragId === id ? "opacity-50" : ""}`}
                draggable={editing}
                onDragStart={() => setDragId(id)}
                onDragOver={(e) => { if (editing) e.preventDefault(); }}
                onDrop={() => onDrop(id)}
              >
                <div className={`px-3 pt-2.5 pb-1 flex items-center gap-2 ${editing ? "cursor-move" : ""}`}>
                  {editing && <span className="text-slate-300 select-none" title="Drag to reorder">⠿</span>}
                  <span className="text-xs font-semibold text-slate-700 truncate">{w.title}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-300">{w.category}</span>
                  {editing && <button onClick={() => toggleHidden(id)} className="text-rose-400 hover:text-rose-600 text-xs" title="Hide widget">✕</button>}
                </div>
                <div className="px-3 pb-3">{w.render(data)}</div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "dashboard" && (
        <p className="no-print text-[10px] text-slate-400">
          Layout &amp; filters are saved to this browser. Use “Customize layout” to drag, hide or restore boxes. Export/Share/Presentation reflect the current date range.
        </p>
      )}
    </div>
  );
}
