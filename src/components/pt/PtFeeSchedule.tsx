"use client";

import React, { useEffect, useState } from "react";

type Fee = { code: string; description: string | null; chargeCents: number };

const PRESETS: Array<{ code: string; description: string }> = [
  { code: "97161", description: "PT evaluation, low complexity" },
  { code: "97162", description: "PT evaluation, moderate complexity" },
  { code: "97163", description: "PT evaluation, high complexity" },
  { code: "97164", description: "PT re-evaluation" },
  { code: "97110", description: "Therapeutic exercise" },
  { code: "97112", description: "Neuromuscular re-education" },
  { code: "97116", description: "Gait training" },
  { code: "97140", description: "Manual therapy" },
  { code: "97530", description: "Therapeutic activities" },
  { code: "97535", description: "Self-care / home management training" },
  { code: "97010", description: "Hot / cold packs" },
  { code: "97012", description: "Mechanical traction" },
  { code: "97014", description: "Electrical stimulation (unattended)" },
  { code: "97032", description: "Electrical stimulation (attended)" },
  { code: "97035", description: "Ultrasound therapy" },
  { code: "97150", description: "Group therapeutic procedure" },
];

export default function PtFeeSchedule() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nCode, setNCode] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nAmt, setNAmt] = useState("");

  async function load() {
    setLoading(true);
    try { const d = await fetch("/api/pt/fees").then((r) => r.json()); setFees(d.fees || []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function upsert(code: string, description: string | null, chargeDollars: number) {
    setBusy(true); setMsg(null);
    try {
      await fetch("/api/pt/fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, description, chargeDollars }) });
      await load();
    } catch { setMsg("Save failed."); } finally { setBusy(false); }
  }

  async function saveAmount(code: string, dollars: string) {
    const cents = Math.max(0, Math.round((parseFloat(dollars) || 0) * 100));
    setFees((cur) => cur.map((f) => f.code === code ? { ...f, chargeCents: cents } : f));
    await fetch("/api/pt/fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, chargeCents: cents }) });
  }

  async function remove(code: string) {
    setBusy(true);
    try { await fetch(`/api/pt/fees?code=${encodeURIComponent(code)}`, { method: "DELETE" }); await load(); }
    catch { /* ignore */ } finally { setBusy(false); }
  }

  async function addPreset(p: { code: string; description: string }) {
    await upsert(p.code, p.description, 0);
  }

  const existing = new Set(fees.map((f) => f.code));

  return (
    <div className="space-y-4 max-w-4xl">
      <section className="card card-pad">
        <h1 className="text-lg font-bold text-slate-900">PT Fee Schedule (charge master)</h1>
        <p className="text-sm text-slate-500">Practice-wide default charge per PT CPT. These auto-fill the dollar amounts in the PT Claims &quot;Prepare &amp; submit&quot; screen so you don&apos;t retype them.</p>
        {msg && <div className="mt-2 text-xs text-rose-600">{msg}</div>}
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Your CPT charges ({fees.length})</header>
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Loading…</div>
        ) : fees.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No fees yet. Add common PT CPT codes below, then set their amounts.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="text-left px-4 py-2">CPT</th><th className="text-left px-4 py-2">Description</th><th className="text-left px-4 py-2 w-40">Charge ($)</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fees.map((f) => (
                <tr key={f.code} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono font-semibold text-slate-800">{f.code}</td>
                  <td className="px-4 py-2 text-slate-600">{f.description || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" min={0} step="0.01"
                        defaultValue={(f.chargeCents / 100).toFixed(2)}
                        onBlur={(e) => saveAmount(f.code, e.target.value)}
                        className="w-full rounded-md border border-slate-300 pl-5 pr-2 py-1 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(f.code)} disabled={busy} className="text-xs text-rose-500 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900">Add a CPT</h2>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input value={nCode} onChange={(e) => setNCode(e.target.value.toUpperCase())} placeholder="CPT (e.g. 97110)" className="input sm:w-40 font-mono" />
          <input value={nDesc} onChange={(e) => setNDesc(e.target.value)} placeholder="Description" className="input flex-1" />
          <input value={nAmt} onChange={(e) => setNAmt(e.target.value)} type="number" min={0} step="0.01" placeholder="$ charge" className="input sm:w-32" />
          <button onClick={async () => { if (nCode.trim()) { await upsert(nCode.trim(), nDesc.trim() || null, parseFloat(nAmt) || 0); setNCode(""); setNDesc(""); setNAmt(""); } }} disabled={busy || !nCode.trim()} className="btn-primary shrink-0">Add</button>
        </div>
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Quick-add common PT CPT codes</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.filter((p) => !existing.has(p.code)).map((p) => (
              <button key={p.code} onClick={() => addPreset(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-xs px-2.5 py-1 hover:bg-indigo-100">
                <span className="font-mono font-semibold">{p.code}</span>
                <span className="text-indigo-400">+</span>
              </button>
            ))}
            {PRESETS.every((p) => existing.has(p.code)) && <span className="text-xs text-slate-400">All common codes added.</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
