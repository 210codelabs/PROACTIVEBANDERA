"use client";

import React, { useEffect, useState } from "react";

type CaseRow = { patient: { id: string; firstName: string; lastName: string; mrn: string }; legalCase: any | null };

type PrepLine = { cpt: string; dollars: string };
type PrepState = {
  note: any;
  lc: any | null;
  payerId: string;
  payerName: string;
  lines: PrepLine[];
} | null;

export default function PtClaims() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [casualtyPayers, setCasualtyPayers] = useState<Array<{ id: string; name: string; stediId: string | null }>>([]);
  const [feesMap, setFeesMap] = useState<Record<string, number>>({});
  const [claims, setClaims] = useState<any[]>([]);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const [prep, setPrep] = useState<PrepState>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, n, pay, fee, cl] = await Promise.all([
        fetch(`/api/pt/cases`).then((r) => r.json()),
        fetch(`/api/pt/notes`).then((r) => r.json()),
        fetch(`/api/stedi/payers`).then((r) => r.json()).catch(() => ({ payers: [] })),
        fetch(`/api/pt/fees`).then((r) => r.json()).catch(() => ({ map: {} })),
        fetch(`/api/stedi/claims`).then((r) => r.json()).catch(() => ({ claims: [] })),
      ]);
      setCases(c.cases || []);
      setNotes((n.notes || []).filter((x: any) => x.status === "signed"));
      setCasualtyPayers((pay.payers || []).filter((p: any) => p.casualty).map((p: any) => ({ id: p.id, name: p.name, stediId: p.stediId })));
      setFeesMap(fee.map || {});
      setClaims(cl.claims || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const caseByPatient = new Map(cases.map((c) => [c.patient.id, c]));

  // Latest claim per patient (claims are returned newest-first).
  const latestClaimByPatient = new Map<string, any>();
  for (const cl of claims) {
    if (cl.patientId && !latestClaimByPatient.has(cl.patientId)) latestClaimByPatient.set(cl.patientId, cl);
  }

  async function refreshStatus(claimId: string) {
    setRefreshingId(claimId);
    try {
      const r = await fetch(`/api/stedi/claims/${claimId}/status`);
      const d = await r.json();
      if (d.error) setResult({ ok: false, text: d.error });
      await load();
    } catch (e: any) {
      setResult({ ok: false, text: String(e?.message || e).slice(0, 200) });
    } finally { setRefreshingId(null); }
  }

  const rows = notes.map((n) => {
    const c = caseByPatient.get(n.patientId);
    const lc = c?.legalCase;
    const issues: string[] = [];
    if (!n.authorNpi) issues.push("Missing rendering PT NPI");
    if (!(n.cptCodes || []).length) issues.push("No CPT codes");
    if (!(n.icdCodes || []).length) issues.push("No ICD-10 codes");
    if (!lc?.defendantInsurer) issues.push("No auto/casualty insurer on case");
    return { n, lc, issues };
  });

  function openPrep(n: any, lc: any | null) {
    setResult(null);
    setPrep({
      note: n,
      lc,
      payerId: "",
      payerName: lc?.defendantInsurer || "",
      lines: (n.cptCodes || []).map((cpt: string) => ({ cpt, dollars: feesMap[String(cpt).toUpperCase()] != null ? (feesMap[String(cpt).toUpperCase()] / 100).toFixed(2) : "" })),
    });
  }

  function setLine(idx: number, dollars: string) {
    setPrep((p) => p ? ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, dollars } : l) }) : p);
  }

  async function prepareAndSubmit() {
    if (!prep) return;
    setBusy(true); setResult(null);
    const n = prep.note;
    const serviceLines = prep.lines
      .filter((l) => l.cpt.trim())
      .map((l) => ({
        serviceDate: n.visitDate || new Date().toISOString(),
        procedureCode: l.cpt.trim(),
        chargeCents: Math.round((parseFloat(l.dollars) || 0) * 100),
        units: 1,
        diagnosisCodePointers: ["1"],
      }));
    const diagnoses = (n.icdCodes || []).map((code: string) => ({ qualifier: "ABK", code }));
    try {
      // 1) Create a draft CMS-1500 claim from the signed PI note.
      const createRes = await fetch(`/api/stedi/claims`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: n.patientId,
          patientName: n.patientName,
          payerId: prep.payerId.trim(),
          payerName: prep.payerName.trim(),
          diagnoses,
          serviceLines,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created.claim) {
        setResult({ ok: false, text: created.error || "Could not create the claim draft." });
        setBusy(false); return;
      }
      const claimId = created.claim.id;

      // 2) Submit to the auto / casualty (PIP) payer via Stedi. This is gated by
      //    your Stedi configuration + the specific casualty payer connection.
      const subRes = await fetch(`/api/stedi/claims/${claimId}/submit`, { method: "POST" });
      const sub = await subRes.json();
      if (sub.ok) {
        setResult({ ok: true, text: sub.note || "Submitted to Stedi. Acceptance is not payment — track status & remittances." });
      } else {
        setResult({ ok: false, text: `Draft claim saved. Live submit not completed: ${sub.error || "Stedi/casualty payer connection not confirmed yet."}` });
      }
    } catch (e: any) {
      setResult({ ok: false, text: `Request failed: ${String(e?.message || e).slice(0, 200)}` });
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900">PT Claims — Auto / Personal Injury</h1>
      <p className="text-sm text-slate-500">Signed PI encounters ready to bill to the auto / casualty (PIP / med-pay) payer.</p>

      <div className="mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-800">
        <b>Submission note:</b> Auto/PIP claim submission runs through <b>Stedi</b> as a CMS-1500 professional claim. Your Stedi connection must include the specific casualty/auto payer. If that connection isn&apos;t confirmed yet, the draft claim is still saved and validated so it&apos;s ready to submit the moment the payer is live.
      </div>

      <section className="card mt-4 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Ready-to-bill PI encounters ({rows.length})</header>
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No signed PI encounters yet. Sign a note in <b>PT Encounters</b> to make it billable.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2">Patient</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Auto payer</th>
                  <th className="text-left px-4 py-2">Claim #</th>
                  <th className="text-left px-4 py-2">CPT</th>
                  <th className="text-left px-4 py-2">Rendering PT (NPI)</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Claim status</th>
                  <th className="text-left px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ n, lc, issues }) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{n.patientName}</td>
                    <td className="px-4 py-2 text-slate-600">{(n.visitDate || "").slice(0, 10)}</td>
                    <td className="px-4 py-2 text-slate-600">{lc?.defendantInsurer || <span className="text-rose-500">—</span>}</td>
                    <td className="px-4 py-2 text-slate-600">{lc?.claimNumber || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{(n.cptCodes || []).join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{n.authorName}{n.authorNpi ? ` · ${n.authorNpi}` : ""}</td>
                    <td className="px-4 py-2">
                      {issues.length === 0 ? (
                        <span className="chip bg-emerald-100 text-emerald-700">Ready</span>
                      ) : (
                        <span className="chip bg-amber-100 text-amber-700" title={issues.join(" · ")}>{issues.length} to fix</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {(() => {
                        const claim = latestClaimByPatient.get(n.patientId);
                        if (!claim) return <span className="text-[11px] text-slate-400">Not submitted</span>;
                        return (
                          <div className="flex items-center gap-1.5">
                            <ClaimStatusChip status={claim.status} paidCents={claim.paidCents} />
                            {claim.status !== "draft" && (
                              <button onClick={() => refreshStatus(claim.id)} disabled={refreshingId === claim.id} title="Refresh status from Stedi" className="text-[11px] text-indigo-600 hover:underline disabled:opacity-50">
                                {refreshingId === claim.id ? "…" : "↻"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPrep(n, lc)}
                          disabled={!(n.cptCodes || []).length}
                          className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                        >
                          Prepare &amp; submit
                        </button>
                        <a href={`/api/pt/notes/${n.id}/pdf`} target="_blank" rel="noopener noreferrer" className="rounded-lg ring-1 ring-slate-300 text-slate-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50">PDF</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Prepare CMS-1500 modal */}
      {prep && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => !busy && setPrep(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-t-2xl">
              <div className="font-bold">CMS-1500 · {prep.note.patientName}</div>
              <button onClick={() => !busy && setPrep(null)} className="text-white/80 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {casualtyPayers.length > 0 && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-500">Casualty payer (from your saved Stedi payers)</span>
                  <select
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    value={casualtyPayers.find((cp) => cp.name === prep.payerName && (cp.stediId || "") === prep.payerId)?.id || ""}
                    onChange={(e) => {
                      const cp = casualtyPayers.find((x) => x.id === e.target.value);
                      if (cp) setPrep({ ...prep, payerName: cp.name, payerId: cp.stediId || "" });
                    }}
                  >
                    <option value="">— choose a saved casualty payer —</option>
                    {casualtyPayers.map((cp) => (
                      <option key={cp.id} value={cp.id}>{cp.name}{cp.stediId ? ` (${cp.stediId})` : ""}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-500">Auto / PIP payer name</span>
                  <input value={prep.payerName} onChange={(e) => setPrep({ ...prep, payerName: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-500">Stedi payer ID</span>
                  <input value={prep.payerId} onChange={(e) => setPrep({ ...prep, payerId: e.target.value })} placeholder="Casualty payer ID" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
              </div>
              <div className="text-[11px] text-slate-500">
                No saved casualty payers? <a href="/settings/casualty-payers" className="text-indigo-600 hover:underline font-semibold">Set up auto / PIP payers →</a>
                {" · "}Amounts prefill from your <a href="/settings/pt-fees" className="text-indigo-600 hover:underline font-semibold">PT fee schedule →</a>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Service lines (enter charge per CPT)</div>
                <div className="space-y-1.5">
                  {prep.lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 w-24">{l.cpt}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input type="number" min={0} step="0.01" value={l.dollars} onChange={(e) => setLine(i, e.target.value)} placeholder="0.00" className="w-full rounded-md border border-slate-300 pl-5 pr-2 py-1.5 text-sm" />
                      </div>
                    </div>
                  ))}
                  {prep.lines.length === 0 && <div className="text-xs text-rose-500">This note has no CPT codes.</div>}
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Diagnoses: {(prep.note.icdCodes || []).join(", ") || "none"} · Rendering PT: {prep.note.authorName}{prep.note.authorNpi ? ` (NPI ${prep.note.authorNpi})` : " (no NPI on file)"}
              </div>
              {result && (
                <div className={`text-xs rounded-lg px-3 py-2 ${result.ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>{result.text}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
              <button onClick={() => setPrep(null)} className="btn-secondary">Close</button>
              <button disabled={busy || prep.lines.length === 0} onClick={prepareAndSubmit} className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Submitting…" : "Create & submit via Stedi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ClaimStatusChip({ status, paidCents }: { status?: string; paidCents?: number }) {
  const s = String(status || "draft").toLowerCase();
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    submitted: "bg-sky-100 text-sky-700",
    accepted: "bg-emerald-100 text-emerald-700",
    paid: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-700",
    denied: "bg-rose-100 text-rose-700",
  };
  const label = s === "paid" && paidCents ? `Paid $${(paidCents / 100).toFixed(2)}` : s.charAt(0).toUpperCase() + s.slice(1);
  return <span className={`chip ${map[s] || "bg-slate-100 text-slate-600"}`}>{label}</span>;
}
