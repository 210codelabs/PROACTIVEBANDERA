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
