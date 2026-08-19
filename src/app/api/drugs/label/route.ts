import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { labelLookup } from "@/lib/openfda";

export const runtime = "nodejs";

// GET /api/drugs/label?productNdc=51655-232  (or ?name=lisinopril)
// -> real-time SPL product labeling from openFDA
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const sp = new URL(req.url).searchParams;
  const productNdc = sp.get("productNdc")?.trim() || undefined;
  const name = sp.get("name")?.trim() || undefined;
  if (!productNdc && !name) return NextResponse.json({ error: "Provide productNdc or name", result: null }, { status: 400 });
  const result = await labelLookup({ productNdc, name });
  return NextResponse.json({ result, source: "openFDA Drug Labeling (SPL)" });
}
