"use client";

import React, { useEffect, useState } from "react";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; url: string; environment: string };

// Renders the Weno RxLog inside the EHR (view on demand). Fetches an authenticated
// RxLog iFrame URL from GET /api/weno/rxlog-url.
export default function WenoRxLogFrame() {
  const [state, setState] = useState<State>({ kind: "loading" });

  async function load() {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/weno/rxlog-url");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setState({ kind: "error", message: d.error || "Could not open the Weno Rx Log." }); return; }
      setState({ kind: "ready", url: d.iframeUrl, environment: d.environment });
    } catch {
      setState({ kind: "error", message: "Weno Rx Log is temporarily unavailable." });
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (state.kind === "loading") return <div className="card card-pad text-sm text-slate-500">Loading the Weno Rx Log…</div>;
  if (state.kind === "error") {
    return (
      <div className="card card-pad space-y-3">
        <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{state.message}</div>
        <button onClick={load} className="btn-secondary">Try again</button>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Weno Rx Log</span>
        <span data-testid="weno-env-badge" className="chip ring-1 bg-emerald-50 text-emerald-800 ring-emerald-200">Live · Production</span>
      </div>
      <iframe title="Weno Rx Log" src={state.url} className="w-full" style={{ height: "78vh", border: "0" }} allow="clipboard-write" />
    </div>
  );
}
