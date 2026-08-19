import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { recallLookup } from "@/lib/openfda";

export const runtime = "nodejs";

// GET /api/drugs/recall?ndc=0555-0775  -> open/closed FDA recall reports for a product NDC
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const ndc = new URL(req.url).searchParams.get("ndc")?.trim() || "";
  if (!/^[0-9]{4,5}-?[0-9]{3,4}(-?[0-9]{1,2})?$/.test(ndc)) {
    return NextResponse.json({ error: "Invalid NDC format", open: false, recalls: [] }, { status: 400 });
  }
  const { open, recalls } = await recallLookup(ndc);
  return NextResponse.json({ ndc, open, recalls, source: "openFDA Drug Enforcement (recalls)" });
}
