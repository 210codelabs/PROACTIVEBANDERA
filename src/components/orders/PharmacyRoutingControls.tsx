"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PharmacyPicker, { type Pharmacy } from "./PharmacyPicker";

type PatientHit = { id: string; mrn: string; firstName: string; lastName: string; dob: string };

export default function PharmacyRoutingControls({ pendingRxCount }: { pendingRxCount: number }) {
  const router = useRouter();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assign-to-patient state
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [openList, setOpenList] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    if (patient || pq.trim().length < 2) { setHits([]); return; }
    deb.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/patients/search?q=${encodeURIComponent(pq.trim())}&limit=8`);
        const d = await r.json();
        setHits(Array.isArray(d.results) ? d.results : []);
        setOpenList(true);
      } catch { setHits([]); }
    }, 250);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [pq, patient]);

  async function routePendingRx() {
    if (!pharmacy) { setError("Select a destination pharmacy first."); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch("/api/orders/pharmacy", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "pending", pharmacyId: pharmacy.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { routed?: number; error?: string; queued?: boolean; message?: string; destination?: string };
      if (!res.ok) { setError(data.error || "Unable to route prescriptions."); setLoading(false); return; }
      setResult(data.queued ? (data.message || "Prescription routing request accepted and queued.") : `Routed ${data.routed || 0} pending prescription(s) to ${data.destination || pharmacy.name}.`);
      router.refresh();
    } catch { setError("Pharmacy routing is temporarily unavailable."); } finally { setLoading(false); }
  }

  async function assignToPatient() {
    setAssignMsg(null);
    if (!pharmacy?.ncpdpId) { setAssignMsg({ kind: "err", text: "Pick a routable pharmacy (with an NCPDP) first." }); return; }
    if (!patient) { setAssignMsg({ kind: "err", text: "Select a patient to assign." }); return; }
    setAssigning(true);
    try {
      const r = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryPharmacyNcpdp: pharmacy.ncpdpId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAssignMsg({ kind: "err", text: d.error || "Could not update the patient chart." }); return; }
      setAssignMsg({ kind: "ok", text: `Set ${pharmacy.name} as ${patient.lastName}, ${patient.firstName}'s primary pharmacy.` });
      router.refresh();
    } catch { setAssignMsg({ kind: "err", text: "Network error." }); } finally { setAssigning(false); }
  }

  return (
    <div className="mt-3 space-y-3">
      <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />

      {/* Route the pending Rx queue to the selected pharmacy */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={routePendingRx} disabled={loading || pendingRxCount === 0 || !pharmacy}>
          {loading ? "Sending to pharmacy…" : "Send Pending Rx to Pharmacy"}
        </button>
        <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Pending Rx orders: {pendingRxCount}</span>
        {result && <span className="text-xs text-emerald-700">{result}</span>}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>

      {/* Assign the selected pharmacy to a patient's chart */}
      <div className="rounded-lg ring-1 ring-slate-200 bg-slate-50/60 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Assign to patient</div>
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative flex-1 min-w-[220px]">
            {patient ? (
              <div className="flex items-center justify-between gap-2 rounded-md ring-1 ring-brand-200 bg-brand-50/70 px-3 py-2">
                <span className="text-sm text-slate-800 truncate">{patient.lastName}, {patient.firstName} <span className="text-xs text-slate-500">· MRN {patient.mrn}</span></span>
                <button type="button" className="text-[11px] font-semibold text-slate-500 hover:underline" onClick={() => { setPatient(null); setPq(""); }}>Change</button>
              </div>
            ) : (
              <>
                <input
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  onFocus={() => setOpenList(true)}
                  placeholder="Search patient by name, MRN, DOB…"
                  className="input"
                />
                {openList && hits.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg ring-1 ring-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {hits.map((h) => (
                      <button key={h.id} type="button" onClick={() => { setPatient(h); setOpenList(false); setHits([]); }} className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm">
                        <span className="font-medium text-slate-900">{h.lastName}, {h.firstName}</span>
                        <span className="text-xs text-slate-500"> · MRN {h.mrn}{h.dob ? ` · DOB ${new Date(h.dob).toLocaleDateString()}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={assignToPatient} disabled={assigning || !pharmacy?.ncpdpId || !patient}>
            {assigning ? "Assigning…" : "Add / Assign"}
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Sets the chosen pharmacy as the patient&apos;s primary (e-prescribing) pharmacy on their chart.</div>
        {assignMsg && <div className={`mt-1 text-xs ${assignMsg.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{assignMsg.text}</div>}
      </div>
    </div>
  );
}
