import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getImmtracConfig,
  isImmtracConfigured,
  buildQbpQ11,
  queryImmtrac,
  parseRspK11,
} from "@/lib/immtrac";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["provider", "admin", "nurse"];

// On-demand pull of a patient's immunization history from Texas ImmTrac2.
// Requires: (1) a clinical role, (2) patient opt-in consent on file,
// (3) a live ImmTrac2 connection (DSHS TEST/prod credentials configured).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A clinical (provider/nurse/admin) account is required." }, { status: 403 });
  }

  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const c = getImmtracConfig();
  const queryId = `EHR-${randomUUID()}`;

  // (2) consent gate — Texas is opt-in
  if (!(patient as any).immtracConsent) {
    await db.immTracQuery.create({
      data: { patientId: id, userId: user.id, environment: c.environment, queryId, status: "NO_CONSENT" },
    }).catch(() => {});
    return NextResponse.json(
      { error: "ImmTrac2 consent is not on file. Record the patient's signed opt-in consent before querying the registry.", code: "NO_CONSENT" },
      { status: 412 }
    );
  }

  // (3) connection gate — inactive until DSHS issues credentials/WSDL
  if (!isImmtracConfigured(c)) {
    await db.immTracQuery.create({
      data: { patientId: id, userId: user.id, environment: c.environment, queryId, status: "NOT_CONFIGURED" },
    }).catch(() => {});
    return NextResponse.json(
      { error: "Texas ImmTrac2 is not connected yet — awaiting DSHS bidirectional (query) TEST credentials/WSDL.", code: "NOT_CONFIGURED", configured: false },
      { status: 503 }
    );
  }

  const audit = await db.immTracQuery.create({
    data: { patientId: id, userId: user.id, environment: c.environment, queryId, status: "SENT" },
  });

  try {
    const hl7 = buildQbpQ11(
      {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : "",
        sex: patient.sex,
        phone: patient.phone,
      },
      queryId,
      c
    );

    const raw = await queryImmtrac(hl7, c);
    const parsed = parseRspK11(raw);

    // Never auto-merge a multiple-candidate response (patient-safety rule).
    if (parsed.matchType === "Z31" || parsed.candidateCount > 1) {
      await db.immTracQuery.update({
        where: { id: audit.id },
        data: { status: "MULTIPLE", matchType: parsed.matchType, completedAt: new Date() },
      });
      return NextResponse.json({
        ok: false,
        status: "MULTIPLE",
        message: "The registry returned multiple possible patients. Manual review is required — no records were imported.",
      });
    }

    if (parsed.immunizations.length === 0) {
      await db.immTracQuery.update({
        where: { id: audit.id },
        data: { status: "NO_MATCH", matchType: parsed.matchType, completedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "NO_MATCH", imported: 0, message: "No immunization records found in ImmTrac2 for this patient." });
    }

    // Import with de-duplication (by registry sourceKey and by cvx+date).
    let imported = 0;
    let skipped = 0;
    for (const im of parsed.immunizations) {
      const dupe = await db.immunization.findFirst({
        where: {
          patientId: id,
          OR: [
            { sourceKey: im.sourceKey },
            im.cvxCode && im.givenAt
              ? { cvxCode: im.cvxCode, givenAt: new Date(im.givenAt) }
              : { id: "__none__" },
          ],
        },
      });
      if (dupe) { skipped++; continue; }
      await db.immunization.create({
        data: {
          patientId: id,
          vaccine: im.vaccine,
          cvxCode: im.cvxCode,
          givenAt: im.givenAt ? new Date(im.givenAt) : new Date(),
          lot: im.lot,
          site: im.site,
          route: im.route,
          manufacturer: im.manufacturer,
          doseNumber: im.doseNumber,
          source: "iis-import",
          sourceKey: im.sourceKey,
        },
      });
      imported++;
    }

    await db.immTracQuery.update({
      where: { id: audit.id },
      data: { status: "COMPLETED", matchType: parsed.matchType, imported, completedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "COMPLETED", imported, skipped, total: parsed.immunizations.length });
  } catch (e: any) {
    await db.immTracQuery.update({
      where: { id: audit.id },
      data: { status: "ERROR", errorCode: "UPSTREAM_ERROR", completedAt: new Date() },
    }).catch(() => {});
    return NextResponse.json(
      { error: "ImmTrac2 query failed.", detail: String(e?.message || e).slice(0, 160) },
      { status: 502 }
    );
  }
}
