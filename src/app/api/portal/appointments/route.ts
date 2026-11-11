import { NextResponse } from "next/server";
import { addMinutes, isValid, parse as parseDate } from "date-fns";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";
import { clinicHoursError } from "@/lib/clinic";
import { NON_BLOCKING_STATUSES, withProviderBookingLock } from "@/lib/appointments";
import { providerHoursError } from "@/lib/scheduling";

const schema = z.object({
  serviceTypeId: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
  location: z.enum(["in-office", "telehealth", "home-visit"]).default("in-office"),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requirePortalSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const { serviceTypeId, date, time, location, reason } = parsed.data;
  const start = parseDate(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  if (!isValid(start)) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }
  if (start.getTime() < Date.now()) {
    return NextResponse.json({ error: "Please choose a future date and time." }, { status: 400 });
  }
  const hoursErr = clinicHoursError(start);
  if (hoursErr) {
    return NextResponse.json({ error: hoursErr }, { status: 400 });
  }

  try {
    const provider = await db.user.findFirst({
      where: { role: "provider", active: true },
      orderBy: { lastName: "asc" },
    });
    if (!provider) {
      return NextResponse.json({ error: "No providers are available right now." }, { status: 409 });
    }

    let durationMin = 30;
    let svcId: string | null = null;
    let svcName = "General visit";
    if (serviceTypeId) {
      const svc = await db.serviceType.findUnique({ where: { id: serviceTypeId } });
      if (svc) {
        durationMin = svc.durationMin ?? 30;
        svcId = svc.id;
        svcName = svc.name;
      }
    }

    const end = addMinutes(start, durationMin);
    const availabilityError = clinicHoursError(start, end) || providerHoursError(provider.workingHours, start, end);
    if (availabilityError) return NextResponse.json({ error: availabilityError }, { status: 400 });
    const confirmationNumber = "PC-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    const appointment = await withProviderBookingLock(provider.id, async (tx) => {
      const conflict = await tx.appointment.findFirst({ where: { providerId: provider.id, status: { notIn: NON_BLOCKING_STATUSES }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } });
      if (conflict) return null;
      return tx.appointment.create({
        data: {
          patientId: session.patientId,
          providerId: provider.id,
          serviceTypeId: svcId,
          startsAt: start,
          endsAt: end,
          location,
          reason: reason?.trim() || null,
          notes: `Requested via patient portal · Confirmation ${confirmationNumber}`,
          status: "requested",
        },
        include: { provider: { select: { id: true, firstName: true, lastName: true, credential: true } }, serviceType: true },
      });
    });
    if (!appointment) return NextResponse.json({ error: "That time is no longer available. Please choose another time." }, { status: 409 });

    // Notify front desk (non-fatal). Use assigned provider as sender; admin/front-desk as recipient.
    try {
      const recipient = await db.user.findFirst({
        where: { active: true, role: { in: ["admin", "front-desk", "frontdesk", "staff"] } },
        orderBy: { role: "asc" },
      });
      const patient = await db.patient.findUnique({ where: { id: session.patientId }, select: { firstName: true, lastName: true, mrn: true } });
      const who = patient ? `${patient.firstName} ${patient.lastName} (MRN ${patient.mrn})` : `Patient ${session.patientId}`;
      await db.message.create({
        data: {
          fromUserId: provider.id,
          toUserId: recipient?.id ?? null,
          patientId: session.patientId,
          subject: `New appointment request — ${who} [${confirmationNumber}]`,
          body: [
            `A new appointment request was submitted via the patient portal.`,
            ``,
            `Confirmation: ${confirmationNumber}`,
            `Patient: ${who}`,
            `Service: ${svcName}`,
            `Requested for: ${start.toLocaleString()}`,
            `Visit type: ${location}`,
            reason?.trim() ? `Reason: ${reason.trim()}` : ``,
            ``,
            `Please confirm or reschedule with the patient.`,
          ].filter(Boolean).join("\n"),
          read: false,
        },
      });
    } catch {
      // ignore notification failures
    }

    return NextResponse.json({ ok: true, confirmationNumber, appointment });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not submit your request. Please try again." },
      { status: 503 },
    );
  }
}
