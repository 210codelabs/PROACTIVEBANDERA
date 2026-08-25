"use client";

import React, { useEffect, useState } from "react";
import DrugSearch from "@/components/drugs/DrugSearch";
import PharmacyPicker, { type Pharmacy } from "@/components/orders/PharmacyPicker";
import SignaturePad from "./SignaturePad";

type Pat = { id: string; firstName: string; lastName: string; dob?: string; mrn?: string };

export default function ErxBuilder({ providerName, defaultNpi = "", defaultDea = "" }: { providerName: string; defaultNpi?: string; defaultDea?: string }) {
  const [patQ, setPatQ] = useState("");
  const [patResults, setPatResults] = useState<Pat[]>([]);
  const [patient, setPatient] = useState<Pat | null>(null);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [history, setHistory] = useState<any[]>([]);
  const [histReload, setHistReload] = useState(0);
  const [histAuto, setHistAuto] = useState(true);
  const [histUpdated, setHistUpdated] = useState<Date | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [currentMeds, setCurrentMeds] = useState<any[]>([]);
  const [med, setMed] = useState({ medName: "", strength: "", form: "", ndc: "", deaSchedule: "" });
  const [rx, setRx] = useState({ sig: "", quantity: "", refills: "0", daw: false, notes: "" });
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [providerNpi, setProviderNpi] = useState(defaultNpi);
  const [providerDea, setProviderDea] = useState(defaultDea);
  const [profileDea, setProfileDea] = useState(defaultDea); // last value saved to the provider profile
  const [savingProfile, setSavingProfile] = useState<string>("");
  const [histQ, setHistQ] = useState("");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");
  const [controlled, setControlled] = useState<{ schedule: string; label: string } | null>(null);
  const [ctrlLoading, setCtrlLoading] = useState(false);
  const [confirmCtrl, setConfirmCtrl] = useState(false);
  const [interactions, setInteractions] = useState<{ flagged: { med: string; matchedTerm: string; level: "high" | "moderate" | "low"; basis: string }[]; hasLabel: boolean; maxLevel: string | null } | null>(null);
  const [intxLoading, setIntxLoading] = useState(false);
  const [ackIntx, setAckIntx] = useState(false);
  const [sig, setSig] = useState<{ type: "typed" | "drawn"; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [weno, setWeno] = useState<{ enabled: boolean; configured: boolean; environment: string; epcs: boolean } | null>(null);
  const [ncpdp, setNcpdp] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [txResult, setTxResult] = useState<{ ok: boolean; state?: string; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/erx/weno-status").then((r) => r.json()).then((d) => setWeno(d)).catch(() => setWeno(null));
  }, []);

  async function transmitWeno() {
    if (!savedId) return;
    setTxBusy(true); setTxResult(null);
    try {
      const r = await fetch(`/api/erx/${savedId}/transmit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pharmacyNcpdp: ncpdp || null }) });
      const d = await r.json();
      if (!r.ok && d.error) { setTxResult({ ok: false, text: d.error }); return; }
      setTxResult({ ok: d.ok !== false, state: d.state, text: d.statusText || d.error || (d.ok ? "Transmitted to Weno." : "Transmission failed.") });
    } catch (e: any) {
      setTxResult({ ok: false, text: "Transmission request failed." });
    } finally { setTxBusy(false); }
  }

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  async function cancelRx(h: any) {
    if (!window.confirm(`Send a CancelRx to the pharmacy for ${h.medName}? This notifies the pharmacy to cancel the prescription.`)) return;
    setCancellingId(h.id);
    try {
      const r = await fetch(`/api/erx/${h.id}/cancel`, { method: "POST" });
      const d = await r.json();
      if (r.ok && d.ok !== false) { setHistReload((n) => n + 1); }
      else window.alert(d.error || d.statusText || "Could not cancel.");
    } catch { window.alert("Cancel request failed."); } finally { setCancellingId(null); }
  }

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

  // Interaction check: when a medication is chosen and the patient has current
  // meds, ask openFDA whether the new drug's label interactions mention any of them.
  useEffect(() => {
    setAckIntx(false);
    const name = med.medName.trim();
    if (!name || currentMeds.length === 0) { setInteractions(null); return; }
    let live = true;
    setIntxLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/drugs/interactions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ndc: med.ndc || undefined, meds: currentMeds.map((m) => m.name) }),
        });
        const d = await r.json();
        if (live) setInteractions({ flagged: d.flagged || [], hasLabel: !!d.hasLabel, maxLevel: d.maxLevel || null });
      } catch { if (live) setInteractions(null); }
      finally { if (live) setIntxLoading(false); }
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [med.medName, med.ndc, currentMeds]);

  // Controlled-substance detection: flag the medication's DEA schedule so the
  // signing step can require a DEA number + explicit confirmation.
  useEffect(() => {
    setConfirmCtrl(false);
    const name = med.medName.trim();
    if (!name) { setControlled(null); return; }
    // If the drug was picked from openFDA search we already know its schedule.
    if (med.deaSchedule) {
      const roman = med.deaSchedule.toUpperCase().replace(/^C/, "");
      setControlled({ schedule: "C" + roman, label: "Schedule " + roman });
      return;
    }
    let live = true;
    setCtrlLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/drugs/schedule", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ndc: med.ndc || undefined }),
        });
        const d = await r.json();
        if (live) setControlled(d?.controlled ? { schedule: d.schedule, label: d.label } : null);
      } catch { if (live) setControlled(null); }
      finally { if (live) setCtrlLoading(false); }
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [med.medName, med.ndc, med.deaSchedule]);

  // Rx history for the History tab.
  useEffect(() => {
    if (tab !== "history") return;
    let live = true;
    setHistory((cur) => { if (cur.length === 0) setHistLoading(true); return cur; });
    const url = patient?.id ? `/api/erx?patientId=${encodeURIComponent(patient.id)}` : "/api/erx";
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (live) { setHistory(d.prescriptions || []); setHistUpdated(new Date()); } })
      .catch(() => { if (live) setHistory([]); })
      .finally(() => { if (live) setHistLoading(false); });
    return () => { live = false; };
  }, [tab, patient?.id, histReload]);

  // Auto-refresh Rx history so Weno delivery-status badges update on their own.
  useEffect(() => {
    if (tab !== "history" || !histAuto) return;
    const iv = setInterval(() => setHistReload((n) => n + 1), 20000);
    return () => clearInterval(iv);
  }, [tab, histAuto]);

  function rePrescribe(h: any) {
    setMed({ medName: h.medName || "", strength: h.strength || "", form: h.form || "", ndc: h.ndc || "", deaSchedule: h.deaSchedule || "" });
    setRx({ sig: h.sig || "", quantity: h.quantity || "", refills: String(h.refills ?? 0), daw: !!h.daw, notes: h.notes || "" });
    setSig(null); setAckIntx(false); setConfirmCtrl(false); setErr(null);
    setTab("new");
  }

  async function saveProfile() {
    setSavingProfile("saving");
    try {
      const r = await fetch("/api/me/prescriber", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ npi: providerNpi, dea: providerDea }) });
      const d = await r.json();
      setSavingProfile(d.ok ? "saved" : "err");
      if (d.ok) setProfileDea(providerDea);
    } catch { setSavingProfile("err"); }
    setTimeout(() => setSavingProfile(""), 2500);
  }

  // Controlled drug picked but the provider PROFILE has no DEA saved yet.
  const deaProfileGap = !!controlled && !profileDea.trim();

  const filteredHistory = history.filter((h) => {
    const q = histQ.trim().toLowerCase();
    if (q) {
      const hay = [h.medName, h.strength, h.patientName, h.sig, h.deaSchedule].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (histFrom || histTo) {
      const day = new Date(h.createdAt).toISOString().slice(0, 10);
      if (histFrom && day < histFrom) return false;
      if (histTo && day > histTo) return false;
    }
    return true;
  });

  async function submit() {
    setErr(null);
    if (!med.medName.trim()) { setErr("Select or enter a medication."); return; }
    if (!patient && !patQ.trim()) { setErr("Select a patient."); return; }
    if (!sig) { setErr("Add your e-signature to sign the prescription."); return; }
    if (interactions && interactions.flagged.length > 0 && !ackIntx) { setErr("Potential interactions found — review and acknowledge before signing."); return; }
    if (controlled) {
      const dea = providerDea.trim();
      if (!dea) { setErr(`A DEA number is required to prescribe a controlled substance (${controlled.label}). Add it under Prescriber.`); return; }
      if (!/^[A-Za-z]{2}\d{7}$/.test(dea)) { setErr("Enter a valid DEA number (2 letters followed by 7 digits) for controlled substances."); return; }
      if (!confirmCtrl) { setErr(`Confirm the ${controlled.label} controlled-substance prescription before signing.`); return; }
    }
    setBusy(true);
    try {
      const body = {
        patientId: patient?.id || null,
        patientName: patient ? `${patient.lastName}, ${patient.firstName}` : patQ.trim(),
        patientDob: patient?.dob ? String(patient.dob).slice(0, 10) : null,
        ...med,
        deaSchedule: controlled?.schedule || null,
        sig: rx.sig, quantity: rx.quantity, refills: parseInt(rx.refills, 10) || 0, daw: rx.daw, notes: rx.notes,
        pharmacyName: pharmacy?.name || null, pharmacyPhone: pharmacy?.phone || null,
        pharmacyAddress: pharmacy ? [pharmacy.city, pharmacy.state].filter(Boolean).join(", ") : null,
        pharmacyNpi: (pharmacy as any)?.ncpdpId || null,
        providerName, providerNpi: providerNpi || null, providerDea: providerDea || null,
        signatureType: sig.type, signatureData: sig.data,
      };
      const r = await fetch("/api/erx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save prescription."); return; }
      setSavedId(d.id);
      setNcpdp((pharmacy as any)?.ncpdpId || "");
      setTxResult(null);
    } catch { setErr("Could not save prescription."); } finally { setBusy(false); }
  }

  if (savedId) {
    const stateChip = txResult?.state === "accepted" || txResult?.state === "delivered" || txResult?.state === "submitted"
      ? "bg-emerald-100 text-emerald-700" : txResult?.ok === false ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600";
    return (
      <div className="card card-pad max-w-lg mx-auto">
        <div className="text-center">
          <div className="text-3xl">✅</div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Prescription signed</h2>
          <p className="text-sm text-slate-500 mt-1">The eRx has been recorded and e-signed.</p>
        </div>

        {/* Electronic transmission via Weno Exchange */}
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Send electronically (Weno Exchange)</h3>
            {weno && (
              <span className={`chip text-[10px] ${weno.enabled && weno.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {weno.enabled && weno.configured ? `Weno ${weno.environment}` : "Not configured"}
              </span>
            )}
          </div>

          {weno && weno.enabled && weno.configured ? (
            <>
              <WenoPharmacyField ncpdp={ncpdp} setNcpdp={setNcpdp} />
              <button onClick={transmitWeno} disabled={txBusy || !ncpdp.trim()} className="btn-primary w-full mt-2 disabled:opacity-60">
                {txBusy ? "Transmitting…" : "Transmit to pharmacy via Weno"}
              </button>
              {txResult && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${txResult.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                  {txResult.state && <span className={`chip mr-2 text-[10px] ${stateChip}`}>{txResult.state}</span>}
                  {txResult.text}
                </div>
              )}
              {weno.environment === "test" && <p className="mt-1 text-[10px] text-slate-400">TEST/cert environment — use Weno test pharmacies only. Delivery is confirmed asynchronously.</p>}
            </>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">
              Weno e-prescribing isn&apos;t set up yet. An administrator can enable it under <span className="font-medium">Admin → External Integrations → Weno Exchange</span>. You can still print the prescription below.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <a href={`/api/erx/${savedId}/pdf`} target="_blank" rel="noopener" className="btn-secondary">Print / Download PDF</a>
          <button onClick={() => { setSavedId(null); setMed({ medName: "", strength: "", form: "", ndc: "", deaSchedule: "" }); setRx({ sig: "", quantity: "", refills: "0", daw: false, notes: "" }); setSig(null); setPatient(null); setPatQ(""); setPharmacy(null); setNcpdp(""); setTxResult(null); }} className="btn-primary">New prescription</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200">
        <button onClick={() => setTab("new")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${tab === "new" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>New prescription</button>
        <button onClick={() => setTab("history")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${tab === "history" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Rx history</button>
      </div>

      {tab === "history" ? (
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">Signed prescriptions {patient ? <span className="text-slate-400 font-normal">· {patient.lastName}, {patient.firstName}</span> : <span className="text-slate-400 font-normal">· all recent</span>}</h3>
            <div className="flex items-center gap-2">
              {histUpdated && <span className="text-[11px] text-slate-400">Updated {histUpdated.toLocaleTimeString()}</span>}
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={histAuto} onChange={(e) => setHistAuto(e.target.checked)} className="accent-brand-600" /> Auto
              </label>
              <button type="button" onClick={() => setHistReload((n) => n + 1)} className="chip bg-white ring-1 ring-slate-200 text-xs hover:bg-slate-50">↻ Check status</button>
              <span className="text-xs text-slate-400">{filteredHistory.length} of {history.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <label className="text-sm"><span className="label">Search</span>
              <input className="input w-full" placeholder="Medication, patient, sig…" value={histQ} onChange={(e) => setHistQ(e.target.value)} />
            </label>
            <label className="text-sm"><span className="label">From</span>
              <input type="date" className="input" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
            </label>
            <label className="text-sm"><span className="label">To</span>
              <input type="date" className="input" value={histTo} onChange={(e) => setHistTo(e.target.value)} />
            </label>
            {(histQ || histFrom || histTo) && (
              <button type="button" onClick={() => { setHistQ(""); setHistFrom(""); setHistTo(""); }} className="btn-secondary py-2 px-3 text-sm">Clear</button>
            )}
          </div>
          {histLoading ? (
            <p className="text-sm text-slate-400">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">No signed prescriptions{patient ? " for this patient" : ""} yet.</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No prescriptions match your search / date filter.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {h.medName}{h.strength ? ` ${h.strength}` : ""}
                      {h.deaSchedule && <span className="ml-2 inline-flex items-center rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white align-middle">{h.deaSchedule}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{[h.patientName, h.sig].filter(Boolean).join(" · ")}</div>
                    <div className="text-[11px] text-slate-400">{new Date(h.createdAt).toLocaleString()} · Qty {h.quantity || "—"} · Refills {h.refills ?? 0}{h.pharmacyName ? ` · ${h.pharmacyName}` : ""}</div>
                    {h.transmissionMethod === "weno" && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <WenoStateBadge state={h.wenoState} />
                        {h.pharmacyNcpdp && <span className="text-[10px] text-slate-400">NCPDP {h.pharmacyNcpdp}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`/api/erx/${h.id}/pdf`} target="_blank" rel="noopener" className="chip bg-white ring-slate-200 text-xs hover:bg-slate-50">Reprint</a>
                    <button onClick={() => rePrescribe(h)} className="chip bg-brand-100 text-brand-800 ring-brand-200 text-xs">Re-prescribe</button>
                    {h.transmissionMethod === "weno" && h.wenoMessageId && h.wenoState !== "cancelled" && h.wenoState !== "rejected" && h.wenoState !== "error" && (
                      <button onClick={() => cancelRx(h)} disabled={cancellingId === h.id} className="chip bg-rose-100 text-rose-700 ring-rose-200 text-xs disabled:opacity-60">{cancellingId === h.id ? "Cancelling…" : "Cancel Rx"}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <>
      {deaProfileGap && (
        <div className="rounded-lg bg-rose-50 ring-1 ring-rose-300 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">🛡️</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-rose-800">Controlled substance selected ({controlled?.label}) — no DEA on your profile</div>
              {providerDea.trim() ? (
                <p className="text-[12px] text-rose-700 mt-0.5">You entered a DEA number below but it isn&apos;t saved to your profile yet. Save it once so every controlled Rx auto-fills.</p>
              ) : (
                <p className="text-[12px] text-rose-700 mt-0.5">Enter your DEA number under <span className="font-medium">Prescriber</span> (right) — it&apos;s required to sign this prescription — then save it to your profile.</p>
              )}
            </div>
            {providerDea.trim() && (
              <button type="button" onClick={saveProfile} className="btn-primary py-1.5 px-3 text-xs shrink-0">
                {savingProfile === "saving" ? "Saving…" : savingProfile === "saved" ? "Saved ✓" : "Save DEA to profile"}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <button type="button" onClick={() => { setMed({ medName: m.name || "", strength: m.strength || "", form: m.form || "", ndc: m.ndc || "", deaSchedule: "" }); if (m.sig) setRx((p) => ({ ...p, sig: m.sig })); }} className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[10px] shrink-0">Prescribe again</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3 className="font-semibold text-slate-900 pt-1">Medication (FDA)</h3>
        <DrugSearch onSelect={(d) => setMed({ medName: d.brandName || d.genericName || "", strength: d.strengths?.[0] || "", form: d.dosageForm || "", ndc: d.productNdc || "", deaSchedule: d.deaSchedule || "" })} />
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

        {controlled && (
          <div className="rounded-lg bg-amber-50 ring-1 ring-amber-300 p-3">
            <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{controlled.schedule}</span>
              Controlled substance — {controlled.label}
            </div>
            <p className="mt-1 text-[11px] text-amber-800">A valid DEA number is required and an extra confirmation must be checked before signing.</p>
            {!providerDea.trim() && <p className="mt-1 text-[11px] font-medium text-rose-700">⚠ No DEA number on file — add it under Prescriber →</p>}
            <label className="mt-2 flex items-start gap-2 text-xs text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={confirmCtrl} onChange={(e) => setConfirmCtrl(e.target.checked)} />
              I confirm this {controlled.label} controlled-substance prescription is clinically appropriate and authorized under my DEA registration.
            </label>
            <p className="mt-1 text-[10px] text-amber-600">Best-effort classification from openFDA — not certified EPCS / DEA e-prescribing.</p>
          </div>
        )}
        {!controlled && ctrlLoading && med.medName && (
          <div className="text-[11px] text-slate-400">Checking controlled-substance status…</div>
        )}

        {med.medName && currentMeds.length > 0 && (
          <div>
            {intxLoading ? (
              <div className="text-[11px] text-slate-400">Checking interactions with current meds…</div>
            ) : interactions && interactions.flagged.length > 0 ? (
              <div className={`rounded-lg p-3 ring-1 ${interactions.maxLevel === "high" ? "bg-rose-50 ring-rose-200" : interactions.maxLevel === "moderate" ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-200"}`}>
                <div className={`text-sm font-semibold ${interactions.maxLevel === "high" ? "text-rose-800" : interactions.maxLevel === "moderate" ? "text-amber-800" : "text-slate-800"}`}>
                  ⚠ Possible interaction{interactions.flagged.length > 1 ? "s" : ""} with current medications
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {interactions.flagged.map((f, i) => {
                    const c = f.level === "high" ? "bg-rose-600" : f.level === "moderate" ? "bg-amber-500" : "bg-slate-400";
                    const lbl = f.level === "high" ? "HIGH" : f.level === "moderate" ? "MODERATE" : "LOW";
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className={`mt-0.5 inline-flex items-center rounded ${c} px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0`}>{lbl}</span>
                        <span><span className="font-medium">{med.medName}</span> ↔ <span className="font-medium">{f.med}</span> <span className="text-slate-400">— {f.basis}</span></span>
                      </li>
                    );
                  })}
                </ul>
                <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-800">
                  <input type="checkbox" checked={ackIntx} onChange={(e) => setAckIntx(e.target.checked)} />
                  I have reviewed these interactions and choose to proceed
                </label>
                <p className="mt-1 text-[10px] text-slate-500">Severity inferred from openFDA label sections (boxed warning / contraindications / warnings) — not a verified interaction engine.</p>
              </div>
            ) : interactions && interactions.hasLabel ? (
              <div className="text-[11px] text-emerald-600">✓ No label interactions found against the patient&apos;s {currentMeds.length} current med(s).</div>
            ) : null}
          </div>
        )}
      </section>

      <section className="card card-pad space-y-3">
        <h3 className="font-semibold text-slate-900">Pharmacy (NPPES / network)</h3>
        <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />

        <h3 className="font-semibold text-slate-900 pt-1">Prescriber</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm"><span className="label">Provider</span><input className="input w-full" value={providerName} disabled /></label>
          <label className="text-sm"><span className="label">Provider NPI</span><input className="input w-full" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)} placeholder="10-digit NPI" /></label>
          <label className="text-sm"><span className="label">DEA number</span><input className="input w-full" value={providerDea} onChange={(e) => setProviderDea(e.target.value)} placeholder="e.g. AB1234563" /></label>
          <div className="flex items-end">
            <button type="button" onClick={saveProfile} className="btn-secondary w-full py-2 text-sm">
              {savingProfile === "saving" ? "Saving…" : savingProfile === "saved" ? "Saved to profile ✓" : savingProfile === "err" ? "Couldn't save" : "Save NPI/DEA to my profile"}
            </button>
          </div>
        </div>
        <SignaturePad onChange={setSig} />

        {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
        <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">{busy ? "Signing…" : "Sign & generate prescription"}</button>
        <p className="text-[10px] text-slate-400">The PDF includes the practice letterhead &amp; NPI, pharmacy details, and your NPI + e-signature. Demo build — not for clinical use.</p>
      </section>
      </div>
      </>
      )}
    </div>
  );
}

const WENO_STATE_STYLES: Record<string, { cls: string; label: string }> = {
  submitted: { cls: "bg-sky-100 text-sky-700", label: "Submitted" },
  accepted: { cls: "bg-indigo-100 text-indigo-700", label: "Accepted" },
  delivered: { cls: "bg-emerald-100 text-emerald-700", label: "Delivered" },
  rejected: { cls: "bg-rose-100 text-rose-700", label: "Rejected" },
  cancelled: { cls: "bg-slate-200 text-slate-600", label: "Cancelled" },
  error: { cls: "bg-amber-100 text-amber-800", label: "Send error" },
};

function WenoStateBadge({ state }: { state?: string | null }) {
  const s = WENO_STATE_STYLES[String(state || "")] || { cls: "bg-slate-100 text-slate-500", label: state || "Sent" };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <span className="text-[8px]">Weno</span>{s.label}
    </span>
  );
}

type PharmHit = { ncpdpId: string; name: string; city?: string | null; state?: string | null; phone?: string | null; isTest?: boolean };

function WenoPharmacyField({ ncpdp, setNcpdp }: { ncpdp: string; setNcpdp: (v: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PharmHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<PharmHit | null>(null);
  const [manual, setManual] = useState(false);
  const [favs, setFavs] = useState<PharmHit[]>([]);

  useEffect(() => {
    fetch("/api/weno/favorites").then((r) => r.json()).then((d) => setFavs((d.favorites || []).map((f: any) => ({ ncpdpId: f.ncpdpId, name: f.name, city: f.city, state: f.state, phone: f.phone })))).catch(() => {});
  }, []);
  const isFav = (id: string) => favs.some((f) => f.ncpdpId === id);
  async function toggleFav(p: PharmHit) {
    if (isFav(p.ncpdpId)) {
      setFavs((cur) => cur.filter((f) => f.ncpdpId !== p.ncpdpId));
      await fetch(`/api/weno/favorites?ncpdpId=${encodeURIComponent(p.ncpdpId)}`, { method: "DELETE" }).catch(() => {});
    } else {
      setFavs((cur) => [{ ncpdpId: p.ncpdpId, name: p.name, city: p.city, state: p.state, phone: p.phone }, ...cur]);
      await fetch("/api/weno/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ncpdpId: p.ncpdpId, name: p.name, city: p.city, state: p.state, phone: p.phone }) }).catch(() => {});
    }
  }

  useEffect(() => {
    if (manual || q.trim().length < 1) { setResults([]); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/weno/pharmacies?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => { if (live) { setResults(d.pharmacies || []); setOpen(true); } })
        .catch(() => { if (live) setResults([]); })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, manual]);

  function pick(p: PharmHit) {
    setChosen(p); setNcpdp(p.ncpdpId); setOpen(false); setQ("");
  }

  if (manual) {
    return (
      <label className="text-sm block mt-2">
        <span className="label flex items-center justify-between">Pharmacy NCPDP ID
          <button type="button" onClick={() => setManual(false)} className="text-[11px] text-brand-600 underline">Search by name</button>
        </span>
        <input className="input w-full" value={ncpdp} onChange={(e) => setNcpdp(e.target.value)} placeholder="e.g. 1234567" />
      </label>
    );
  }

  return (
    <div className="mt-2 relative">
      <span className="label flex items-center justify-between">Pharmacy
        <button type="button" onClick={() => setManual(true)} className="text-[11px] text-brand-600 underline">Enter NCPDP manually</button>
      </span>
      {!chosen && favs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-[11px] text-slate-400 self-center mr-1">★ Favorites:</span>
          {favs.slice(0, 8).map((f) => (
            <button key={f.ncpdpId} type="button" onClick={() => pick(f)} className="chip bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-[11px] hover:bg-amber-100" title={`NCPDP ${f.ncpdpId}${f.city ? ` · ${f.city}, ${f.state || ""}` : ""}`}>{f.name}</button>
          ))}
        </div>
      )}
      {chosen ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <button type="button" onClick={() => toggleFav(chosen)} className={`text-lg leading-none ${isFav(chosen.ncpdpId) ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}`} title={isFav(chosen.ncpdpId) ? "Remove favorite" : "Add to favorites"}>★</button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{chosen.name} {chosen.isTest && <span className="chip bg-amber-100 text-amber-800 text-[9px] ml-1">TEST</span>}</div>
            <div className="text-[11px] text-slate-500 truncate">NCPDP {chosen.ncpdpId}{chosen.city ? ` · ${chosen.city}, ${chosen.state || ""}` : ""}</div>
          </div>
          <button type="button" onClick={() => { setChosen(null); setNcpdp(""); }} className="text-slate-400 text-xs hover:text-slate-700">Change</button>
        </div>
      ) : (
        <>
          <input className="input w-full" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} placeholder="Search pharmacy by name, city, or NCPDP…" />
          {open && (results.length > 0 || loading) && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {loading && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
              {results.map((p) => (
                <div key={p.ncpdpId} className="flex items-center gap-1 border-b border-slate-50 last:border-0 hover:bg-brand-50">
                  <button type="button" onClick={() => pick(p)} className="flex-1 text-left px-3 py-2">
                    <div className="text-sm text-slate-800">{p.name} {p.isTest && <span className="chip bg-amber-100 text-amber-800 text-[9px] ml-1">TEST</span>}</div>
                    <div className="text-[11px] text-slate-500">NCPDP {p.ncpdpId}{p.city ? ` · ${p.city}, ${p.state || ""}` : ""}{p.phone ? ` · ${p.phone}` : ""}</div>
                  </button>
                  <button type="button" onClick={() => toggleFav(p)} className={`px-2 text-lg leading-none ${isFav(p.ncpdpId) ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}`} title={isFav(p.ncpdpId) ? "Remove favorite" : "Add to favorites"}>★</button>
                </div>
              ))}
              {!loading && results.length === 0 && q.trim().length >= 1 && (
                <div className="px-3 py-2 text-xs text-slate-400">No pharmacies found. An admin can sync the Weno directory, or enter an NCPDP ID manually.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
