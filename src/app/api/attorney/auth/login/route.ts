import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setAttorneySessionCookie } from "@/lib/attorneyAuth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = (b?.email || "").toString().trim().toLowerCase();
  const accessCode = (b?.accessCode || "").toString().trim();
  if (!email || !accessCode) return NextResponse.json({ error: "Email and access code are required." }, { status: 400 });

  const attorney = await db.attorney.findFirst({ where: { email, active: true } });
  if (!attorney || attorney.accessCode !== accessCode) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  await setAttorneySessionCookie({ attorneyId: attorney.id, name: attorney.name, firm: attorney.firm, email: attorney.email });
  return NextResponse.json({ ok: true, name: attorney.name, firm: attorney.firm });
}
