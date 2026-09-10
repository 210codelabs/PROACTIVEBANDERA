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
  const [provName, setProvName] = useState(providerName);
  const [npiValid, setNpiValid] = useState<null | boolean>(null);
  const [npiChecking, setNpiChecking] = useState(false);
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
  const [weno, setWeno] = useState<{ enabled: boolean; configured: boolean; environment: string; epcs: boolean; online?: { enabled: boolean; configured: boolean; keySet: boolean; environment: string; prescriber?: { npi: string; dea: string; firstName: string; lastName: string; name: string } } } | null>(null);

  useEffect(() => {
    fetch("/api/erx/weno-status")
      .then((r) => r.json())
      .then((d) => {
        setWeno(d);
        // Pre-fill the prescriber NPI/DEA registered with Weno when the logged-in
        // provider has none on their own profile (functional updates so we never
        // overwrite a value the provider already has).
        const pres = d?.online?.prescriber;
        if (pres) {
          if (pres.npi) setProviderNpi((cur) => cur || pres.npi);
          if (pres.dea) { setProviderDea((cur) => cur || pres.dea); }
        }
      })
      .catch(() => setWeno(null));
  }, []);

  // Prescriber NPI lookup (NPPES) + clinician-facing Weno connection test.
  const [npiQ, setNpiQ] = useState({ first: "", last: "" });
  const [npiResults, setNpiResults] = useState<any[]>([]);
  const [npiBusy, setNpiBusy] = useState(false);
  const [npiOpen, setNpiOpen] = useState(false);
  const [wenoTest, setWenoTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [wenoTestBusy, setWenoTestBusy] = useState(false);

  // Weno-registered prescriber directory: pick the right prescriber per login.
  const [wenoPrescribers, setWenoPrescribers] = useState<any[]>([]);
  const [selectedPrescriberId, setSelectedPrescriberId] = useState<string>("");
  useEffect(() => {
    fetch("/api/erx/prescribers")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.prescribers) ? d.prescribers : [];
        setWenoPrescribers(list);
        if (d.suggestedId) {
          const sel = list.find((p: any) => p.id === d.suggestedId);
          if (sel) {
            setSelectedPrescriberId(sel.id);
            if (sel.npi) setProviderNpi((cur) => cur || sel.npi);
            if (sel.dea) setProviderDea((cur) => cur || sel.dea);
          }
        }
      })
      .catch(() => {});
  }, []);
  function selectPrescriber(id: string) {
    setSelectedPrescriberId(id);
    const p = wenoPrescribers.find((x) => x.id === id);
    if (p) { setProviderNpi(p.npi || ""); setProviderDea(p.dea || ""); if (p.name) setProvName(p.name); }
  }

  // Self-verify the entered Provider NPI against the national registry (NPPES).
  // Shows a green "NPI Valid" when the number is found, red "Not Valid" otherwise.
  useEffect(() => {
    const digits = (providerNpi || "").replace(/\D/g, "");
    if (digits.length !== 10) { setNpiValid(null); setNpiChecking(false); return; }
    setNpiChecking(true); setNpiValid(null);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/nppes/search?npi=${digits}`);
        const d = await r.json();
        const results = Array.isArray(d.results) ? d.results : [];
        const found = results.length > 0;
        setNpiValid(found);
        if (found && results[0]?.name) setProvName((cur) => cur && cur.trim() ? cur : results[0].name);
      } catch { setNpiValid(null); } finally { setNpiChecking(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [providerNpi]);

  async function searchNpi() {
    if (!npiQ.first.trim() && !npiQ.last.trim()) return;
    setNpiBusy(true); setNpiResults([]); setNpiOpen(true);
    try {
      const p = new URLSearchParams({ type: "NPI-1" });
      if (npiQ.first.trim()) p.set("first_name", npiQ.first.trim());
      if (npiQ.last.trim()) p.set("last_name", npiQ.last.trim());
      const r = await fetch(`/api/nppes/search?${p.toString()}`);
      const d = await r.json();
      setNpiResults(Array.isArray(d.results) ? d.results : []);
    } catch { setNpiResults([]); } finally { setNpiBusy(false); }
  }

  async function testWeno() {
    setWenoTestBusy(true); setWenoTest(null);
    try {
      const r = await fetch("/api/erx/weno-test");
      const d = await r.json();
      const parts: string[] = [];
      if (d.online) parts.push(`Weno EZ Integration — ${d.online.message}`);
      setWenoTest({ ok: Boolean(d.ok), text: parts.join("  ·  ") || "No response." });
    } catch { setWenoTest({ ok: false, text: "Test request failed." }); } finally { setWenoTestBusy(false); }
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
    if (npiValid !== true) { setErr("Provider NPI must be verified against NPPES (\u201cNPI Valid\u201d) before signing."); return; }
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
        providerName: provName, providerNpi: providerNpi || null, providerDea: providerDea || null,
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
      <div className="card card-pad max-w-lg mx-auto">
        <div className="text-center">
          <div className="text-3xl">✅</div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Prescription signed</h2>
          <p className="text-sm text-slate-500 mt-1">The eRx has been recorded and e-signed.</p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-left">
          <h3 className="font-semibold text-slate-900 text-sm">Send electronically (Weno EZ Integration)</h3>
          <p className="mt-2 text-[12px] text-slate-500">
            To transmit this prescription electronically, open <span className="font-medium">e-Prescribe (Weno)</span> from the patient chart to launch the Weno EZ Integration ComposeRx screen, or print the prescription below.
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <a href={`/api/erx/${savedId}/pdf`} target="_blank" rel="noopener" className="btn-secondary">Print / Download PDF</a>
          <button onClick={() => { setSavedId(null); setMed({ medName: "", strength: "", form: "", ndc: "", deaSchedule: "" }); setRx({ sig: "", quantity: "", refills: "0", daw: false, notes: "" }); setSig(null); setPatient(null); setPatQ(""); setPharmacy(null); }} className="btn-primary">New prescription</button>
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
                    {(h.transmissionMethod === "weno" || h.transmissionMethod === "weno-online") && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <WenoStateBadge state={h.wenoState} method={h.transmissionMethod} />
                        {h.pharmacyNcpdp && <span className="text-[10px] text-slate-400">NCPDP {h.pharmacyNcpdp}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`/api/erx/${h.id}/pdf`} target="_blank" rel="noopener" className="chip bg-white ring-slate-200 text-xs hover:bg-slate-50">Reprint</a>
                    <button onClick={() => rePrescribe(h)} className="chip bg-brand-100 text-brand-800 ring-brand-200 text-xs">Re-prescribe</button>
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
        <h3 className="font-semibold text-slate-900">Pharmacy (Weno directory)</h3>
        <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />

        <h3 className="font-semibold text-slate-900 pt-1">Prescriber</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm"><span className="label">Provider</span><input className="input w-full" value={provName} onChange={(e) => setProvName(e.target.value)} placeholder="Provider name" /></label>
          <label className="text-sm"><span className="label">Provider NPI</span><input className="input w-full" value={providerNpi} onChange={(e) => setProviderNpi(e.target.value)} placeholder="10-digit NPI" />
            {npiChecking ? (
              <span className="mt-0.5 block text-[11px] text-slate-400">Checking NPPES…</span>
            ) : npiValid === true ? (
              <span className="mt-0.5 block text-[11px] font-semibold text-emerald-600">NPI Valid</span>
            ) : npiValid === false ? (
              <span className="mt-0.5 block text-[11px] font-semibold text-rose-600">Not Valid</span>
            ) : null}
          </label>
          <label className="text-sm"><span className="label">DEA number</span><input className="input w-full" value={providerDea} onChange={(e) => setProviderDea(e.target.value)} placeholder="e.g. AB1234563" /></label>
          <div className="flex items-end">
            <button type="button" onClick={saveProfile} className="btn-secondary w-full py-2 text-sm">
              {savingProfile === "saving" ? "Saving…" : savingProfile === "saved" ? "Saved to profile ✓" : savingProfile === "err" ? "Couldn't save" : "Save NPI/DEA to my profile"}
            </button>
          </div>
        </div>

        {/* Find & fill the prescriber NPI from the national registry (NPPES) */}
        <div className="rounded-lg ring-1 ring-slate-200 bg-slate-50 p-2.5">
          {wenoPrescribers.length > 0 && (
            <div className="mb-2.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prescribe as (Weno-registered)</label>
              <select className="input mt-1 w-full" value={selectedPrescriberId} onChange={(e) => selectPrescriber(e.target.value)}>
                <option value="">— Select prescriber —</option>
                {wenoPrescribers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · NPI {p.npi}{p.isDefault ? " (default)" : ""}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Find prescriber NPI (NPPES)</span>
            {weno?.online?.prescriber?.npi && <span className="text-[10px] text-slate-400">Weno-registered NPI: <span className="font-mono">{weno.online.prescriber.npi}</span></span>}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input className="input flex-1" placeholder="First name" value={npiQ.first} onChange={(e) => setNpiQ((s) => ({ ...s, first: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchNpi(); } }} />
            <input className="input flex-1" placeholder="Last name" value={npiQ.last} onChange={(e) => setNpiQ((s) => ({ ...s, last: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchNpi(); } }} />
            <button type="button" onClick={searchNpi} disabled={npiBusy} className="chip bg-brand-600 text-white text-xs shrink-0 disabled:opacity-60">{npiBusy ? "…" : "Find NPI"}</button>
          </div>
          {npiOpen && npiResults.length > 0 && (
            <ul className="mt-1.5 max-h-40 overflow-auto divide-y divide-slate-100 rounded-md bg-white ring-1 ring-slate-200">
              {npiResults.map((n) => (
                <li key={n.npi}>
                  <button type="button" onClick={() => { setProviderNpi(n.npi); if (n.name) setProvName(n.name); setNpiOpen(false); }} className="w-full text-left px-2.5 py-1.5 hover:bg-brand-50 text-xs">
                    <span className="font-medium text-slate-900">{n.name}</span>{n.credential ? `, ${n.credential}` : ""} <span className="font-mono text-slate-500">{n.npi}</span>
                    <span className="text-slate-400">{n.primaryTaxonomy?.desc ? ` · ${n.primaryTaxonomy.desc}` : ""}{n.practice?.state ? ` · ${n.practice.state}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {npiOpen && !npiBusy && npiResults.length === 0 && <div className="mt-1 text-[11px] text-slate-400">No NPI matches — try a different name.</div>}
        </div>

        {/* Clinician-facing Weno connection test */}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={testWeno} disabled={wenoTestBusy} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-60">{wenoTestBusy ? "Testing…" : "Test Weno connection"}</button>
          {wenoTest && <span className={`text-[11px] ${wenoTest.ok ? "text-emerald-700" : "text-rose-600"}`}>{wenoTest.text}</span>}
        </div>

        <SignaturePad onChange={setSig} />

        {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
        <button onClick={submit} disabled={busy || npiValid !== true} className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed">{busy ? "Signing…" : "Sign & generate prescription"}</button>
        {npiValid !== true && (
          <p className="text-[11px] font-medium text-rose-600">Enter a valid Provider NPI (verified as “NPI Valid” against NPPES) to enable signing.</p>
        )}
        <p className="text-[10px] text-slate-400">The PDF includes the practice letterhead &amp; NPI, pharmacy details, and your NPI + e-signature. Demo build — not for clinical use.</p>
      </section>
      </div>
      </>
      )}
    </div>
  );
}

const WENO_STATE_STYLES: Record<string, { cls: string; label: string }> = {
  launched: { cls: "bg-violet-100 text-violet-700", label: "Composing" },
  submitted: { cls: "bg-sky-100 text-sky-700", label: "Submitted" },
  accepted: { cls: "bg-indigo-100 text-indigo-700", label: "Accepted" },
  delivered: { cls: "bg-emerald-100 text-emerald-700", label: "Delivered" },
  rejected: { cls: "bg-rose-100 text-rose-700", label: "Rejected" },
  cancelled: { cls: "bg-slate-200 text-slate-600", label: "Cancelled" },
  error: { cls: "bg-amber-100 text-amber-800", label: "Send error" },
};

function WenoStateBadge({ state }: { state?: string | null; method?: string | null }) {
  const s = WENO_STATE_STYLES[String(state || "")] || { cls: "bg-slate-100 text-slate-500", label: state || "Sent" };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <span className="text-[8px]">Weno EZ</span>{s.label}
    </span>
  );
}
