"use client";
import { useMemo, useState } from "react";

type Allergy = { id: string; substance: string; reaction?: string | null; severity?: string | null; status?: string | null };
type Enrich = { matched: { rxcui: string; name: string; tty: string } | null; classes: string[] };

function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}
function similarity(a: string, b: string) {
  const max = Math.max(a.length, b.length) || 1;
  return 1 - lev(a, b) / max;
}

type Flag = { kind: "duplicate" | "lookalike"; a: string; b: string; score: number };

// Standardize documented allergies against public references (RxNorm) and flag
// possible duplicate or look-alike/sound-alike (LASA) entries. Heuristic + informational.
export default function AllergyNormalize({ allergies }: { allergies: Allergy[] }) {
  const active = allergies.filter((a) => (a.status || "active") === "active");
  const [data, setData] = useState<Record<string, Enrich | "loading" | "error">>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const flags = useMemo<Flag[]>(() => {
    const out: Flag[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = norm(active[i].substance), b = norm(active[j].substance);
        if (!a || !b) continue;
        if (a === b) { out.push({ kind: "duplicate", a: active[i].substance, b: active[j].substance, score: 1 }); continue; }
        const sim = similarity(a, b);
        if (sim >= 0.8 && a.slice(0, 3) === b.slice(0, 3)) out.push({ kind: "lookalike", a: active[i].substance, b: active[j].substance, score: sim });
      }
    }
    return out;
  }, [active]);

  async function standardize(a: Allergy) {
    if (openId === a.id) { setOpenId(null); return; }
    setOpenId(a.id);
    if (data[a.id] && data[a.id] !== "error") return;
    setData((d) => ({ ...d, [a.id]: "loading" }));
    try {
      const r = await fetch(`/api/enrichment/rxnorm?q=${encodeURIComponent(a.substance)}`);
      const j = await r.json();
      setData((d) => ({ ...d, [a.id]: { matched: j.matched, classes: j.classes || [] } }));
    } catch {
      setData((d) => ({ ...d, [a.id]: "error" }));
    }
  }

  return (
    <section className="card mt-4">
      <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="font-semibold">Allergy data quality</span>
        <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 text-[10px]">RxNorm</span>
        <span className="text-xs text-slate-500">Standardize substances &amp; catch duplicate / look-alike entries.</span>
      </header>
      <div className="p-4 space-y-3 text-sm">
        {flags.length > 0 ? (
          <div className="rounded-lg bg-amber-50 ring-1 ring-amber-300 p-3">
            <div className="font-semibold text-amber-800 text-[13px]">{flags.length} possible data-quality issue{flags.length > 1 ? "s" : ""}</div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-amber-900">
              {flags.map((f, i) => (
                <li key={i}>
                  <span className={`chip text-[10px] mr-1 ${f.kind === "duplicate" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-amber-200 text-amber-900 ring-amber-300"}`}>{f.kind === "duplicate" ? "Possible duplicate" : "Look-alike"}</span>
                  <span className="font-medium">{f.a}</span> &harr; <span className="font-medium">{f.b}</span>
                  {f.kind === "lookalike" && <span className="text-amber-600"> ({Math.round(f.score * 100)}% similar)</span>}
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-amber-600 mt-1">Informational heuristic — review and merge/correct entries as appropriate.</div>
          </div>
        ) : (
          active.length > 1 && <div className="text-[12px] text-emerald-700">No duplicate or look-alike allergy entries detected.</div>
        )}

        {active.length === 0 && <div className="text-slate-500 italic">No active allergies to standardize.</div>}
        {active.map((a) => {
          const d = data[a.id];
          const isOpen = openId === a.id;
          return (
            <div key={a.id} className="rounded-lg ring-1 ring-slate-200">
              <button type="button" onClick={() => standardize(a)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                <span className="flex-1 truncate">{a.substance}{a.reaction ? ` — ${a.reaction}` : ""}</span>
                <span className="text-xs text-brand-600">{isOpen ? "Hide" : "Standardize"}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2 border-t border-slate-100 pt-2">
                  {d === "loading" && <div className="text-[12px] text-slate-400">Checking public references…</div>}
                  {d === "error" && <div className="text-[12px] text-rose-500">Lookup failed.</div>}
                  {d && d !== "loading" && d !== "error" && (
                    d.matched ? (
                      <div className="space-y-1">
                        <div className="text-[12px] text-slate-700"><span className="chip bg-slate-100 text-slate-700 ring-slate-200 text-[10px] mr-1">RxNorm</span>{d.matched.name} <span className="text-slate-400">· RxCUI {d.matched.rxcui}</span></div>
                        {d.classes.length > 0 && <div className="flex flex-wrap gap-1">{d.classes.map((c) => <span key={c} className="chip bg-brand-50 text-brand-800 ring-brand-200 text-[10px]">{c}</span>)}</div>}
                        <div className="text-[10px] text-slate-400">Matched as a drug substance — consider recording the standardized name.</div>
                      </div>
                    ) : (
                      <div className="text-[12px] text-slate-500">No RxNorm drug match — likely a food or environmental allergen (e.g., peanuts, latex, bee sting). No standardization needed.</div>
                    )
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
