import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/patients/[id]/ledger -> ledger entries + running balance
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const entries = await db.patientLedgerEntry.findMany({ where: { patientId: id }, orderBy: { date: "desc" }, take: 200 });
  let charges = 0, payments = 0, adjustments = 0;
  for (const e of entries) {
    if (e.type === "charge") charges += e.amountCents;
    else if (e.type === "payment") payments += e.amountCents;
    else if (e.type === "adjustment") adjustments += e.amountCents;
  }
  const balanceCents = charges - payments - adjustments;
  return NextResponse.json({ entries, totals: { charges, payments, adjustments, balanceCents } });
}

// POST /api/patients/[id]/ledger -> add a manual entry (copay/payment, adjustment/write-off, or charge)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const patient = await db.patient.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const type = b.type === "adjustment" ? "adjustment" : b.type === "charge" ? "charge" : "payment";
  const amountCents = Math.round(Number(b.amountDollars ?? (b.amountCents ? b.amountCents / 100 : 0)) * 100);
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

  const method = typeof b.method === "string" && b.method ? ` (${b.method})` : "";
  const defaultDesc = type === "payment" ? `Copay / payment${method}` : type === "adjustment" ? "Adjustment / write-off" : "Charge";
  const description = (typeof b.description === "string" && b.description.trim()) ? b.description.trim() : defaultDesc;

  const entry = await db.patientLedgerEntry.create({
    data: {
      patientId: id,
      type,
      amountCents,
      description,
      refKey: `manual:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      date: new Date(),
    },
  });
  return NextResponse.json({ ok: true, entry });
}

// DELETE /api/patients/[id]/ledger?entryId=... -> remove a MANUAL entry only
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;
  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });
  const entry = await db.patientLedgerEntry.findUnique({ where: { id: entryId } }).catch(() => null);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only manual entries can be deleted (auto charges/payments are tied to claims/ERA).
  if (!entry.refKey.startsWith("manual:")) return NextResponse.json({ error: "Only manual entries can be removed." }, { status: 400 });
  await db.patientLedgerEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
