import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility, getStediConfig } from "@/lib/stedi";

/**
 * POST /api/appointments/[id]/checkin
 * Marks an appointment as "checked-in" and, best-effort, runs a fresh Stedi
 * eligibility (270/271) check for the patient so the coverage card is current
 * at the front desk. If Stedi is not configured or no payer can be determined,
 * the check is skipped silently (check-in still succeeds).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const appt = await db.appointment.findUnique({ where: { id } }).catch(() => null);
  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  const appointment = await db.appointment
    .update({ where: { id }, data: { status: "checked-in" } })
    .catch(() => null);
  if (!appointment) return NextResponse.json({ error: "Check-in is temporarily unavailable" }, { status: 503 });

  // Best-effort eligibility refresh.
  let coverage: any = null;
  let coverageNote: string | null = null;
  try {
    const cfg = await getStediConfig();
    const patient = await db.patient.findUnique({ where: { id: appt.patientId } });
    if (!cfg.enabled || !cfg.apiKey) {
      coverageNote = "Stedi not configured — coverage not refreshed.";
    } else if (!patient) {
      coverageNote = "Patient record unavailable.";
    } else {
      // Reuse the payer from the most recent saved check; fall back to default payer.
      const last = await db.eligibilityCheck
        .findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" } })
        .catch(() => null);
      // Reuse the payer from the patient record, then the most recent saved
      // check, then the default payer, then ANY available directory payer.
      let payerId = ((patient as any).payerId || last?.payerId || cfg.defaultPayerId || "").trim();
      if (!payerId) {
        const anyPayer = await db.payer
          .findFirst({ where: { active: true, supportsEligibility: true, stediId: { not: null } }, orderBy: { name: "asc" } })
          .catch(() => null);
        if (anyPayer?.stediId) payerId = anyPayer.stediId.trim();
      }
      const memberId = (patient as any).memberId || last?.memberId || undefined;
      if (!payerId) {
        coverageNote = "No payer on file — verify coverage manually.";
      } else {
        const result = await checkEligibility({
          payerId,
          memberId,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dob,
          dateOfService: appt.startsAt,
        });
        coverage = await db.eligibilityCheck.create({
          data: {
            patientId: patient.id,
            patientName: `${patient.lastName}, ${patient.firstName}`,
            payerId,
            payerName: result.payerName || last?.payerName || (patient as any).insurerName || null,
            memberId: memberId || null,
            status: result.status,
            planName: result.planName || null,
            summary: result.summary as object,
            raw: result.raw as object,
            checkedById: user.id,
            checkedByName: `${user.firstName} ${user.lastName}`,
          },
        });
      }
    }
  } catch (e: any) {
    coverageNote = `Coverage refresh failed: ${String(e?.message || e).slice(0, 120)}`;
  }

  return NextResponse.json({ ok: true, appointment, coverage, coverageNote });
}
