"use client";
import { useEffect, useState } from "react";

type Coverage = { type: string; status: string; period: string; payor: string };
type Claim = { id: string; type: string; date: string; provider: string; total: number | null; drug?: string | null; ndc?: string | null };
type LastImport = { coverage: Coverage[] | null; claims: Claim[] | null; claimCount: number; createdAt: string; env: string | null } | null;

export default function BlueButtonConnect({
  patientId,
  configured,
  env,
  lastImport,
}: {
  patientId: string;
  configured: boolean;
  env: string;
  lastImport: LastImport;
}) {
  const [flash, setFlash] = useState<{ kind: "ok" | "error" | "notconfigured"; msg?: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [addedMeds, setAddedMeds] = useState<Set<string>>(new Set());
  const [medBusy, setMedBusy] = useState("");

  async function addMed(drug: string, ndc?: string | null) {
    setMedBusy(drug);
    try {
      const r = await fetch(`/api/patients/${patientId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: drug, ndc: ndc || null, notes: "From Medicare Part D claim (Blue Button)" }),
      });
      if (r.ok) setAddedMeds((prev) => new Set(prev).add(drug));
    } finally {
      setMedBusy("");
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const bb = sp.get("bb");
    if (bb === "ok") setFlash({ kind: "ok" });
    else if (bb === "notconfigured") setFlash({ kind: "notconfigured" });
    else if (bb === "error") setFlash({ kind: "error", msg: sp.get("msg") || "" });
    if (bb) {
      sp.delete("bb"); sp.delete("msg");
      const qs = sp.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const coverage = lastImport?.coverage || [];
  const claims = lastImport?.claims || [];
  const partDMeds = claims.filter((c) => c.drug);

  return (
    <section className="card mt-3">
      <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="font-semibold">Medicare claims &amp; coverage</span>
        <span className="chip bg-blue-100 text-blue-800 ring-blue-200 text-[10px]">CMS Blue Button 2.0</span>
        <span className={`chip text-[10px] ${env === "production" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{env === "production" ? "Production" : "Sandbox"}</span>
        <a href={`/api/cms/authorize?patientId=${encodeURIComponent(patientId)}`} className={`ml-auto btn-primary py-1.5 ${configured ? "" : "opacity-50 pointer-events-none"}`}>
          {lastImport ? "Reconnect &amp; refresh" : "Connect Medicare (Blue Button)"}
        </a>
      </header>
      <div className="p-4 space-y-3 text-sm">
        {!configured && <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 text-slate-600 text-[13px]">Not configured — add CMS_CLIENT_ID / CMS_CLIENT_SECRET on the server to enable.</div>}
        {flash?.kind === "ok" && <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-2 text-emerald-800 text-[13px]">Connected — Medicare data imported.</div>}
        {flash?.kind === "error" && <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-2 text-rose-800 text-[13px]">Connection failed{flash.msg ? `: ${flash.msg}` : ""}.</div>}
        {flash?.kind === "notconfigured" && <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2 text-amber-800 text-[13px]">Blue Button is not configured on the server yet.</div>}

        <p className="text-[11px] text-slate-500">
          Patient-authorized import of the beneficiary&apos;s Medicare claims &amp; coverage (FHIR R4). The patient must sign in to Medicare.gov and consent — this is not a background lookup, and it applies to Medicare beneficiaries only.
        </p>

        {!lastImport && configured && <div className="text-slate-500 italic">No Medicare data imported yet. Click Connect to have the patient authorize.</div>}

        {lastImport && (
          <>
            <div className="text-[11px] text-slate-400">Last import: {new Date(lastImport.createdAt).toLocaleString()} · {lastImport.env || env}</div>
            {partDMeds.length > 0 && (
              <div className="rounded-lg bg-teal-50 ring-1 ring-teal-200 p-3">
                <div className="font-medium text-teal-900 mb-1">Suggested medications (from Part D pharmacy claims)</div>
                <p className="text-[11px] text-teal-700 mb-2">Reconcile with the patient before adding to the chart — a fill claim isn&apos;t confirmation the patient is still taking it.</p>
                <ul className="space-y-1.5">
                  {partDMeds.map((c, i) => {
                    const done = addedMeds.has(c.drug!);
                    return (
                      <li key={c.id || i} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate text-slate-800">💊 {c.drug}{c.ndc ? <span className="text-slate-400 font-mono text-[11px]"> · NDC {c.ndc}</span> : null}{c.date ? <span className="text-slate-400"> · {String(c.date).slice(0, 10)}</span> : null}</span>
                        {done ? (
                          <span className="text-emerald-600 font-semibold text-xs shrink-0">Added ✓</span>
                        ) : (
                          <button type="button" onClick={() => addMed(c.drug!, c.ndc)} disabled={medBusy === c.drug} className="shrink-0 rounded bg-teal-600 px-2 py-0.5 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">{medBusy === c.drug ? "…" : "Add to chart"}</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {coverage.length > 0 && (
              <div>
                <div className="font-medium text-slate-800 mb-1">Coverage</div>
                <ul className="space-y-1">
                  {coverage.map((c, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2 text-[13px] text-slate-700">
                      <span className="font-medium">{c.type}</span>
                      {c.status && <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[10px]">{c.status}</span>}
                      {c.payor && <span className="text-slate-500">{c.payor}</span>}
                      {c.period && <span className="text-slate-400">{c.period}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="font-medium text-slate-800 mb-1">Claims ({lastImport.claimCount})</div>
              {claims.length === 0 ? (
                <div className="text-slate-500 italic text-[13px]">No claims returned.</div>
              ) : (
                <ul className="space-y-1">
                  {(showAll ? claims : claims.slice(0, 8)).map((c, i) => (
                    <li key={c.id || i} className="flex flex-wrap gap-x-2 text-[13px] text-slate-700">
                      <span className="font-medium">{c.type}</span>
                      {c.date && <span className="text-slate-400">{String(c.date).slice(0, 10)}</span>}
                      {c.provider && <span className="text-slate-500 truncate max-w-[220px]">{c.provider}</span>}
                      {typeof c.total === "number" && <span className="text-slate-500">${c.total.toFixed(2)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {claims.length > 8 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] text-brand-700 underline mt-1">{showAll ? "Show less" : `Show all ${claims.length}`}</button>
              )}
            </div>
            <div className="text-[10px] text-slate-400">Source: CMS Blue Button 2.0 (patient-authorized). Claims/coverage only — reconcile clinically; not a substitute for a medication or allergy list.</div>
          </>
        )}
      </div>
    </section>
  );
}
