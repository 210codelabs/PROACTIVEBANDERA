import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }
const Body = z.object({ enterpriseId: z.string().min(1), email: z.string().email(), password: z.string().min(6), firstName: z.string().min(1), lastName: z.string().min(1), title: z.string().optional() });

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const b = parse.data; const email = b.email.toLowerCase();
  if (await db.enterprisePortalUser.findUnique({ where: { email } })) return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  const passwordHash = await bcrypt.hash(b.password, 10);
  const user = await db.enterprisePortalUser.create({ data: { enterpriseId: b.enterpriseId, email, passwordHash, firstName: b.firstName, lastName: b.lastName, title: b.title } });
  return NextResponse.json({ ok: true, userId: user.id });
}
