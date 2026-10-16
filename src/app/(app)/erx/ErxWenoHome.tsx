"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import WenoEzFrame from "@/components/erx/WenoEzFrame";

type Pat = { id: string; firstName: string; lastName: string; dob?: string; mrn?: string };
type HistItem = {
  id: string;
  kind: string;
  source: string;
  medName: string;
  strength: string;
  sig: string;
  quantity: string;
  refills: number | null;
  deaSchedule: string | null;
  pharmacyName: string;
  prescriber: string;
  status: string;
  date: string | null;
};

// E-Prescribe = Weno EZ Integration ONLY (production / live Weno Exchange).
// 1) pick a patient  2) prescribe inside the embedded Weno ComposeRx
// 3) review that patient's prescription history (read-only).
export default function ErxWenoHome({ initialPatient }: { initialPatient?: Pat | null }) {
  const [patQ, setPatQ] = useState("");
  const [patResults, setPatResults] = useState<Pat[]>([]);
  const [patient, setPatient] = useState<Pat | null>(initialPatient || null);
  const [status, setStatus] = useState<{ configured: boolean; composeHost?: string } | null>(null);

  useEffect(() => {
    fetch("/api/erx/weno-status")
      .then((r) => r.json())
      .then((d) => setStatus({ configured: Boolean(d?.configured), composeHost: d?.composeHost }))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (patQ.trim().length < 2 || patient) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/patients/search?q=${encodeURIComponent(patQ.trim())}&limit=8`);
        const d = await r.json();
        setPatResults(d.results || []);
      } catch { setPatResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [patQ, patient]);

  return (
    <div className="space-y-4" data-testid="erx-weno-home">
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Weno EZ Integration</h2>
          <p className="text-[12px] text-slate-500">Prescriptions are composed and sent inside Weno ComposeRx, directly to the live Weno Exchange.</p>
        </div>
        <div className="flex items-center gap-2">
          <span data-testid="erx-env-badge" className="chip ring-1 bg-emerald-50 text-emerald-800 ring-emerald-200">Live · Production</span>
          {status && (
            <span className={`chip ring-1 ${status.configured ? "bg-white text-slate-600 ring-slate-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
              {status.configured ? `Connected${status.composeHost ? ` · ${status.composeHost}` : ""}` : "Not configured — Admin → Connections"}
            </span>
          )}
          <Link href="/erx/rxlog" className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-50">Weno Rx Log</Link>
        </div>
      </div>

      <section className="card card-pad space-y-2">
        <h3 className="font-semibold text-slate-900">Patient</h3>
        {patient ? (
          <div className="flex items-center justify-between rounded-lg bg-brand-50 ring-1 ring-brand-200 px-3 py-2" data-testid="erx-selected-patient">
            <span className="text-sm font-medium">{patient.lastName}, {patient.firstName} {patient.mrn && <span className="text-slate-400 font-mono text-xs">{patient.mrn}</span>}</span>
            <div className="flex items-center gap-2">
              <Link href={`/patients/${patient.id}`} className="text-[11px] text-brand-700 hover:underline">Open chart</Link>
              <button onClick={() => { setPatient(null); setPatQ(""); }} className="chip bg-white ring-slate-200 text-xs">Change</button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <input data-testid="erx-patient-search" className="input w-full" placeholder="Search patient by name / MRN to start a Weno prescription…" value={patQ} onChange={(e) => setPatQ(e.target.value)} />
            {patResults.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg bg-white ring-1 ring-slate-200 shadow-lg max-h-64 overflow-auto">
                {patResults.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => { setPatient(p); setPatResults([]); }} className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm">
                      {p.lastName}, {p.firstName} <span className="text-slate-400 font-mono text-xs">{p.mrn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {patient ? (
        <>
          <WenoEzFrame key={patient.id} patientId={patient.id} />
          <RxHistory patientId={patient.id} />
        </>
      ) : (
        <div className="card card-pad text-sm text-slate-500">Select a patient to open Weno ComposeRx and see their prescription history.</div>
      )}
    </div>
  );
}

function RxHistory({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/erx/history?patientId=${encodeURIComponent(patientId)}`);
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function syncFromWeno() {
    setSyncing(true); setSyncMsg("");
    try {
      const r = await fetch(`/api/weno/rx-sync?patientId=${encodeURIComponent(patientId)}&days=7`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setSyncMsg(r.ok ? (d.imported > 0 ? `Imported ${d.imported} from Weno.` : "Up to date with Weno.") : d.error || "Weno sync failed.");
      await load();
    } catch { setSyncMsg("Weno sync unavailable."); } finally { setSyncing(false); }
  }

  return (
    <section className="card card-pad space-y-3" data-testid="erx-history">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-slate-900">Prescription history <span className="text-slate-400 font-normal text-xs">· read-only</span></h3>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-[11px] text-slate-500">{syncMsg}</span>}
          <button type="button" onClick={syncFromWeno} disabled={syncing} className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-50 disabled:opacity-60">{syncing ? "Syncing…" : "↻ Sync from Weno"}</button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Loading history…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No prescriptions on file for this patient yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((h) => (
            <li key={h.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{h.medName}{h.strength ? ` ${h.strength}` : ""}</span>
                {h.deaSchedule && <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{h.deaSchedule}</span>}
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{h.source}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">{h.status}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {[h.date ? new Date(h.date).toLocaleString("en-US", { timeZone: "America/Chicago" }) : null, h.sig, h.quantity ? `Qty ${h.quantity}` : null, h.refills != null ? `Refills ${h.refills}` : null, h.pharmacyName, h.prescriber].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
