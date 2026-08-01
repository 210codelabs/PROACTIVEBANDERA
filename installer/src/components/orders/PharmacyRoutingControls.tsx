"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PharmacyPicker, { type Pharmacy } from "./PharmacyPicker";

export default function PharmacyRoutingControls({ pendingRxCount }: { pendingRxCount: number }) {
  const router = useRouter();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function routePendingRx() {
    if (!pharmacy) {
      setError("Select a destination pharmacy first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/orders/pharmacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "pending", pharmacyId: pharmacy.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        routed?: number;
        error?: string;
        queued?: boolean;
        message?: string;
        destination?: string;
      };
      if (!res.ok) {
        setError(data.error || "Unable to route prescriptions.");
        setLoading(false);
        return;
      }
      if (data.queued) {
        setResult(data.message || "Prescription routing request accepted and queued.");
      } else {
        setResult(`Routed ${data.routed || 0} pending prescription(s) to ${data.destination || pharmacy.name}.`);
      }
      router.refresh();
    } catch {
      setError("Pharmacy routing is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={routePendingRx}
          disabled={loading || pendingRxCount === 0 || !pharmacy}
        >
          {loading ? "Sending to pharmacy…" : "Send Pending Rx to Pharmacy"}
        </button>
        <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Pending Rx orders: {pendingRxCount}</span>
        {result && <span className="text-xs text-emerald-700">{result}</span>}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </div>
  );
}
