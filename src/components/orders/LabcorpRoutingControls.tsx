"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LabcorpRoutingControls({ pendingLabCount }: { pendingLabCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function routePendingLabs() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/orders/labcorp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "pending" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        routed?: number;
        error?: string;
        queued?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "Unable to route orders to Labcorp");
        setLoading(false);
        return;
      }
      if (data.queued) {
        setResult(data.message || "Labcorp routing request accepted and queued.");
      } else {
        setResult(`Routed ${data.routed || 0} pending lab order(s) to Labcorp.`);
      }
      router.refresh();
    } catch {
      setError("Labcorp routing is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-primary"
        onClick={routePendingLabs}
        disabled={loading || pendingLabCount === 0}
      >
        {loading ? "Routing to Labcorp..." : "Route Pending Labs to Labcorp"}
      </button>
      <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Pending lab orders: {pendingLabCount}</span>
      {result && <span className="text-xs text-emerald-700">{result}</span>}
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
