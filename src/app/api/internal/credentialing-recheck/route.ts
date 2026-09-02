import { NextResponse } from "next/server";
import { recheckExclusions } from "@/lib/credentialing/recheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/internal/credentialing-recheck  (guarded by the shared cron secret)
// Schedule this MONTHLY (e.g. cron header x-weno-cron: <AUTH_SECRET>) to re-run
// OIG/SAM screening for all validated providers and flag newly-excluded ones.
export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret || req.headers.get("x-weno-cron") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const summary = await recheckExclusions();
  return NextResponse.json({ ok: true, ...summary });
}
