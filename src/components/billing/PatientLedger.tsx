"use client";

import React, { useCallback, useEffect, useState } from "react";

type Entry = { id: string; type: string; amountCents: number; description: string; date: string; claimId?: string | null; refKey?: string };
type Totals = { charges: number; payments: number; adjustments: number; balanceCents: number };

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

export default function PatientLedger({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pay, setPay] = useState({ amount: "", method: "card", description: "" });
  const [adj, setAdj] = useState({ amount: "", description: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/patients/${patientId}/ledger`);
    if (r.ok) { const d = await r.json(); setEntries(d.entries || []); setTotals(d.totals || null); }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  async function post(type: "payment" | "adjustment", body: any) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/patients/${patientId}/ledger`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...body }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Failed"); return; }
      setMsg(type === "payment" ? "Payment posted to account" : "Adjustment posted");
      setPay({ amount: "", method: "card", description: "" }); setAdj({ amount: "", description: "" });
      load();
    } finally { setBusy(false); }
  }
  async function removeEntry(id: string) {
    if (!confirm("Remove this manual entry?")) return;
    const r = await fetch(`/api/patients/${patientId}/ledger?entryId=${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); setMsg(d.error || "Cannot remove"); return; }
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <a href={`/api/patients/${patientId}/statement`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">Print statement (PDF)</a>
      </div>
      {totals && (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Charges" value={money(totals.charges)} tone="slate" />
          <Stat label="Payments" value={money(totals.payments)} tone="emerald" />
          <Stat label="Adjustments" value={money(totals.adjustments)} tone="amber" />
          <Stat label="Balance" value={money(totals.balanceCents)} tone={totals.balanceCents > 0 ? "rose" : "slate"} />
        </div>
      )}

      {msg && <div className="rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3 py-2 text-sm">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-3">
        <form onSubmit={(e) => { e.preventDefault(); post("payment", { amountDollars: pay.amount, method: pay.method, description: pay.description }); }} className="rounded-lg border border-slate-200 p-3 space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Collect copay / payment (check-in)</h4>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" step="0.01" placeholder="Amount (USD)" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
            <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              <option value="card">Card</option><option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option>
            </select>
          </div>
          <input className="input" placeholder="Note (optional, e.g. Copay for visit)" value={pay.description} onChange={(e) => setPay({ ...pay, description: e.target.value })} />
          <button className="btn-primary w-full" disabled={busy} type="submit">Post payment</button>
        </form>
        <form onSubmit={(e) => { e.preventDefault(); post("adjustment", { amountDollars: adj.amount, description: adj.description }); }} className="rounded-lg border border-slate-200 p-3 space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Adjustment / write-off</h4>
          <input className="input" type="number" step="0.01" placeholder="Amount (USD)" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} required />
          <input className="input" placeholder="Reason (e.g. Contractual write-off)" value={adj.description} onChange={(e) => setAdj({ ...adj, description: e.target.value })} />
          <button className="btn-secondary w-full" disabled={busy} type="submit">Post adjustment</button>
        </form>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No account activity yet. Charges and insurance payments post here automatically.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th /></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-slate-700">{e.description}</td>
                  <td className="px-3 py-2"><span className={`chip ring-1 ${e.type === "payment" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : e.type === "charge" ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{e.type}</span></td>
                  <td className={`px-3 py-2 text-right font-medium ${e.type === "payment" ? "text-emerald-700" : "text-slate-800"}`}>{e.type === "payment" ? "-" : ""}{money(e.amountCents)}</td>
                  <td className="px-3 py-2 text-right">{(e.refKey || "").startsWith("manual:") && <button onClick={() => removeEntry(e.id)} className="text-xs text-rose-600 hover:underline">Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" | "amber" }) {
  const cls = { slate: "from-slate-100", emerald: "from-emerald-100", rose: "from-rose-100", amber: "from-amber-100" }[tone];
  return (
    <div className={`rounded-lg bg-gradient-to-br ${cls} to-white p-3 ring-1 ring-slate-100`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
