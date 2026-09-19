"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateClaimButton({ encounterId }: { encounterId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/stedi/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encounterId }) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || "Failed"); return; }
      if (d.pipRouted) {
        try { window.alert(`Claim routed to the patient's PIP auto-insurer${d.claim?.payerName ? ` (${d.claim.payerName})` : ""} as the primary payer.`); } catch {}
      }
      router.push("/billing/revenue-cycle");
    } catch {
      setErr("Failed");
    } finally { setBusy(false); }
  }
  return (
    <button onClick={create} disabled={busy} title={err || "Create a claim draft from this encounter"} className="text-xs text-brand-700 hover:underline disabled:opacity-50">
      {busy ? "…" : err ? "Retry" : "Create claim"}
    </button>
  );
}
