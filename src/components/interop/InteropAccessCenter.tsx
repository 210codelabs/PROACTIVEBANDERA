"use client";
import { useState } from "react";
import type { InteropSource } from "@/lib/interop/registry";

function StatusChip({ s }: { s: InteropSource }) {
  if (s.active) return <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">{s.statusLabel}</span>;
  if (s.tier === "patient-authorized") return <span className="chip bg-blue-100 text-blue-800 ring-blue-200">{s.statusLabel}</span>;
  return <span className="chip bg-slate-200 text-slate-600 ring-slate-300">{s.statusLabel}</span>;
}

function SourceCard({ s }: { s: InteropSource }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg ring-1 p-3 ${s.active ? "bg-white ring-slate-200" : "bg-slate-50 ring-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{s.name}</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{s.category}</div>
        </div>
        <StatusChip s={s} />
      </div>
      <p className="text-[13px] text-slate-700 mt-2">{s.provides}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className={`chip ${s.patientLevel ? "bg-violet-100 text-violet-800 ring-violet-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
          {s.patientLevel ? "Patient-level data" : "Reference data"}
        </span>
        <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{s.authModel}</span>
      </div>
      {s.note && <p className="text-[11px] text-amber-700 mt-2">{s.note}</p>}
      {(s.onboarding.length > 0 || s.credentials.length > 0) && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-brand-700 underline mt-2">
          {open ? "Hide onboarding steps" : "How to connect"}
        </button>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          {s.onboarding.length > 0 && (
            <ol className="list-decimal list-inside text-[12px] text-slate-700 space-y-0.5">
              {s.onboarding.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          )}
          {s.credentials.length > 0 && (
            <div className="text-[11px] text-slate-500">
              <span className="font-semibold">Credentials needed: </span>
              <span className="font-mono">{s.credentials.join(", ")}</span>
            </div>
          )}
          <a href={s.docsUrl} target="_blank" rel="noreferrer" className="inline-block text-[12px] text-brand-700 underline">Official docs →</a>
        </div>
      )}
    </div>
  );
}

export default function InteropAccessCenter({ sources }: { sources: InteropSource[] }) {
  const groups: { title: string; blurb: string; items: InteropSource[] }[] = [
    { title: "Active · public & verified sources", blurb: "Wired and usable now. Reference / normalization data only — not a patient's private history.", items: sources.filter((s) => s.tier === "public") },
    { title: "Patient-authorized", blurb: "Real patient data, but the patient must authorize each connection.", items: sources.filter((s) => s.tier === "patient-authorized") },
    { title: "Gated networks · require onboarding", blurb: "Deliver a patient's real medication / controlled-substance / longitudinal history. These are not public APIs — they need vendor agreements, credentials and certification before they can be switched on.", items: sources.filter((s) => s.tier === "gated") },
  ];
  return (
    <div className="space-y-6">
      <div className="card card-pad bg-brand-50 ring-1 ring-brand-100 text-sm text-brand-900">
        This center shows every external clinical data source and its real connection status. Public references are active now.
        PDMP (Texas), Weno RxHistory and the HIEs are <span className="font-semibold">gated networks</span>: they can be wired here, but only
        return real patient data after your organization completes the listed onboarding and provides credentials. No portal logins are ever used.
      </div>
      {groups.map((g) => (
        <section key={g.title} className="card">
          <header className="px-4 py-3 border-b border-slate-200">
            <div className="font-semibold text-slate-900">{g.title}</div>
            <div className="text-xs text-slate-500">{g.blurb}</div>
          </header>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {g.items.map((s) => <SourceCard key={s.key} s={s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
