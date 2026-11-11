import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendBookingConfirmation } from "@/lib/email";
import { clinicDayKey, clinicHHmm, clinicHoursError, formatClinic, practiceWallClockToDate } from "@/lib/clinic";
import { findClinic } from "@/lib/clinicLocations";
import { NON_BLOCKING_STATUSES, withProviderBookingLock } from "@/lib/appointments";
import { providerHoursError } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST (STAFF): reserve a legacy website request in the central calendar.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "provider", "nurse", "frontdesk", "front-desk", "staff"].includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const reqRow = await db.appointmentRequest.findUnique({ where: { id } });
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.appointmentId) return NextResponse.json({ error: "This request has already been scheduled." }, { status: 409 });
  if (reqRow.status === "declined") return NextResponse.json({ error: "A declined request cannot be scheduled." }, { status: 409 });

  // Resolve date/time: body overrides, else the patient's preferred values.
  const date = String((body as Record<string, unknown>).date || reqRow.preferredDate || "").trim();
  const time = String((body as Record<string, unknown>).time || reqRow.preferredTime || "").trim();
  const location = (["in-office", "telehealth", "home-visit"].includes(String((body as Record<string, unknown>).location))
    ? String((body as Record<string, unknown>).location)
    : "in-office");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return NextResponse.json({ error: "A valid date and time are required to schedule this appointment." }, { status: 400 });
  }
  const start = practiceWallClockToDate(date, time);
  if (clinicDayKey(start) !== date || clinicHHmm(start) !== time || start.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a valid future date and time." }, { status: 400 });
  if (reqRow.patientType === "new" && (!reqRow.dob || !/^\d{4}-\d{2}-\d{2}$/.test(reqRow.dob) || new Date(`${reqRow.dob}T00:00:00Z`).toISOString().slice(0, 10) !== reqRow.dob)) {
    return NextResponse.json({ error: "A valid date of birth is required before scheduling this new patient." }, { status: 400 });
  }
  const end = addMinutes(start, 30);
  const hoursErr = clinicHoursError(start, end);
  if (hoursErr) return NextResponse.json({ error: hoursErr }, { status: 400 });

  const clinic = findClinic(reqRow.clinicLocation);
  const providers = await db.user.findMany({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" }, select: { id: true, workingHours: true } });
  if (!providers.length) return NextResponse.json({ error: "No active providers are available." }, { status: 409 });

  let reservation: { request: any; appointment: any; alreadyScheduled?: boolean } | null = null;
  for (const provider of providers) {
    if (providerHoursError(provider.workingHours, start, end)) continue;
    const result = await withProviderBookingLock(provider.id, async (tx) => {
      const current = await tx.appointmentRequest.findUnique({ where: { id } });
      if (!current || current.status === "declined") return { kind: "invalid" as const };
      if (current.appointmentId) return { kind: "already" as const };
      const conflict = await tx.appointment.findFirst({ where: { providerId: provider.id, status: { notIn: NON_BLOCKING_STATUSES }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } });
      if (conflict) return { kind: "conflict" as const };

      let patientId = current.matchedPatientId;
      if (!patientId) {
        const patient = await tx.patient.create({ data: {
          mrn: `PENDING-${randomUUID()}`, firstName: current.firstName, lastName: current.lastName,
          dob: new Date(`${current.dob}T00:00:00Z`), sex: "X", email: current.email || null,
          phone: current.phone || null, status: "pending-verification", patientType: "clinical",
        } });
        patientId = patient.id;
      }
      const appointment = await tx.appointment.create({ data: {
        patientId, providerId: provider.id, startsAt: start, endsAt: end, location,
        clinicLocationId: clinic?.id || null, reason: current.serviceInterest || null,
        notes: `Scheduled from website request ${current.confirmation}`, status: "scheduled",
      }, include: { patient: true, provider: { select: { firstName: true, lastName: true } } } });
      const updated = await tx.appointmentRequest.update({ where: { id }, data: {
        status: current.patientType === "new" ? "pending" : "confirmed",
        matchedPatientId: patientId, appointmentId: appointment.id, scheduledStartsAt: start,
      } });
      return { kind: "created" as const, request: updated, appointment };
    });
    if (result.kind === "already") return NextResponse.json({ error: "This request has already been scheduled." }, { status: 409 });
    if (result.kind === "invalid") return NextResponse.json({ error: "This request cannot be scheduled." }, { status: 409 });
    if (result.kind === "created") { reservation = result; break; }
  }
  if (!reservation) return NextResponse.json({ error: "No provider is available for that appointment time." }, { status: 409 });
  const { request: updated, appointment } = reservation;

  // Best-effort confirmation email now that it's scheduled.
  if (reqRow.email) {
    try {
      await sendBookingConfirmation({
        to: reqRow.email,
        firstName: reqRow.firstName,
        confirmation: reqRow.confirmation,
        serviceInterest: reqRow.serviceInterest,
        priorityCheckin: reqRow.priorityCheckin,
        scheduledAt: `${formatClinic(start)} Central Time`,
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true,
    request: updated,
    appointment: {
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      location: appointment.location,
      clinicLocationId: appointment.clinicLocationId,
      patientId: appointment.patientId,
      providerName: `${appointment.provider.firstName} ${appointment.provider.lastName}`,
      patientMrn: reqRow.patientType === "existing" ? appointment.patient.mrn : null,
    },
  });
}
