import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendBookingConfirmation } from "@/lib/email";
import { clinicDayKey, clinicHHmm, clinicHoursError, formatClinic, practiceWallClockToDate } from "@/lib/clinic";
import { findClinic } from "@/lib/clinicLocations";
import { matchesBookingIdentity } from "@/lib/bookingIdentity";
import { NON_BLOCKING_STATUSES, withProviderBookingLock } from "@/lib/appointments";
import { providerHoursError } from "@/lib/scheduling";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genConfirmation() {
  return "PC-" + randomInt(100000, 1000000).toString();
}

// POST (PUBLIC): reserve a website appointment on the central calendar.
// New patients remain pending first-visit identity and insurance review.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const patientType = b?.patientType === "existing" ? "existing" : "new";
  const firstName = String(b?.firstName || "").trim();
  const lastName = String(b?.lastName || "").trim();
  if (!firstName || !lastName) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });

  let matchedPatientId: string | null = null;
  let priorityCheckin = false;
  const mrn = String(b?.mrn || "").trim();
  const dob = String(b?.dob || "").trim();
  const postalCode = String(b?.postalCode || "").trim();
  const bookingId = String(b?.bookingId || "").trim();
  const lookupKey = /^[A-Za-z0-9_-]{43}$/.test(bookingId) ? `booking-lookup:${createHash("sha256").update(bookingId).digest("hex")}` : null;

  if (patientType === "existing") {
    if ((!mrn && !lookupKey) || !dob || !postalCode) return NextResponse.json({ error: "MRN or booking ID, date of birth and ZIP code are required for existing patients." }, { status: 400 });
    const lookup = lookupKey ? await db.appSetting.findUnique({ where: { key: lookupKey } }) : null;
    const capability = lookup?.value as { patientId?: string; expiresAt?: number; used?: boolean } | undefined;
    const patient = lookupKey && capability?.patientId && !capability.used && typeof capability.expiresAt === "number" && capability.expiresAt > Date.now()
      ? await db.patient.findUnique({ where: { id: capability.patientId } })
      : mrn ? await db.patient.findUnique({ where: { mrn } }) : null;
    if (!patient || !matchesBookingIdentity(patient, dob, postalCode)) {
      return NextResponse.json({ error: "We couldn't verify those details. Please double-check or contact the clinic." }, { status: 404 });
    }
    matchedPatientId = patient.id;
    priorityCheckin = true;
  }

  // Clinic location (optional for API clients; the public form requires it).
  const locRaw = String(b?.location || b?.clinicLocation || "").trim();
  const clinic = locRaw ? findClinic(locRaw) : null;
  if (locRaw && !clinic) return NextResponse.json({ error: "Unknown clinic location." }, { status: 400 });

  // Ensure a unique confirmation number.
  let confirmation = genConfirmation();
  for (let i = 0; i < 5; i++) {
    const exists = await db.appointmentRequest.findUnique({ where: { confirmation } });
    if (!exists) break;
    confirmation = genConfirmation();
  }

  const prefDate = String(b?.preferredDate || "").trim();
  const prefTime = String(b?.preferredTime || "").trim();
  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(prefDate) || !/^([01]\d|2[0-3]):(00|30)$/.test(prefTime)) {
    return NextResponse.json({ error: "Choose a clinic, date and available appointment time." }, { status: 400 });
  }
  const start = practiceWallClockToDate(prefDate, prefTime);
  const end = new Date(start.getTime() + 30 * 60000);
  if (clinicDayKey(start) !== prefDate || clinicHHmm(start) !== prefTime || start.getTime() <= Date.now() || clinicHoursError(start, end)) {
    return NextResponse.json({ error: "Choose a valid future appointment time during clinic hours." }, { status: 400 });
  }
  if (patientType === "new" && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(`${dob}T00:00:00Z`)) || new Date(`${dob}T00:00:00Z`).toISOString().slice(0, 10) !== dob)) {
    return NextResponse.json({ error: "A valid date of birth is required." }, { status: 400 });
  }

  const providers = await db.user.findMany({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" }, select: { id: true, workingHours: true } });
  const intakeToken = patientType === "new" ? randomBytes(32).toString("base64url") : null;
  const intakeKey = intakeToken ? `booking-intake:${createHash("sha256").update(intakeToken).digest("hex")}` : null;
  let created: Awaited<ReturnType<typeof db.appointmentRequest.create>> | null = null;
  for (const provider of providers) {
    if (providerHoursError(provider.workingHours, start, end)) continue;
    try {
      created = await withProviderBookingLock(provider.id, async (tx) => {
        const conflict = await tx.appointment.findFirst({ where: { providerId: provider.id, status: { notIn: NON_BLOCKING_STATUSES }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } });
        if (conflict) return null;
        if (lookupKey) {
          const setting = await tx.appSetting.findUnique({ where: { key: lookupKey } });
          const capability = setting?.value as { patientId?: string; expiresAt?: number; used?: boolean } | undefined;
          if (!capability || capability.used || capability.patientId !== matchedPatientId || typeof capability.expiresAt !== "number" || capability.expiresAt <= Date.now()) throw new Error("Expired booking ID");
          await tx.appSetting.update({ where: { key: lookupKey }, data: { value: { ...capability, used: true } } });
        }
        let patientId = matchedPatientId;
        if (!patientId) {
          const provisional = await tx.patient.create({ data: {
            mrn: `PENDING-${randomUUID()}`, firstName, lastName, dob: new Date(`${dob}T00:00:00Z`), sex: "X",
            phone: String(b?.phone || "").trim() || null, email: String(b?.email || "").trim() || null,
            status: "pending-verification", patientType: "clinical",
          } });
          patientId = provisional.id;
        }
        const appointment = await tx.appointment.create({ data: {
          patientId, providerId: provider.id, startsAt: start, endsAt: end, location: "in-office", status: "scheduled",
          clinicLocationId: clinic.id, reason: String(b?.serviceInterest || "").trim() || null,
          notes: `Website booking ${confirmation}; clinic ${clinic.id}; ${patientType === "new" ? "identity and insurance pending verification" : "identity to be verified at check-in"}`,
        } });
        const request = await tx.appointmentRequest.create({ data: {
          patientType, firstName, lastName, phone: String(b?.phone || "").trim() || null, email: String(b?.email || "").trim() || null,
          dob: dob || null, mrn: patientType === "existing" ? mrn : null, matchedPatientId: patientId,
          serviceInterest: String(b?.serviceInterest || "").trim() || null, clinicLocation: clinic.id,
          preferredDate: prefDate, preferredTime: prefTime, message: String(b?.message || "").trim() || null,
          priorityCheckin, confirmation, status: patientType === "existing" ? "confirmed" : "pending",
          appointmentId: appointment.id, scheduledStartsAt: start,
        } });
        if (intakeKey) await tx.appSetting.create({ data: { key: intakeKey, value: { patientId, requestId: request.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000, used: false } } });
        return request;
      });
      if (created) break;
    } catch {
      return NextResponse.json({ error: "The appointment could not be reserved. Please try again." }, { status: 409 });
    }
  }
  if (!created) return NextResponse.json({ error: "That time is no longer available. Please choose another time." }, { status: 409 });

  // Best-effort front-desk inbox notification (native Message).
  try {
    const recipient = await db.user.findFirst({
      where: { active: true, role: { in: ["admin", "front-desk", "frontdesk", "staff"] } },
      orderBy: { role: "asc" },
    });
    const sender = recipient ?? (await db.user.findFirst({ where: { active: true } }));
    if (sender) {
      const who = `${created.firstName} ${created.lastName}`;
      const kind = created.patientType === "existing" ? "current patient" : "new patient";
      await db.message.create({
        data: {
          fromUserId: sender.id,
          toUserId: recipient?.id ?? null,
          patientId: matchedPatientId,
          subject: `New website appointment booking — ${who}${clinic ? ` @ ${clinic.cityLine.split(",")[0]} (${clinic.street})` : ""} [${created.confirmation}]${priorityCheckin ? " ★PRIORITY" : ""}`,
          body: [
            `A website appointment has been reserved on the central calendar.`,
            ``,
            `Confirmation: ${created.confirmation}`,
            `Patient: ${who} (${kind})`,
            clinic ? `Clinic: ${clinic.name} — ${clinic.address} · ${clinic.phones.join(" / ")}` : ``,
            created.mrn ? `MRN: ${created.mrn}` : ``,
            created.phone ? `Phone: ${created.phone}` : ``,
            created.email ? `Email: ${created.email}` : ``,
            created.serviceInterest ? `Service: ${created.serviceInterest}` : ``,
            (created.preferredDate || created.preferredTime) ? `Preferred: ${created.preferredDate ?? ""} ${created.preferredTime ?? ""}`.trim() : ``,
            priorityCheckin ? `★ Priority check-in (verified current patient)` : ``,
            ``,
            patientType === "new" ? `Review identity and insurance during first-visit onboarding.` : `Patient identity matched for booking.`,
          ].filter(Boolean).join("\n"),
          read: false,
        },
      });
    }
  } catch {
    // notification is non-fatal
  }

  // Best-effort confirmation email (no-op if RESEND not configured).
  const lang = b?.lang === "es" ? "es" : "en";
  let emailStatus: string = "skipped";
  if (created.email) {
    emailStatus = await sendBookingConfirmation({
      to: created.email,
      firstName: created.firstName,
      confirmation: created.confirmation,
      serviceInterest: created.serviceInterest,
      preferredDate: created.preferredDate,
      preferredTime: created.preferredTime,
      priorityCheckin: created.priorityCheckin,
      scheduledAt: `${formatClinic(start)} Central Time`,
      lang,
    });
    try { await db.appointmentRequest.update({ where: { id: created.id }, data: { emailStatus } }); } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true, confirmation: created.confirmation, priorityCheckin, emailStatus, ...(intakeToken ? { intakeToken } : {}),
    clinic: clinic ? { id: clinic.id, name: clinic.name, address: clinic.address, phones: clinic.phones } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

// GET (STAFF): list requests for the front desk.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where = status ? { status } : {};
  const requests = await db.appointmentRequest.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  return NextResponse.json({ requests });
}
