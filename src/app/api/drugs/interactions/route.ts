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

  const flagged: { med: string; matchedTerm: string }[] = [];
  if (interactionsText) {
    for (const med of meds) {
      const term = coreTerms(med).find((t) => mentions(interactionsText, t));
      if (term) flagged.push({ med, matchedTerm: term });
    }
  }

  return NextResponse.json({
    drug: { brandName: label?.brandName || "", genericName: label?.genericName || "" },
    hasLabel: !!label,
    interactionsText,
    flagged,
    checkedAgainst: meds.length,
    source: "openFDA Drug Labeling (SPL) — drug interactions section",
  });
}
