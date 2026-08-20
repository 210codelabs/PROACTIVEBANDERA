import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { labelLookup } from "@/lib/openfda";

export const runtime = "nodejs";

// Words to ignore when reducing a medication name to its "core" drug terms.
const STOP = new Set([
  "tablet", "tablets", "capsule", "capsules", "caplet", "oral", "injection", "injectable",
  "solution", "suspension", "cream", "ointment", "gel", "patch", "spray", "inhaler", "drops",
  "extended", "release", "delayed", "film", "coated", "chewable", "sublingual", "topical",
  "units", "unit", "each", "with", "and", "the", "for", "hydrochloride", "sulfate", "sodium",
  "calcium", "potassium", "hcl",
]);

function coreTerms(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

function mentions(text: string, term: string): boolean {
  try {
    return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  } catch {
    return text.toLowerCase().includes(term);
  }
}

// Severity keywords used to grade a label-text interaction reference.
const HIGH_WORDS = [
  "contraindicated", "contraindication", "avoid", "should not be", "do not use",
  "not recommended", "fatal", "life-threatening", "life threatening", "death",
  "serious", "severe", "dangerous",
];
const MOD_WORDS = [
  "monitor", "caution", "may increase", "may decrease", "increased risk",
  "reduce dose", "dose reduction", "dosage adjustment", "adjust", "concomitant",
  "closely", "consider", "potentiate",
];

// Grade the severity of an interaction between the candidate drug and `term`
// using where/how the term appears in the openFDA structured product label.
// Levels: high | moderate | low. This is a transparent label-text heuristic,
// NOT a certified drug-interaction severity classification.
function gradeSeverity(term: string, label: any): { level: "high" | "moderate" | "low"; basis: string } {
  if (mentions(label?.boxedWarning || "", term)) return { level: "high", basis: "Boxed warning" };
  if (mentions(label?.contraindications || "", term)) return { level: "high", basis: "Contraindicated on label" };
  const blob = [label?.drugInteractions, label?.warnings].filter(Boolean).join(" \n ");
  const sentences = blob.split(/(?<=[.;\n])/).filter((s: string) => mentions(s, term));
  const near = sentences.join(" ").toLowerCase();
  if (HIGH_WORDS.some((w) => near.includes(w))) return { level: "high", basis: "Avoid / serious risk noted" };
  if (MOD_WORDS.some((w) => near.includes(w))) return { level: "moderate", basis: "Use with caution / monitor" };
  if (mentions(label?.warnings || "", term)) return { level: "moderate", basis: "Warnings section" };
  return { level: "low", basis: "Label mention" };
}

const RANK: Record<string, number> = { high: 3, moderate: 2, low: 1 };

// POST /api/drugs/interactions { ndc?, name?, meds: string[] }
// Informational heuristic: fetch the candidate drug's openFDA SPL drug-interactions
// section and flag any of the patient's current medications whose core drug term is
// mentioned in it. NOT a verified interaction engine.
export async function POST(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const b = await req.json().catch(() => null);
  const ndc = (b?.ndc ?? "").toString().trim();
  const name = (b?.name ?? "").toString().trim();
  const meds: string[] = Array.isArray(b?.meds) ? b.meds.map((m: any) => String(m || "").trim()).filter(Boolean) : [];
  if (!ndc && !name) return NextResponse.json({ error: "Provide ndc or name" }, { status: 400 });

  const label = await labelLookup({ productNdc: ndc || undefined, name: name || undefined });
  const interactionsText = label?.drugInteractions || "";

  const flagged: { med: string; matchedTerm: string; level: "high" | "moderate" | "low"; basis: string }[] = [];
  if (label) {
    for (const med of meds) {
      // A term counts if it appears in the interactions section OR in any of the
      // higher-severity sections (boxed warning / contraindications / warnings).
      const searchable = [interactionsText, label.boxedWarning, label.contraindications, label.warnings]
        .filter(Boolean).join(" \n ");
      const term = coreTerms(med).find((t) => mentions(searchable, t));
      if (term) {
        const sev = gradeSeverity(term, label);
        flagged.push({ med, matchedTerm: term, level: sev.level, basis: sev.basis });
      }
    }
  }
  flagged.sort((a, b) => RANK[b.level] - RANK[a.level]);
  const maxLevel = flagged.reduce<"high" | "moderate" | "low" | null>((m, f) => (m && RANK[m] >= RANK[f.level] ? m : f.level), null);

  return NextResponse.json({
    drug: { brandName: label?.brandName || "", genericName: label?.genericName || "" },
    hasLabel: !!label,
    interactionsText,
    flagged,
    maxLevel,
    checkedAgainst: meds.length,
    source: "openFDA Drug Labeling (SPL) — boxed warning, contraindications, warnings & drug-interactions sections",
  });
}
