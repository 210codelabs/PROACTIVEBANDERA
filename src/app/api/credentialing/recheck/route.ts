import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recheckExclusions } from "@/lib/credentialing/recheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/credentialing/recheck  (staff, on-demand "Recheck all now")
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await recheckExclusions();
  return NextResponse.json({ ok: true, ...summary });
}
