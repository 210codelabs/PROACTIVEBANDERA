import { NextResponse } from "next/server";
import { clearEnterpriseSessionCookie } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function POST() {
  await clearEnterpriseSessionCookie();
  return NextResponse.json({ ok: true });
}
