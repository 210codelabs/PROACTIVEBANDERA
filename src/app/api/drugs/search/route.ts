import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchDrugs } from "@/lib/openfda";

export const runtime = "nodejs";

// GET /api/drugs/search?q=lisin  -> openFDA NDC Directory typeahead
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ results: [] });
  const results = await searchDrugs(q);
  return NextResponse.json({ results, source: "openFDA NDC Directory" });
}
