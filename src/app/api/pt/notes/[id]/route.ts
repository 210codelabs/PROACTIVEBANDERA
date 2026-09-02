import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const note = await db.ptNote.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const patient = await db.patient.findUnique({ where: { id: note.patientId } });
  return NextResponse.json({
    note,
    patient: patient ? { id: patient.id, firstName: patient.firstName, lastName: patient.lastName, mrn: patient.mrn, dob: patient.dob } : null,
  });
}

// PATCH -> edit fields and/or sign (body.sign === true). Signed notes lock the
// authoring PT's signature (name + NPI + credential + license).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const existing = await db.ptNote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  for (const f of ["mechanism", "subjective", "objective", "assessment", "plan", "goals", "causation"]) {
    if (typeof b[f] === "string") data[f] = b[f] || null;
  }
  if (Array.isArray(b.cptCodes)) data.cptCodes = b.cptCodes;
  if (Array.isArray(b.icdCodes)) data.icdCodes = b.icdCodes;
  if (b.visitDate) data.visitDate = new Date(b.visitDate);
  if (b.dateOfInjury) data.dateOfInjury = new Date(b.dateOfInjury);

  if (b.sign === true) {
    data.status = "signed";
    data.signedAt = new Date();
    data.signedByName = `${user.firstName} ${user.lastName}`;
  }
  if (b.unsign === true) {
    data.status = "draft";
    data.signedAt = null;
    data.signedByName = null;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const note = await db.ptNote.update({ where: { id }, data });
  return NextResponse.json({ ok: true, note });
}
