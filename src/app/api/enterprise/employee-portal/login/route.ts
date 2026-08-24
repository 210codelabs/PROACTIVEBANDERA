import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setEmployeeSessionCookie } from "@/lib/employeeAuth";

export const runtime = "nodejs";
const Body = z.object({ accessCode: z.string().min(1), pin: z.string().min(1) });

export async function POST(req: Request) {
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Access code and PIN are required" }, { status: 400 });
  const accessCode = parse.data.accessCode.trim().toUpperCase();
  try {
    const emp = await db.enterpriseEmployee.findFirst({ where: { accessCode } });
    if (!emp || !emp.accessEnabled || !emp.accessPinHash) return NextResponse.json({ error: "Invalid access code or PIN" }, { status: 401 });
    const ok = await bcrypt.compare(parse.data.pin, emp.accessPinHash);
    if (!ok) return NextResponse.json({ error: "Invalid access code or PIN" }, { status: 401 });
    const acct = await db.enterpriseAccount.findUnique({ where: { id: emp.enterpriseId } });
    await db.enterpriseEmployee.update({ where: { id: emp.id }, data: { lastPortalLoginAt: new Date() } }).catch(() => {});
    await setEmployeeSessionCookie({
      employeeId: emp.id, enterpriseId: emp.enterpriseId, patientId: emp.patientId,
      name: `${emp.firstName} ${emp.lastName}`.trim(), companyName: acct?.companyName || "",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
