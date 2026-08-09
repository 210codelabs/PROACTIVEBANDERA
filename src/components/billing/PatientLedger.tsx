"use client";

import React, { useCallback, useEffect, useState } from "react";

type Entry = { id: string; type: string; amountCents: number; description: string; date: string; claimId?: string | null };
type Totals = { charges: number; payments: number; adjustments: number; balanceCents: number };

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

export default function PatientLedger({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/patients/${patientId}/ledger`);
    if (r.ok) { const d = await r.json(); setEntries(d.entries || []); setTotals(d.totals || null); }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      {totals && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Charges" value={money(totals.charges)} tone="slate" />
          <Stat label="Payments" value={money(totals.payments)} tone="emerald" />
          <Stat label="Balance" value={money(totals.balanceCents)} tone={totals.balanceCents > 0 ? "rose" : "slate"} />
        </div>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No account activity yet. Charges and insurance payments post here automatically.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-slate-700">{e.description}</td>
                  <td className="px-3 py-2"><span className={`chip ring-1 ${e.type === "payment" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : e.type === "charge" ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{e.type}</span></td>
                  <td className={`px-3 py-2 text-right font-medium ${e.type === "payment" ? "text-emerald-700" : "text-slate-800"}`}>{e.type === "payment" ? "-" : ""}{money(e.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" }) {
  const cls = { slate: "from-slate-100", emerald: "from-emerald-100", rose: "from-rose-100" }[tone];
  return (
    <div className={`rounded-lg bg-gradient-to-br ${cls} to-white p-3 ring-1 ring-slate-100`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
