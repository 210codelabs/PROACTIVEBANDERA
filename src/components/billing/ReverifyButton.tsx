"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Compact re-verify button used in the billing eligibility report. Re-runs a
 * live Stedi eligibility check for a patient and refreshes the list.
 */
export default function ReverifyButton({ patientId, payerId }: { patientId: string; payerId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    setErr(false);
    try {
      const r = await fetch("/api/stedi/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, payerId: payerId || undefined }),
      });
      const d = await r.json();
      if (d.error && !d.check) { setErr(true); setMsg(d.error.slice(0, 60)); }
      else if (d.check) { setMsg(String(d.check.status).toUpperCase()); }
      router.refresh();
    } catch {
      setErr(true);
      setMsg("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={run} disabled={busy} className="btn-secondary py-1 px-2 text-xs disabled:opacity-50">
        {busy ? "Verifying…" : "Re-verify"}
      </button>
      {msg && <span className={`text-xs ${err ? "text-rose-600" : "text-emerald-700"}`}>{msg}</span>}
    </span>
  );
}
