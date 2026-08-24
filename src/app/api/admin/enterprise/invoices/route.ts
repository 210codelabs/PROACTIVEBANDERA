import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

export async function GET(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const enterpriseId = new URL(req.url).searchParams.get("enterpriseId") || undefined;
  const where: any = {}; if (enterpriseId) where.enterpriseId = enterpriseId;
  const invoices = await db.enterpriseInvoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const accts = await db.enterpriseAccount.findMany({ select: { id: true, companyName: true } });
  const nameMap: Record<string, string> = {}; for (const a of accts) nameMap[a.id] = a.companyName;
  return NextResponse.json({ invoices: invoices.map((i) => ({ ...i, companyName: nameMap[i.enterpriseId] || "" })) });
}

const Line = z.object({ desc: z.string(), qty: z.number(), unitCents: z.number() });
const Body = z.object({ enterpriseId: z.string().min(1), number: z.string().optional(), dueDate: z.string().optional().nullable(), taxCents: z.number().optional(), notes: z.string().optional(), lineItems: z.array(Line).min(1), status: z.string().optional() });

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Provide enterprise + at least one line item" }, { status: 400 });
  const b = parse.data;
  const subtotalCents = b.lineItems.reduce((s, l) => s + Math.round(l.qty * l.unitCents), 0);
  const taxCents = b.taxCents || 0;
  const number = b.number || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoice = await db.enterpriseInvoice.create({ data: { enterpriseId: b.enterpriseId, number, status: b.status || "sent", dueDate: b.dueDate ? new Date(b.dueDate) : null, lineItems: b.lineItems as any, subtotalCents, taxCents, totalCents: subtotalCents + taxCents, notes: b.notes } });
  return NextResponse.json({ ok: true, invoice });
}
