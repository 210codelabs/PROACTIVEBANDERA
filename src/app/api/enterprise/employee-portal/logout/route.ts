import { NextResponse } from "next/server";
import { clearEmployeeSessionCookie } from "@/lib/employeeAuth";

export const runtime = "nodejs";

export async function POST() {
  await clearEmployeeSessionCookie();
  return NextResponse.json({ ok: true });
}
