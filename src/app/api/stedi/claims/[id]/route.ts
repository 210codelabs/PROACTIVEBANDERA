import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const claim = await db.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ claim });
}

// PATCH update a claim's payer / diagnoses / service lines (for denial correction).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.claim.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: any = {};
  if (typeof b.payerId === "string") data.payerId = b.payerId.trim();
  if (typeof b.payerName === "string") data.payerName = b.payerName;
  if (Array.isArray(b.diagnoses)) data.diagnoses = b.diagnoses;
  if (Array.isArray(b.serviceLines)) {
    data.serviceLines = b.serviceLines;
    data.totalChargeCents = b.serviceLines.reduce((s: number, l: any) => s + (l.chargeCents || 0) * (l.units || 1), 0);
  }
  // Correcting a denied/rejected claim returns it to draft so it can be re-submitted.
  if (existing.status === "rejected" || existing.status === "denied") data.status = "draft";

  const claim = await db.claim.update({ where: { id }, data });
  return NextResponse.json({ ok: true, claim });
}
