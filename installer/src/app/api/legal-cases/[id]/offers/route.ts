import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const offers = await db.caseOffer.findMany({ where: { legalCaseId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ offers });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  const party = ["clinic", "attorney", "insurer"].includes(body?.party) ? body.party : "clinic";
  const kind = ["offer", "counter", "acceptance"].includes(body?.kind) ? body.kind : "offer";
  const offer = await db.caseOffer.create({
    data: { legalCaseId: id, party, kind, amountCents: Math.round(amount * 100), note: String(body?.note || "") || null, createdBy: session.name || session.email },
  });
  await db.caseEvent.create({ data: { legalCaseId: id, type: "offer", title: `${kind === "counter" ? "Counter-offer" : kind === "acceptance" ? "Acceptance" : "Offer"} by ${party}: $${amount.toFixed(2)}`, detail: body?.note || null, actor: session.name || session.email } });
  return NextResponse.json({ ok: true, offer });
}
