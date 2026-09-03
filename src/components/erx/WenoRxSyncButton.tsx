"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Button placed in the patient's Medications tab. Pulls the Weno NewRx Sync
// Report (last 7 days) for THIS patient and imports signed prescriptions into
// the medication history, then refreshes the list.
export default function WenoRxSyncButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [tone, setTone] = useState<"ok" | "err" | "">("");

  async function sync() {
    setBusy(true); setMsg(""); setTone("");
    try {
      const r = await fetch(`/api/weno/rx-sync?patientId=${encodeURIComponent(patientId)}&days=7`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTone("err");
        setMsg(d.error || "Weno sync failed.");
      } else {
        setTone("ok");
        setMsg(
          d.imported > 0
            ? `Imported ${d.imported} prescription${d.imported === 1 ? "" : "s"} from Weno.`
            : `No new Weno prescriptions in the last 7 days${d.matched ? " (already up to date)" : ""}.`,
        );
        if (d.imported > 0) router.refresh();
      }
    } catch {
      setTone("err"); setMsg("Weno sync is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span className={`text-xs ${tone === "err" ? "text-rose-600" : "text-emerald-700"}`}>{msg}</span>
      )}
      <button onClick={sync} disabled={busy} className="btn-secondary" title="Import signed prescriptions from Weno (last 7 days)">
        {busy ? "Syncing…" : "Sync from Weno"}
      </button>
    </div>
  );
}
