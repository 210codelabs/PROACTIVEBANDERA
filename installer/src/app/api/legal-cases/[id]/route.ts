import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await db.legalCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      attorney: { select: { id: true, name: true, firm: true, email: true } },
      documents: { select: { id: true, name: true, category: true, mimeType: true, size: true, uploadedBy: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
      offers: { orderBy: { createdAt: "desc" } },
      deliverables: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ case: c });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["caseNumber", "court", "lawFirm", "claimNumber", "adjuster", "defendantInsurer", "caseType", "notes"]) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  if (typeof body.lienAmount === "number") data.lienAmountCents = Math.round(body.lienAmount * 100);
  let stageEvent: string | null = null;
  if (typeof body.status === "string") { data.status = body.status; stageEvent = body.status; }
  const updated = await db.legalCase.update({ where: { id }, data });
  if (stageEvent) {
    await db.caseEvent.create({ data: { legalCaseId: id, type: "stage", title: `Status changed to \"${stageEvent}\"`, actor: session.name || session.email } });
  }
  return NextResponse.json({ ok: true, case: updated });
}
