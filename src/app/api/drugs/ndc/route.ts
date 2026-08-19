import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { ndcLookup } from "@/lib/openfda";

export const runtime = "nodejs";

// GET /api/drugs/ndc?ndc=51655-232  -> exact NDC directory record
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const ndc = new URL(req.url).searchParams.get("ndc")?.trim() || "";
  if (!/^[0-9]{4,5}-?[0-9]{3,4}(-?[0-9]{1,2})?$/.test(ndc)) {
    return NextResponse.json({ error: "Invalid NDC format", result: null }, { status: 400 });
  }
  const result = await ndcLookup(ndc);
  return NextResponse.json({ result, source: "openFDA NDC Directory" });
}
