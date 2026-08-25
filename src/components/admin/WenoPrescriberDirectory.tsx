"use client";

import { useEffect, useState } from "react";

type Prescriber = { id: string; firstName: string; lastName: string; npi: string; dea?: string | null; wenoEmail?: string | null; userId?: string | null; isDefault: boolean; active: boolean };

const empty = { firstName: "", lastName: "", npi: "", dea: "", wenoEmail: "", userId: "", isDefault: false };

export default function WenoPrescriberDirectory() {
  const [list, setList] = useState<Prescriber[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/weno/prescribers");
      const d = await r.json();
      setList(Array.isArray(d.prescribers) ? d.prescribers : []);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/admin/weno/prescribers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save."); return; }
      setForm({ ...empty });
      await load();
    } catch { setErr("Request failed."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/weno/prescribers?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    await load();
  }
  async function makeDefault(id: string) {
    await fetch("/api/admin/weno/prescribers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isDefault: true }) }).catch(() => {});
    await load();
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Weno-registered prescribers</h3>
      <p className="mt-0.5 text-xs text-slate-500">Saved prescribers pre-fill NPI/DEA in the eRx module. Clinicians pick the right one per login; the default is auto-selected.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-6">
        <input className="input sm:col-span-1" placeholder="First" value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} />
        <input className="input sm:col-span-1" placeholder="Last" value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} />
        <input className="input sm:col-span-1" placeholder="NPI (10-digit)" value={form.npi} onChange={(e) => setForm((s) => ({ ...s, npi: e.target.value }))} />
        <input className="input sm:col-span-1" placeholder="DEA (optional)" value={form.dea} onChange={(e) => setForm((s) => ({ ...s, dea: e.target.value }))} />
        <input className="input sm:col-span-2" placeholder="Weno email (optional launch override)" value={form.wenoEmail} onChange={(e) => setForm((s) => ({ ...s, wenoEmail: e.target.value }))} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((s) => ({ ...s, isDefault: e.target.checked }))} /> Set as default
        </label>
        <button type="button" onClick={add} disabled={busy} className="btn-primary py-1.5 px-3 text-xs disabled:opacity-60">{busy ? "Saving…" : "Add prescriber"}</button>
        {err && <span className="text-[11px] text-rose-600">{err}</span>}
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {list.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">No prescribers saved yet.</div>}
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-slate-900 truncate">
                {p.firstName} {p.lastName} <span className="font-mono text-slate-500">{p.npi}</span>
                {p.dea && <span className="ml-1 text-[10px] text-slate-400">DEA ••••{p.dea.slice(-4)}</span>}
                {p.isDefault && <span className="ml-2 chip bg-emerald-100 text-emerald-700 text-[10px]">Default</span>}
              </div>
              {p.wenoEmail && <div className="text-[11px] text-slate-400 truncate">{p.wenoEmail}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!p.isDefault && <button type="button" onClick={() => makeDefault(p.id)} className="text-[11px] text-brand-700 hover:underline">Make default</button>}
              <button type="button" onClick={() => remove(p.id)} className="text-[11px] text-rose-600 hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
