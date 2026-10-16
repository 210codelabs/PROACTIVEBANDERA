"use client";

import React, { useEffect, useState } from "react";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string; missing?: string[] }
  | { kind: "ready"; url: string; environment: string };

type Prescriber = {
  id: string;
  name: string;
  npi: string;
  dea?: string;
  credential?: string;
  source: "registered" | "user";
  hasWenoLogin: boolean;
  isDefault?: boolean;
};

// Fetches an authenticated Weno EZ (ComposeRx) iFrame URL from
// GET /api/weno/iframe-url/[patientId] and renders it. A "Prescribe as" picker
// lets the user choose the correct prescriber (independent of the logged-in user
// or the admin account in Settings); the selection is passed as ?prescriberId=.
export default function WenoEzFrame({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [prescribers, setPrescribers] = useState<Prescriber[]>([]);
  const [prescriberId, setPrescriberId] = useState<string>("");

  // Load the prescriber list once, then auto-select the suggested prescriber.
  useEffect(() => {
    fetch("/api/erx/prescribers")
      .then((r) => r.json())
      .then((d) => {
        const list: Prescriber[] = Array.isArray(d.prescribers) ? d.prescribers : [];
        setPrescribers(list);
        setPrescriberId(d.suggestedId || list[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  async function load(pid: string) {
    setState({ kind: "loading" });
    try {
      const qs = pid ? `?prescriberId=${encodeURIComponent(pid)}` : "";
      const r = await fetch(`/api/weno/iframe-url/${patientId}${qs}`);
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

  // (Re)load the session whenever the selected prescriber changes.
  useEffect(() => {
    if (prescriberId) load(prescriberId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, prescriberId]);

  const selected = prescribers.find((p) => p.id === prescriberId);

  const picker = (
    <div className="card card-pad flex flex-wrap items-end gap-3">
      <label className="text-sm flex-1 min-w-[240px]">
        <span className="label">Prescribe as</span>
        <select className="input w-full" value={prescriberId} onChange={(e) => setPrescriberId(e.target.value)}>
          {prescribers.length === 0 && <option value="">No prescribers found — add one in Admin → Connections → Weno EZ Integration</option>}
          {prescribers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.credential ? `, ${p.credential}` : ""} · NPI {p.npi}
              {p.isDefault ? " (default)" : ""}{!p.hasWenoLogin ? " — no Weno login (uses account)" : ""}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="text-[11px] text-slate-500 pb-2">
          {selected.hasWenoLogin
            ? "ComposeRx will open as this prescriber's Weno login."
            : "This provider has no dedicated Weno login; ComposeRx opens with the clinic account. Add their Weno email/password in Admin to attribute Rx to them."}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {picker}
      {state.kind === "loading" && (
        <div className="card card-pad text-sm text-slate-500">Preparing secure Weno prescribing session…</div>
      )}
      {state.kind === "error" && (
        <div className="card card-pad space-y-3">
          <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{state.message}</div>
          {state.missing && state.missing.length > 0 && (
            <ul className="list-disc list-inside text-sm text-slate-600">{state.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          )}
          <button onClick={() => load(prescriberId)} className="btn-secondary">Try again</button>
        </div>
      )}
      {state.kind === "ready" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Weno e-Prescribing (EZ Integration)</span>
            <span data-testid="weno-env-badge" className="chip ring-1 bg-emerald-50 text-emerald-800 ring-emerald-200">Live · Production</span>
          </div>
          <iframe
            title="Weno ComposeRx"
            src={state.url}
            className="w-full"
            style={{ height: "74vh", border: "0" }}
            allow="clipboard-write"
          />
        </div>
      )}
    </div>
  );
}
