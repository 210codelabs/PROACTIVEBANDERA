"use client";
import { useState } from "react";
import Link from "next/link";
import DrugReference from "@/components/drugs/DrugReference";
import RecallAlert from "@/components/drugs/RecallAlert";

type Med = { id: string; name: string; strength?: string | null; form?: string | null; status?: string | null; ndc?: string | null };
type Enrich = {
  matched: { rxcui: string; name: string; tty: string } | null;
  classes: string[];
  education: { title: string; url: string }[];
};

// Public reference enrichment panel for a patient's medication list.
// Uses only public/verified sources (openFDA, RxNorm/RxNav, MedlinePlus). It does
// NOT return the patient's real fill/allergy history — that requires PDMP / HIE /
// Surescripts onboarding (see the Interoperability Access Center).
export default function MedEnrichment({ meds }: { meds: Med[] }) {
  const active = meds.filter((m) => (m.status || "active") === "active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, Enrich | "loading" | "error">>({});

  async function toggle(m: Med) {
    if (openId === m.id) { setOpenId(null); return; }
    setOpenId(m.id);
    if (data[m.id] && data[m.id] !== "error") return;
    setData((d) => ({ ...d, [m.id]: "loading" }));
    try {
      const q = `${m.name}${m.strength ? ` ${m.strength}` : ""}`.trim();
      const r = await fetch(`/api/enrichment/rxnorm?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setData((d) => ({ ...d, [m.id]: { matched: j.matched, classes: j.classes || [], education: j.education || [] } }));
    } catch {
      setData((d) => ({ ...d, [m.id]: "error" }));
    }
  }

  return (
    <section className="card mt-3">
      <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="font-semibold">Public data enrichment</span>
        <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 text-[10px]">openFDA</span>
        <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 text-[10px]">RxNorm</span>
        <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 text-[10px]">MedlinePlus</span>
        <Link href="/settings/interoperability" className="ml-auto text-xs font-semibold text-brand-700 underline">Connected networks &amp; capacity →</Link>
      </header>
      <div className="p-4 space-y-2 text-sm">
        <p className="text-[11px] text-slate-500">
          Normalizes each medication against official public references (RxNorm code &amp; class, FDA labeling / recalls, MedlinePlus patient education).
          This is reference data only — a patient&apos;s real fill history &amp; allergies require PDMP, HIE or Surescripts onboarding.
        </p>
        {active.length === 0 && <div className="text-slate-500 italic">No active medications to enrich.</div>}
        {active.map((m) => {
          const d = data[m.id];
          const isOpen = openId === m.id;
          return (
            <div key={m.id} className="rounded-lg ring-1 ring-slate-200">
              <button type="button" onClick={() => toggle(m)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                <span className="flex-1 truncate">{m.name}{m.strength ? ` ${m.strength}` : ""}{m.form ? ` ${m.form}` : ""}</span>
                {m.ndc && <span className="text-[10px] text-slate-400 font-mono">NDC {m.ndc}</span>}
                <span className="text-xs text-brand-600">{isOpen ? "Hide" : "Enrich"}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
                  {d === "loading" && <div className="text-[12px] text-slate-400 pt-2">Looking up public references…</div>}
                  {d === "error" && <div className="text-[12px] text-rose-500 pt-2">Lookup failed. Try again.</div>}
                  {d && d !== "loading" && d !== "error" && (
                    <div className="pt-2 space-y-2">
                      {d.matched ? (
                        <div className="text-[12px] text-slate-700">
                          <span className="chip bg-slate-100 text-slate-700 ring-slate-200 text-[10px] mr-1">RxNorm</span>
                          <span className="font-medium">{d.matched.name}</span>
                          <span className="text-slate-400"> · RxCUI {d.matched.rxcui}{d.matched.tty ? ` · ${d.matched.tty}` : ""}</span>
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-400">No RxNorm match found.</div>
                      )}
                      {d.classes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.classes.map((c) => <span key={c} className="chip bg-brand-50 text-brand-800 ring-brand-200 text-[10px]">{c}</span>)}
                        </div>
                      )}
                      {d.education.length > 0 && (
                        <div className="text-[12px]">
                          <span className="text-slate-500">Patient education (MedlinePlus): </span>
                          {d.education.map((e, i) => (
                            <a key={i} href={e.url} target="_blank" rel="noreferrer" className="text-brand-700 underline mr-2">{e.title}</a>
                          ))}
                        </div>
                      )}
                      {m.ndc && <RecallAlert ndc={m.ndc} />}
                      <DrugReference productNdc={m.ndc || undefined} name={m.name} title="Official FDA labeling (reference)" />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
