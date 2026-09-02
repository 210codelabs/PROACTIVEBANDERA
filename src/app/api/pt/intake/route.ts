import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pt/intake?patientId=  -> list PI accident intakes (optionally for one patient)
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId") || undefined;
  const intakes = await db.piIntake.findMany({
    where: { ...(patientId ? { patientId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ intakes });
}

// POST /api/pt/intake  -> create a PI accident intake. Patient MUST be registered
// under Physical Rehabilitation / Personal Injury (patientType === "legal").
export async function POST(req: Request) {
  const user = await requireSession();
  const b = await req.json().catch(() => ({}));
  if (!b.patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  const patient = await db.patient.findUnique({ where: { id: b.patientId } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (patient.patientType !== "legal") {
    return NextResponse.json(
      { error: "This patient is not registered under Physical Rehabilitation / Personal Injury. Register them as a legal/PI patient first." },
      { status: 400 }
    );
  }

  const intake = await db.piIntake.create({
    data: {
      patientId: b.patientId,
      legalCaseId: b.legalCaseId || null,
      accidentDate: b.accidentDate ? new Date(b.accidentDate) : null,
      accidentTime: b.accidentTime || null,
      accidentType: b.accidentType || null,
      location: b.location || null,
      description: b.description || null,
      role: b.role || null,
      seatbelt: typeof b.seatbelt === "boolean" ? b.seatbelt : null,
      airbag: typeof b.airbag === "boolean" ? b.airbag : null,
      policeReport: b.policeReport || null,
      bodyParts: Array.isArray(b.bodyParts) ? b.bodyParts : [],
      painLevel: typeof b.painLevel === "number" ? b.painLevel : (b.painLevel ? Number(b.painLevel) : null),
      priorInjuries: b.priorInjuries || null,
      autoInsurer: b.autoInsurer || null,
      autoPolicy: b.autoPolicy || null,
      claimNumber: b.claimNumber || null,
      adjuster: b.adjuster || null,
      attorney: b.attorney || null,
      lawFirm: b.lawFirm || null,
      status: "submitted",
      createdByName: `${user.firstName} ${user.lastName}`,
    },
  });

  return NextResponse.json({ ok: true, intake });
}
