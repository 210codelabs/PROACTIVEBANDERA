import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { enrichMedication } from "@/lib/rxnorm";

export const runtime = "nodejs";

// GET /api/enrichment/rxnorm?q=<medication name>
// Public reference enrichment: RxNorm normalization + drug class + MedlinePlus
// patient-education links. Returns reference data only (no patient history).
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ error: "Query too short" }, { status: 400 });
  const data = await enrichMedication(q);
  return NextResponse.json(data);
}
