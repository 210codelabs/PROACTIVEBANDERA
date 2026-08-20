"use client";

import React, { useEffect, useState } from "react";
import DrugSearch from "@/components/drugs/DrugSearch";
import PharmacyPicker, { type Pharmacy } from "@/components/orders/PharmacyPicker";
import SignaturePad from "./SignaturePad";

type Pat = { id: string; firstName: string; lastName: string; dob?: string; mrn?: string };

export default function ErxBuilder({ providerName }: { providerName: string }) {
  const [patQ, setPatQ] = useState("");
  const [patResults, setPatResults] = useState<Pat[]>([]);
  const [patient, setPatient] = useState<Pat | null>(null);
  const [currentMeds, setCurrentMeds] = useState<any[]>([]);
  const [med, setMed] = useState({ medName: "", strength: "", form: "", ndc: "" });
  const [rx, setRx] = useState({ sig: "", quantity: "", refills: "0", daw: false, notes: "" });
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [providerNpi, setProviderNpi] = useState("");
  const [sig, setSig] = useState<{ type: "typed" | "drawn"; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (patQ.trim().length < 2 || patient) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/patients/search?q=${encodeURIComponent(patQ.trim())}&limit=6`);
      const d = await r.json(); setPatResults(d.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [patQ, patient]);

  // Auto-load the selected patient's current medication list.
  useEffect(() => {
    if (!patient?.id) { setCurrentMeds([]); return; }
    let live = true;
    fetch(`/api/patients/${patient.id}/medications`)
      .then((r) => r.json())
      .then((d) => { if (live) setCurrentMeds(d.medications || []); })
      .catch(() => { if (live) setCurrentMeds([]); });
    return () => { live = false; };
  }, [patient?.id]);

  async function submit() {
    setErr(null);
    if (!med.medName.trim()) { setErr("Select or enter a medication."); return; }
    if (!patient && !patQ.trim()) { setErr("Select a patient."); return; }
    if (!sig) { setErr("Add your e-signature to sign the prescription."); return; }
    setBusy(true);
    try {
      const body = {
        patientId: patient?.id || null,
        patientName: patient ? `${patient.lastName}, ${patient.firstName}` : patQ.trim(),
        patientDob: patient?.dob ? String(patient.dob).slice(0, 10) : null,
        ...med,
        sig: rx.sig, quantity: rx.quantity, refills: parseInt(rx.refills, 10) || 0, daw: rx.daw, notes: rx.notes,
        pharmacyName: pharmacy?.name || null, pharmacyPhone: pharmacy?.phone || null,
        pharmacyAddress: pharmacy ? [pharmacy.city, pharmacy.state].filter(Boolean).join(", ") : null,
        pharmacyNpi: (pharmacy as any)?.ncpdpId || null,
        providerName, providerNpi: providerNpi || null,
        signatureType: sig.type, signatureData: sig.data,
      };
      const r = await fetch("/api/erx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save prescription."); return; }
      setSavedId(d.id);
    } catch { setErr("Could not save prescription."); } finally { setBusy(false); }
  }

  if (savedId) {
    return (
      <div className="card card-pad text-center max-w-lg mx-auto">
        <div className="text-3xl">✅</div>
        <h2 className="mt-2 text-lg font-bold text-slate-900">Prescription signed</h2>
        <p className="text-sm text-slate-500 mt-1">The eRx has been recorded and e-signed.</p>
        <div className="mt-4 flex justify-center gap-2">
          <a href={`/api/erx/${savedId}/pdf`} target="_blank" rel="noopener" className="btn-primary">Print / Download PDF</a>
          <button onClick={() => { setSavedId(null); setMed({ medName: "", strength: "", form: "", ndc: "" }); setRx({ sig: "", quantity: "", refills: "0", daw: false, notes: "" }); setSig(null); setPatient(null); setPatQ(""); setPharmacy(null); }} className="btn-secondary">New prescription</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <section className="card card-pad space-y-3">
        <h3 className="font-semibold text-slate-900">Patient</h3>
        {patient ? (
          <div className="flex items-center justify-between rounded-lg bg-brand-50 ring-1 ring-brand-200 px-3 py-2">
            <span className="text-sm font-medium">{patient.lastName}, {patient.firstName} <span className="text-slate-400 font-mono text-xs">{patient.mrn}</span></span>
            <button onClick={() => setPatient(null)} className="chip bg-white ring-slate-200 text-xs">Change</button>
          </div>
        ) : (          <div className="relative">
            <input className="input w-full" placeholder="Search patient by name / MRN…" value={patQ} onChange={(e) => setPatQ(e.target.value)} />
            {patResults.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg bg-white ring-1 ring-slate-200 shadow-lg max-h-56 overflow-auto">
                {patResults.map((p) => <li key={p.id}><button onClick={() => { setPatient(p); setPatResults([]); }} className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm">{p.lastName}, {p.firstName} <span className="text-slate-400 font-mono text-xs">{p.mrn}</span></button></li>)}
              </ul>
            )}
          </div>
        )}

        {patient && (
          <div className="rounded-lg ring-1 ring-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">Current medications ({currentMeds.length})</span>
              {patient.id && <a href={`/patients/${patient.id}`} className="text-[11px] text-brand-700 hover:underline">Open chart</a>}
            </div>
            {currentMeds.length === 0 ? (
              <p className="text-[11px] text-slate-400">No active medications on file for this patient.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-auto">
                {currentMeds.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs bg-white rounded ring-1 ring-slate-200 px-2 py-1">
                    <span className="flex-1 truncate"><span className="font-medium text-slate-800">{m.name}</span>{m.strength ? ` · ${m.strength}` : ""}{m.sig ? <span className="text-slate-400"> — {m.sig}</span> : null}</span>
                    <button type="button" onClick={() => { setMed({ medName: m.name || "", strength: m.strength || "", form: m.form || "", ndc: m.ndc || "" }); if (m.sig) setRx((p) => ({ ...p, sig: m.sig })); }} className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px] shrink-0">Prescribe again</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3 className="font-semibold text-slate-900 pt-1">Medication (FDA)</h3>
        <DrugSearch onSelect={(d) => setMed({ medName: d.brandName || d.genericName || "", strength: d.strengths?.[0] || "", form: d.dosageForm || "", ndc: d.productNdc || "" })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm"><span className="label">Medication *</span><input className="input w-full" value={med.medName} onChange={(e) => setMed({ ...med, medName: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Strength</span><input className="input w-full" value={med.strength} onChange={(e) => setMed({ ...med, strength: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Form</span><input className="input w-full" value={med.form} onChange={(e) => setMed({ ...med, form: e.target.value })} /></label>
          <label className="text-sm"><span className="label">NDC</span><input className="input w-full" value={med.ndc} onChange={(e) => setMed({ ...med, ndc: e.target.value })} /></label>
        </div>
        <label className="text-sm block"><span className="label">Sig (directions)</span><input className="input w-full" value={rx.sig} onChange={(e) => setRx({ ...rx, sig: e.target.value })} placeholder="e.g. Take 1 tablet by mouth daily" /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm"><span className="label">Quantity</span><input className="input w-full" value={rx.quantity} onChange={(e) => setRx({ ...rx, quantity: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Refills</span><input type="number" className="input w-full" value={rx.refills} onChange={(e) => setRx({ ...rx, refills: e.target.value })} /></label>
          <label className="text-sm flex items-end gap-2 pb-2"><input type="checkbox" checked={rx.daw} onChange={(e) => setRx({ ...rx, daw: e.target.checked })} /> DAW</label>
        </div>
      </section>

      <section className="card card-pad space-y-3">
        <h3 className="font-semibold text-slate-900">Pharmacy (NPPES / network)</h3>
        <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />

        <h3 className="font-semibold text-slate-900 pt-1">Prescriber</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm"><span className="label">Provider</span><input className="input w-full" value={providerName} disabled /></label>
          <label className="text-sm"><span className="label">Provider NPI</span><input className="input w-full" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)} placeholder="10-digit NPI" /></label>
        </div>
        <SignaturePad onChange={setSig} />

        {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
        <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">{busy ? "Signing…" : "Sign & generate prescription"}</button>
        <p className="text-[10px] text-slate-400">The PDF includes the practice letterhead &amp; NPI, pharmacy details, and your NPI + e-signature. Demo build — not for clinical use.</p>
      </section>
    </div>
  );
}
