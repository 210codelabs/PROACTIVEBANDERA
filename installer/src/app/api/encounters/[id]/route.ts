import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const b = await req.json();

  const existing = await db.encounter.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status === "signed") return NextResponse.json({ error: "already signed" }, { status: 400 });

  await db.encounter.update({
    where: { id },
    data: {
      chiefComplaint: b.chiefComplaint ?? null,
      subjective: b.subjective ?? null,
      objective: b.objective ?? null,
      assessment: b.assessment ?? null,
      plan: b.plan ?? null,
      ros: b.ros ?? null,
      examFindings: b.examFindings ?? null,
      ...(b.signed ? { status: "signed", signedAt: new Date() } : {}),
    },
  });

  if (Array.isArray(b.diagnoses)) {
    await db.encounterDiagnosis.deleteMany({ where: { encounterId: id } });
    if (b.diagnoses.length > 0) {
      await db.encounterDiagnosis.createMany({
        data: b.diagnoses.map((d: any) => ({
          encounterId: id, icd10: d.icd10, description: d.description, primary: !!d.primary,
        })),
      });
    }
  }
  if (Array.isArray(b.charges)) {
    await db.encounterCharge.deleteMany({ where: { encounterId: id } });
    if (b.charges.length > 0) {
      await db.encounterCharge.createMany({
        data: b.charges.map((c: any) => ({
          encounterId: id,
          cpt: c.cpt,
          description: c.description,
          units: c.units || 1,
          modifier: c.modifier || null,
          feeCents: c.feeCents || 0,
        })),
      });
    }
  }

  await db.auditLog.create({ data: { userId: user.id, action: b.signed ? "sign" : "update", resource: "Encounter", resourceId: id } });

  return NextResponse.json({ ok: true });
}
