"use client";

import React, { useState } from "react";

/**
 * Quick copay/payment collector for the schedule (check-in). Renders a small
 * button; clicking opens a popover to post a payment to the patient ledger and
 * then print a receipt. Stops event propagation so it never triggers the
 * surrounding appointment link.
 */
export default function CopayButton({ patientId, patientName, amountDefault = "" }: { patientId: string; patientName: string; amountDefault?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(amountDefault);
  const [method, setMethod] = useState("card");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null);

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };

  function openModal(e: React.MouseEvent) { stop(e); setOpen(true); setErr(null); setPostedId(null); }
  function close(e?: React.SyntheticEvent) { if (e) stop(e); setOpen(false); }

  async function post(e: React.FormEvent) {
    stop(e); setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/patients/${patientId}/ledger`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", amountDollars: amount, method, description: note || `Copay${method ? ` (${method})` : ""}` }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Failed"); return; }
      setPostedId(d.entry?.id || null);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={openModal} title="Collect copay" className="rounded-md bg-emerald-600 text-white text-[10px] font-semibold px-1.5 py-0.5 hover:bg-emerald-700 shadow-sm">
        {amountDefault ? `$ Copay ${Number(amountDefault).toFixed(0)}` : "$ Copay"}
      </button>
      {open && (
        <div onClick={close} className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div onClick={stop} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Collect copay</h3>
              <button onClick={close} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-sm text-slate-500">{patientName}</p>
            {postedId ? (
              <div className="space-y-3">
                <div className="rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3 py-2 text-sm">Payment of ${Number(amount).toFixed(2)} posted to the account.</div>
                <div className="flex gap-2">
                  <a href={`/api/patients/${patientId}/receipt?entryId=${postedId}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn-primary flex-1 text-center">Print receipt</a>
                  <button onClick={close} className="btn-secondary flex-1">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={post} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm"><span className="label">Amount (USD)</span><input autoFocus className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} onClick={stop} required /></label>
                  <label className="text-sm"><span className="label">Method</span>
                    <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} onClick={stop}>
                      <option value="card">Card</option><option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <label className="text-sm block"><span className="label">Note (optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} onClick={stop} placeholder="Copay for today's visit" /></label>
                {err && <div className="text-sm text-rose-600">{err}</div>}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" disabled={busy} type="submit">{busy ? "Posting…" : "Post payment"}</button>
                  <button type="button" onClick={close} className="btn-secondary">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
