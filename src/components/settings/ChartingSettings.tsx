"use client";

import React, { useEffect, useState } from "react";
import TemplateManager from "@/components/settings/TemplateManager";

type NoteType = { id: string; name: string; format: string; isDefault: boolean; active: boolean };
type EncType = { id: string; name: string; code?: string | null; codeSystem?: string | null; isDefault: boolean; active: boolean };

export default function ChartingSettings() {
  const [tab, setTab] = useState<"note" | "enc" | "tpl" | "order" | "billing">("note");
  const tabs: { k: typeof tab; label: string }[] = [
    { k: "note", label: "Chart Note Types" },
    { k: "enc", label: "Encounter Types" },
    { k: "tpl", label: "Charting Templates" },
    { k: "order", label: "Order Templates" },
    { k: "billing", label: "Billing Templates" },
  ];
  return (
    <div>
      <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1 mb-4">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${tab === t.k ? "bg-white shadow text-brand-700" : "text-slate-500"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "note" && <NoteTypes />}
      {tab === "enc" && <EncTypes />}
      {tab === "tpl" && <TemplateManager kind="charting" />}
      {tab === "order" && <TemplateManager kind="order" />}
      {tab === "billing" && <TemplateManager kind="billing" />}
    </div>
  );
}

function NoteTypes() {
  const [items, setItems] = useState<NoteType[]>([]);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("soap");
  const [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/charting/note-types"); if (r.ok) setItems((await r.json()).noteTypes || []); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return; setBusy(true);
    await fetch("/api/charting/note-types", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, format }) });
    setName(""); setFormat("soap"); setBusy(false); load();
  }
  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/charting/note-types/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); load();
  }
  async function del(id: string) {
    const r = await fetch(`/api/charting/note-types/${id}`, { method: "DELETE" });
    if (!r.ok) alert((await r.json()).error || "Could not remove."); load();
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="text-sm font-semibold text-slate-800 mb-2">Add chart note type</div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block flex-1 min-w-48"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physical Therapy SOAP" /></label>
          <label className="block"><span className="label">Format</span>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="soap">SOAP note (S/O/A/P sections)</option>
              <option value="simple">Simple note (single free-text body)</option>
            </select>
          </label>
          <button disabled={busy} onClick={add} className="btn-primary">Add</button>
        </div>
      </div>
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Active note types</header>
        <div className="divide-y divide-slate-100">
          {items.filter((i) => i.active).map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <button title="Set practice default" onClick={() => !i.isDefault && patch(i.id, { isDefault: true })} className={`h-4 w-4 rounded-full border-2 ${i.isDefault ? "bg-brand-600 border-brand-600" : "border-slate-300"}`} />
              <span className="font-medium text-slate-900">{i.name}</span>
              <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[10px] uppercase">{i.format}</span>
              {i.isDefault && <span className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px]">Default</span>}
              <div className="ml-auto"><button onClick={() => del(i.id)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EncTypes() {
  const [items, setItems] = useState<EncType[]>([]);
  const [f, setF] = useState<{ name: string; code: string; codeSystem: string }>({ name: "", code: "", codeSystem: "" });
  const [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/charting/encounter-types"); if (r.ok) setItems((await r.json()).encounterTypes || []); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!f.name.trim()) return; setBusy(true);
    await fetch("/api/charting/encounter-types", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setF({ name: "", code: "", codeSystem: "" }); setBusy(false); load();
  }
  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/charting/encounter-types/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); load();
  }
  async function del(id: string) {
    const r = await fetch(`/api/charting/encounter-types/${id}`, { method: "DELETE" });
    if (!r.ok) alert((await r.json()).error || "Could not remove."); load();
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="text-sm font-semibold text-slate-800 mb-2">Add encounter type</div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block flex-1 min-w-48"><span className="label">Name</span><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Annual Wellness Visit" /></label>
          <label className="block"><span className="label">Code</span><input className="input w-32" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="99213" /></label>
          <label className="block"><span className="label">Code system</span>
            <select className="input" value={f.codeSystem} onChange={(e) => setF((s) => ({ ...s, codeSystem: e.target.value }))}>
              <option value="">—</option><option value="CPT">CPT</option><option value="HCPCS">HCPCS</option><option value="SNOMED">SNOMED</option>
            </select>
          </label>
          <button disabled={busy} onClick={add} className="btn-primary">Add</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Search by keyword, SNOMED, CPT® or HCPCS code. Set a default with the radio button.</p>
      </div>
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Active encounter types</header>
        <div className="divide-y divide-slate-100">
          {items.filter((i) => i.active).map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <button title="Set practice default" onClick={() => !i.isDefault && patch(i.id, { isDefault: true })} className={`h-4 w-4 rounded-full border-2 shrink-0 ${i.isDefault ? "bg-brand-600 border-brand-600" : "border-slate-300"}`} />
              <span className="font-medium text-slate-900">{i.name}</span>
              {i.code && <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[10px]">{i.codeSystem || ""} {i.code}</span>}
              {i.isDefault && <span className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px]">Default</span>}
              <div className="ml-auto"><button onClick={() => del(i.id)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
