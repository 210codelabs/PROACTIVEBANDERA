import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setEnterpriseSessionCookie } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";
const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const email = parse.data.email.toLowerCase();
  try {
    const user = await db.enterprisePortalUser.findUnique({ where: { email } });
    if (!user || !user.active) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const ok = await bcrypt.compare(parse.data.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const acct = await db.enterpriseAccount.findUnique({ where: { id: user.enterpriseId } });
    if (!acct || acct.status !== "active") return NextResponse.json({ error: "Account inactive — contact the clinic." }, { status: 403 });
    await db.enterprisePortalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    await setEnterpriseSessionCookie({
      portalUserId: user.id,
      enterpriseId: user.enterpriseId,
      companyName: acct.companyName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
