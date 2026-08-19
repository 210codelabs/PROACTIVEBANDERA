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

  const ndc = b?.ndc ? String(b.ndc).trim() : null;

  // Idempotency for imports/one-click adds: skip if an active med with the same
  // normalized name (and NDC, when present) already exists. Compare in JS to
  // avoid regex-sensitive Mongo insensitive matching.
  try {
    const existing = await db.medication.findMany({ where: { patientId: id, status: "active" } });
    const norm = (s: string | null | undefined) => String(s || "").trim().toLowerCase();
    const dup = existing.find((m) => norm(m.name) === norm(name) && (!ndc || !m.ndc || norm(m.ndc) === norm(ndc)));
    if (dup) return NextResponse.json({ ok: true, medication: dup, duplicate: true });
  } catch {
    /* best-effort dedupe */
  }

  const created = await db.medication.create({
    data: {
      patientId: id,
      name,
      strength: b?.strength ? String(b.strength).trim() : null,
      form: b?.form ? String(b.form).trim() : null,
      route: b?.route ? String(b.route).trim() : null,
      sig: b?.sig ? String(b.sig).trim() : null,
      frequency: b?.frequency ? String(b.frequency).trim() : null,
      ndc,
      prescriberId: user.role === "provider" ? user.id : null,
      startDate: new Date(),
      status: "active",
      source: b?.source ? String(b.source).trim() : "manual",
      notes: b?.notes ? String(b.notes).trim() : null,
    },
  });
  return NextResponse.json({ ok: true, medication: created }, { status: 201 });
}
