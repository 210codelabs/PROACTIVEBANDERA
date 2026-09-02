"use client";

import React, { useEffect, useState } from "react";

type CaseRow = { patient: { id: string; firstName: string; lastName: string; mrn: string }; legalCase: any | null };

export default function PtClaims() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, n] = await Promise.all([
          fetch(`/api/pt/cases`).then((r) => r.json()),
          fetch(`/api/pt/notes`).then((r) => r.json()),
        ]);
        setCases(c.cases || []);
        setNotes((n.notes || []).filter((x: any) => x.status === "signed"));
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const caseByPatient = new Map(cases.map((c) => [c.patient.id, c]));

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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900">PT Claims — Auto / Personal Injury</h1>
      <p className="text-sm text-slate-500">Signed PI encounters ready to bill to the auto / casualty (PIP / med-pay) payer.</p>

      <div className="mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-800">
        <b>Submission note:</b> Auto/PIP claim submission runs through <b>Stedi</b>. Your Stedi connection must include the specific casualty/auto payer, and production payer connectivity is still being finalized — so submission may not be live end-to-end yet. This worklist validates each claim so it is ready the moment the payer connection is confirmed.
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
