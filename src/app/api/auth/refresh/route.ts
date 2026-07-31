import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Sliding-session refresh: re-issues the staff cookie with a fresh 5-minute TTL
// as long as the current session is still valid. Called by SessionGuard on activity.
export async function POST() {
  const ok = await refreshSession();
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
