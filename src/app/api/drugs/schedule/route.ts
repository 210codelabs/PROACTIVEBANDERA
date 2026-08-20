import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { ndcLookup, searchDrugs } from "@/lib/openfda";

export const runtime = "nodejs";

// Normalize an openFDA dea_schedule value (e.g. "CII", "CIV", "2", "4") into a
// canonical schedule code + friendly label.
function scheduleInfo(raw: string): { controlled: boolean; schedule: string; label: string } {
  const r = String(raw || "").trim().toUpperCase();
  if (!r) return { controlled: false, schedule: "", label: "" };
  const roman = r.replace(/^C/, "");
  const map: Record<string, string> = {
    I: "I", II: "II", III: "III", IV: "IV", V: "V",
    "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
  };
  const num = map[roman] || roman;
  return { controlled: true, schedule: "C" + num, label: "Schedule " + num };
}

// POST /api/drugs/schedule { ndc?, name? }
// Best-effort controlled-substance detection from the openFDA NDC Directory
// (dea_schedule field). NOT a certified EPCS / DEA classification service.
export async function POST(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const b = await req.json().catch(() => null);
  const ndc = (b?.ndc ?? "").toString().trim();
  const name = (b?.name ?? "").toString().trim();
  if (!ndc && !name) return NextResponse.json({ error: "Provide ndc or name" }, { status: 400 });

  let raw = "";
  if (ndc) {
    const hit = await ndcLookup(ndc).catch(() => null);
    if (hit?.deaSchedule) raw = hit.deaSchedule;
  }
  if (!raw && name) {
    const hits = await searchDrugs(name, 8).catch(() => []);
    const lc = name.toLowerCase();
    // Prefer a hit whose brand/generic name matches the query and carries a schedule.
    const match = hits.find((h) => h.deaSchedule && (
      (h.brandName || "").toLowerCase().includes(lc) || (h.genericName || "").toLowerCase().includes(lc)
    )) || hits.find((h) => h.deaSchedule);
    if (match?.deaSchedule) raw = match.deaSchedule;
  }

  const info = scheduleInfo(raw);
  return NextResponse.json({ ...info, source: "openFDA NDC Directory (dea_schedule)" });
}
