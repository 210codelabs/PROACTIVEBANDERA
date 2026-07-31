import { NextResponse } from "next/server";
import { clearAttorneySessionCookie } from "@/lib/attorneyAuth";

export async function POST() {
  await clearAttorneySessionCookie();
  return NextResponse.json({ ok: true });
}
