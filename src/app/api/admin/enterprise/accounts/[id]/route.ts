import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["companyName", "industry", "contactName", "contactEmail", "contactPhone", "addressLine1", "city", "state", "postalCode", "billingEmail", "notes", "status"]) if (b[k] !== undefined) data[k] = b[k];
  if (b.netTerms !== undefined) data.netTerms = Number(b.netTerms) || 30;
  const account = await db.enterpriseAccount.update({ where: { id }, data });
  return NextResponse.json({ ok: true, account });
}
