import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const accounts = await db.enterpriseAccount.findMany({ orderBy: { createdAt: "desc" } });
  const users = await db.enterprisePortalUser.findMany({ select: { id: true, enterpriseId: true, email: true, firstName: true, lastName: true, title: true, active: true, lastLoginAt: true } });
  const reqCounts = await db.enterpriseServiceRequest.groupBy({ by: ["enterpriseId"], _count: { _all: true } }).catch(() => [] as any[]);
  const countMap: Record<string, number> = {};
  for (const c of reqCounts as any[]) countMap[c.enterpriseId] = c._count._all;
  return NextResponse.json({ accounts: accounts.map((a) => ({ ...a, requestCount: countMap[a.id] || 0, users: users.filter((u) => u.enterpriseId === a.id) })) });
}

const Body = z.object({
  companyName: z.string().min(1), industry: z.string().optional(), contactName: z.string().optional(), contactEmail: z.string().optional(),
  contactPhone: z.string().optional(), addressLine1: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
  postalCode: z.string().optional(), billingEmail: z.string().optional(), netTerms: z.number().optional(), notes: z.string().optional(),
  adminEmail: z.string().email(), adminPassword: z.string().min(6), adminFirstName: z.string().min(1), adminLastName: z.string().min(1),
});

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Missing required fields (company + admin login)" }, { status: 400 });
  const b = parse.data;
  const email = b.adminEmail.toLowerCase();
  if (await db.enterprisePortalUser.findUnique({ where: { email } })) return NextResponse.json({ error: "A portal user with that email already exists." }, { status: 409 });
  const acct = await db.enterpriseAccount.create({ data: { companyName: b.companyName, industry: b.industry, contactName: b.contactName, contactEmail: b.contactEmail, contactPhone: b.contactPhone, addressLine1: b.addressLine1, city: b.city, state: b.state, postalCode: b.postalCode, billingEmail: b.billingEmail, netTerms: b.netTerms ?? 30, notes: b.notes } });
  const passwordHash = await bcrypt.hash(b.adminPassword, 10);
  await db.enterprisePortalUser.create({ data: { enterpriseId: acct.id, email, passwordHash, firstName: b.adminFirstName, lastName: b.adminLastName, title: "Account Admin" } });
  return NextResponse.json({ ok: true, account: acct });
}
