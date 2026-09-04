"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { configured: boolean; environment: string; registry: string } | null;

export default function ImmtracPanel({
  patientId,
  initialConsent,
  canEdit,
}: {
  patientId: string;
  initialConsent: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [consent, setConsent] = useState<boolean>(Boolean(initialConsent));
  const [consentSaving, setConsentSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/immtrac/status")
      .then((r) => r.json())
      .then((d) => { if (alive) setStatus(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function toggleConsent(next: boolean) {
    setConsentSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immtracConsent: next, immtracConsentAt: next ? new Date().toISOString() : null }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg({ kind: "err", text: d.error || "Could not save consent." }); return; }
      setConsent(next);
      router.refresh();
    } catch { setMsg({ kind: "err", text: "Network error." }); }
    finally { setConsentSaving(false); }
  }

  async function pull() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/patients/${patientId}/immunizations/pull`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 503) { setMsg({ kind: "warn", text: d.error || "ImmTrac2 is not connected yet." }); return; }
      if (r.status === 412) { setMsg({ kind: "warn", text: d.error || "Consent required." }); return; }
      if (!r.ok) { setMsg({ kind: "err", text: d.error || "Query failed." }); return; }
      if (d.status === "MULTIPLE") { setMsg({ kind: "warn", text: d.message }); return; }
      if (d.status === "NO_MATCH") { setMsg({ kind: "warn", text: d.message || "No registry records found." }); return; }
      setMsg({ kind: "ok", text: `Imported ${d.imported} immunization${d.imported === 1 ? "" : "s"} from ImmTrac2${d.skipped ? ` (${d.skipped} already on file)` : ""}.` });
      router.refresh();
    } catch { setMsg({ kind: "err", text: "Network error." }); }
    finally { setBusy(false); }
  }

  const connected = Boolean(status?.configured);
  const canPull = connected && consent && canEdit && !busy;

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between">
        <span>State Registry — Texas ImmTrac2</span>
        {status ? (
          connected ? (
            <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Connected · {status.environment}</span>
          ) : (
            <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Not connected</span>
          )
        ) : (
          <span className="chip bg-slate-100 text-slate-500 ring-slate-200">Checking…</span>
        )}
      </header>

      <div className="p-4 space-y-3 text-sm">
        {/* Consent gate */}
        <div className={`rounded-lg ring-1 px-3 py-2 ${consent ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200"}`}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              disabled={!canEdit || consentSaving}
              onChange={(e) => toggleConsent(e.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-800">ImmTrac2 consent on file</span>
              <span className="block text-xs text-slate-500">
                Texas ImmTrac2 is opt-in. Confirm the patient signed the DSHS consent form (retained in the chart) before querying the registry.
              </span>
            </span>
          </label>
        </div>

        {/* Pull button */}
        <button
          onClick={pull}
          disabled={!canPull}
          className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? "Querying Texas ImmTrac2…" : "Pull from Texas ImmTrac2"}
        </button>

        {!connected && status && (
          <p className="text-xs text-amber-700">
            The registry connection is inactive until Texas DSHS issues the clinic its bidirectional (query) credentials and WSDL.
            The button turns on automatically once those are configured.
          </p>
        )}
        {connected && !consent && (
          <p className="text-xs text-slate-500">Record the patient&apos;s ImmTrac2 consent above to enable the pull.</p>
        )}

        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : msg.kind === "warn" ? "text-amber-700" : "text-rose-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
