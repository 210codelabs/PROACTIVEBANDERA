"use client";

import React, { useEffect, useState } from "react";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string; missing?: string[] }
  | { kind: "ready"; url: string; environment: string };

// Fetches an authenticated Weno EZ (ComposeRx) iFrame URL from
// GET /api/weno/iframe-url/[patientId] and renders it. The URL is treated as a
// short-lived, sensitive value — it is only held in component state.
export default function WenoEzFrame({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  async function load() {
    setState({ kind: "loading" });
    try {
      const r = await fetch(`/api/weno/iframe-url/${patientId}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ kind: "error", message: d.error || "Could not open Weno prescribing.", missing: d.missing });
        return;
      }
      setState({ kind: "ready", url: d.iframeUrl, environment: d.environment });
    } catch {
      setState({ kind: "error", message: "Weno prescribing is temporarily unavailable." });
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [patientId]);

  if (state.kind === "loading") {
    return <div className="card card-pad text-sm text-slate-500">Preparing secure Weno prescribing session…</div>;
  }
  if (state.kind === "error") {
    return (
      <div className="card card-pad space-y-3">
        <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{state.message}</div>
        {state.missing && state.missing.length > 0 && (
          <ul className="list-disc list-inside text-sm text-slate-600">{state.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
        <button onClick={load} className="btn-secondary">Try again</button>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Weno e-Prescribing (EZ Integration)</span>
        <span className={`chip ring-1 ${state.environment === "production" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{state.environment === "production" ? "Live" : "Sandbox / Test"}</span>
      </div>
      <iframe
        title="Weno ComposeRx"
        src={state.url}
        className="w-full"
        style={{ height: "78vh", border: "0" }}
        allow="clipboard-write"
      />
    </div>
  );
}
