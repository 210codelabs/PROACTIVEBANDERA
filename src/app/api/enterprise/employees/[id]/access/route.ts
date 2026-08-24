import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += chars[crypto.randomInt(0, chars.length)];
  return `EMP-${s}`;
}
function genPin() { return String(crypto.randomInt(100000, 1000000)); }

// Company admin manages an employee's optional self-service login.
// body { action: 'enable' | 'reset' | 'disable' }.
// On enable/reset returns the accessCode + a one-time PIN to hand to the employee.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "enable");

  if (action === "disable") {
    await db.enterpriseEmployee.update({ where: { id: emp.id }, data: { accessEnabled: false } });
    return NextResponse.json({ ok: true, accessEnabled: false });
  }

  // enable or reset -> (re)generate code + PIN
  let accessCode = emp.accessCode || "";
  if (action === "reset" || !accessCode) {
    accessCode = genCode(); let guard = 0;
    while (await db.enterpriseEmployee.findFirst({ where: { accessCode } })) { accessCode = genCode(); if (++guard > 8) break; }
  }
  const pin = genPin();
  const accessPinHash = await bcrypt.hash(pin, 10);
  await db.enterpriseEmployee.update({ where: { id: emp.id }, data: { accessEnabled: true, accessCode, accessPinHash } });
  return NextResponse.json({ ok: true, accessEnabled: true, accessCode, pin, note: "Share the access code and PIN with the employee. The PIN is shown only once." });
}
