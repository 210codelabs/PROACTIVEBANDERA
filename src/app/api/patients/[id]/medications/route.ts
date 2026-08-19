import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// GET /api/patients/:id/medications — active medications for a patient (in-note med list)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const medications = await db.medication.findMany({
    where: { patientId: id, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, medications });
}

// POST /api/patients/:id/medications — document a medication while charting.
// Prefilled from openFDA on the client (name/strength/form/route/ndc), but any field
// is optional except name. This records to the patient medication list (med rec),
// separate from the prescribing/Orders workflow.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const name = (b?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const created = await db.medication.create({
    data: {
      patientId: id,
      name,
      strength: b?.strength ? String(b.strength).trim() : null,
      form: b?.form ? String(b.form).trim() : null,
      route: b?.route ? String(b.route).trim() : null,
      sig: b?.sig ? String(b.sig).trim() : null,
      frequency: b?.frequency ? String(b.frequency).trim() : null,
      ndc: b?.ndc ? String(b.ndc).trim() : null,
      prescriberId: user.role === "provider" ? user.id : null,
      startDate: new Date(),
      status: "active",
      notes: b?.notes ? String(b.notes).trim() : null,
    },
  });
  return NextResponse.json({ ok: true, medication: created }, { status: 201 });
}
