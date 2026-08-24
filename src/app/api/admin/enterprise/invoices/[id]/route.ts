import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: any = {};
  if (b.status !== undefined) { data.status = b.status; if (b.status === "paid") data.paidAt = new Date(); }
  if (b.notes !== undefined) data.notes = b.notes;
  const invoice = await db.enterpriseInvoice.update({ where: { id }, data });
  return NextResponse.json({ ok: true, invoice });
}
