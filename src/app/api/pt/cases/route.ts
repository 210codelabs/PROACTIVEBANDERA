import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pt/cases?q=
// Lists patients registered under Physical Rehabilitation / Personal Injury
// (patientType === "legal") together with their most recent legal case
// (accident details + auto/casualty insurer). Used by PT Encounters + PT Claims.
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  const where: any = { patientType: "legal" };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { mrn: { contains: q, mode: "insensitive" } },
    ];
  }

  const patients = await db.patient.findMany({ where, take: 100, orderBy: { updatedAt: "desc" } });
  const cases = await Promise.all(
    patients.map(async (p) => {
      const lc = await db.legalCase
        .findFirst({ where: { patientId: p.id }, orderBy: { createdAt: "desc" } })
        .catch(() => null);
      return {
        patient: { id: p.id, firstName: p.firstName, lastName: p.lastName, mrn: p.mrn, dob: p.dob },
        legalCase: lc
          ? {
              id: lc.id,
              caseType: lc.caseType,
              caseNumber: lc.caseNumber,
              claimNumber: lc.claimNumber,
              dateOfInjury: lc.dateOfInjury,
              adjuster: lc.adjuster,
              defendantInsurer: lc.defendantInsurer,
              lawFirm: lc.lawFirm,
              status: lc.status,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ cases });
}
