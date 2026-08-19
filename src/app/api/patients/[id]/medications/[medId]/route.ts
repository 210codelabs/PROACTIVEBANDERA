import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// PATCH /api/patients/:id/medications/:medId — update a documented medication.
// Primary use: discontinue a medication from the chart ({status:'discontinued'}).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; medId: string }> }) {
  await requireSession();
  const { id, medId } = await params;
  const b = await req.json().catch(() => null);

  const data: Record<string, unknown> = {};
  if (typeof b?.status === "string" && b.status) {
    data.status = b.status;
    if (b.status === "discontinued" || b.status === "completed") data.endDate = new Date();
    if (b.status === "active") data.endDate = null;
  }
  if (typeof b?.sig === "string") data.sig = b.sig.trim() || null;
  if (typeof b?.notes === "string") data.notes = b.notes.trim() || null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const existing = await db.medication.findFirst({ where: { id: medId, patientId: id } });
  if (!existing) return NextResponse.json({ error: "Medication not found" }, { status: 404 });

  const medication = await db.medication.update({ where: { id: medId }, data });
  return NextResponse.json({ ok: true, medication });
}

// DELETE /api/patients/:id/medications/:medId — remove a documented medication.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; medId: string }> }) {
  await requireSession();
  const { id, medId } = await params;
  const existing = await db.medication.findFirst({ where: { id: medId, patientId: id } });
  if (!existing) return NextResponse.json({ error: "Medication not found" }, { status: 404 });
  await db.medication.delete({ where: { id: medId } });
  return NextResponse.json({ ok: true });
}
