import { NextResponse } from "next/server";
import { refreshPortalSession } from "@/lib/portalAuth";

export const dynamic = "force-dynamic";

// Sliding-session refresh for the patient portal (5-minute inactivity TTL).
export async function POST() {
  const ok = await refreshPortalSession();
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
