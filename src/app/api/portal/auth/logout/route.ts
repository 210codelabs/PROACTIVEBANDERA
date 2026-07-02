import { NextResponse } from "next/server";
import { clearPortalSessionCookie } from "@/lib/portalAuth";

export async function POST() {
  await clearPortalSessionCookie();
  return NextResponse.json({ ok: true });
}
