"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MovementType = "receive" | "adjust" | "count" | "waste";

export default function InventoryAdjust({ itemId, unit }: { itemId: string; unit: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MovementType>("receive");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setError("Enter a non-zero quantity.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${itemId}/movement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, quantity: qty, reason: reason || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not update stock.");
      setOpen(false);
      setQuantity("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">
        Adjust
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 rounded-md bg-slate-50 ring-1 ring-slate-200 p-2 text-left">
      <div className="flex flex-wrap gap-1.5">
        {(["receive", "adjust", "waste", "count"] as MovementType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`chip ${type === t ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-white text-slate-600 ring-slate-200"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="number"
        className="input"
        placeholder={type === "count" ? `New on-hand (${unit})` : type === "receive" ? `Units received (${unit})` : `+/- units (${unit})`}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <input className="input" placeholder="Reason / reference (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="btn-primary text-xs px-3 py-1.5">{busy ? "Saving..." : "Apply"}</button>
        <button onClick={() => { setOpen(false); setError(null); }} className="chip bg-white text-slate-600 ring-slate-200">Cancel</button>
      </div>
    </div>
  );
}
