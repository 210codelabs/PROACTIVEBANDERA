import { NextResponse } from "next/server";
import { addMinutes, isValid, parse as parseDate } from "date-fns";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendBookingConfirmation } from "@/lib/email";
import { clinicHoursError } from "@/lib/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genMrn() {
  return "PC-" + Math.floor(100000 + Math.random() * 900000).toString();
}

// POST (STAFF): convert a website AppointmentRequest into a real scheduled Appointment.
// - existing patient: uses the matched patient record.
// - new patient: creates a Patient (this is the in-clinic activation of the MRN, done by staff).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const reqRow = await db.appointmentRequest.findUnique({ where: { id } });
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.appointmentId) return NextResponse.json({ error: "This request has already been scheduled." }, { status: 409 });

  // Resolve date/time: body overrides, else the patient's preferred values.
  const date = String((body as Record<string, unknown>).date || reqRow.preferredDate || "").trim();
  const time = String((body as Record<string, unknown>).time || reqRow.preferredTime || "").trim();
  const location = (["in-office", "telehealth", "home-visit"].includes(String((body as Record<string, unknown>).location))
    ? String((body as Record<string, unknown>).location)
    : "in-office");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
    return NextResponse.json({ error: "A valid date and time are required to schedule this appointment." }, { status: 400 });
  }
  const start = parseDate(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  if (!isValid(start)) return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  const hoursErr = clinicHoursError(start, addMinutes(start, 30));
  if (hoursErr) return NextResponse.json({ error: hoursErr }, { status: 400 });

  // Provider (first active provider).
  const provider = await db.user.findFirst({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" } });
  if (!provider) return NextResponse.json({ error: "No active providers are available." }, { status: 409 });

  // Resolve or create the patient.
  let patientId = reqRow.matchedPatientId;
  if (!patientId) {
    // New patient — create a minimal record with a unique MRN.
    let mrn = genMrn();
    for (let i = 0; i < 6; i++) {
      const exists = await db.patient.findUnique({ where: { mrn } });
      if (!exists) break;
      mrn = genMrn();
    }
    const dob = reqRow.dob && /^\d{4}-\d{2}-\d{2}$/.test(reqRow.dob) ? new Date(reqRow.dob) : new Date("1900-01-01");
    const patient = await db.patient.create({
      data: {
        mrn,
        firstName: reqRow.firstName,
        lastName: reqRow.lastName,
        dob,
        sex: "X",
        email: reqRow.email || null,
        phone: reqRow.phone || null,
        status: "active",
        patientType: "clinical",
      },
    });
    patientId = patient.id;
  }

  const appointment = await db.appointment.create({
    data: {
      patientId,
      providerId: provider.id,
      startsAt: start,
      endsAt: addMinutes(start, 30),
      location,
      reason: reqRow.serviceInterest || null,
      notes: `Scheduled from website request ${reqRow.confirmation}`,
      status: "scheduled",
    },
    include: { patient: true, provider: true },
  });

  const updated = await db.appointmentRequest.update({
    where: { id },
    data: { status: "confirmed", appointmentId: appointment.id, scheduledStartsAt: start },
  });

  // Best-effort confirmation email now that it's scheduled.
  if (reqRow.email) {
    try {
      await sendBookingConfirmation({
        to: reqRow.email,
        firstName: reqRow.firstName,
        confirmation: reqRow.confirmation,
        serviceInterest: reqRow.serviceInterest,
        priorityCheckin: reqRow.priorityCheckin,
        scheduledAt: start.toLocaleString(),
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
      patientId,
      providerName: `${appointment.provider.firstName} ${appointment.provider.lastName}`,
      patientMrn: appointment.patient.mrn,
    },
  });
}
