"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Schedule check-in button. Marks the appointment "checked-in" and auto-runs a
 * fresh Stedi eligibility check for the patient. Stops event propagation so it
 * never triggers the surrounding appointment link.
 */
export default function CheckInButton({ appointmentId, status }: { appointmentId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "err">("ok");

  const done = status === "checked-in" || status === "in-room" || status === "completed";
  const disabledStatus = status === "cancelled" || status === "no-show";

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };

  async function checkin(e: React.MouseEvent) {
    stop(e);
    setBusy(true);
    setToast(null);
    try {
      const r = await fetch(`/api/appointments/${appointmentId}/checkin`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setTone("err"); setToast(d.error || "Check-in failed"); return; }
      if (d.coverage) {
        const s = d.coverage.status;
        if (s === "active") { setTone("ok"); setToast("Checked in · coverage ACTIVE"); }
        else { setTone("warn"); setToast(`Checked in · coverage ${String(s).toUpperCase()}`); }
      } else {
        setTone("warn");
        setToast(d.coverageNote ? `Checked in · ${d.coverageNote}` : "Checked in");
      }
      router.refresh();
    } catch {
      setTone("err");
      setToast("Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="rounded-md bg-amber-100 text-amber-800 ring-1 ring-amber-200 text-[10px] font-semibold px-1.5 py-0.5">Checked in</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={checkin}
        disabled={busy || disabledStatus}
        title="Check in & refresh coverage"
        className="rounded-md bg-brand-600 text-white text-[10px] font-semibold px-1.5 py-0.5 hover:bg-brand-700 shadow-sm disabled:opacity-50"
      >
        {busy ? "…" : "Check in"}
      </button>
      {toast && (
        <span className={`text-[9px] font-semibold px-1 rounded ${tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-rose-700"}`}>{toast}</span>
      )}
    </span>
  );
}
