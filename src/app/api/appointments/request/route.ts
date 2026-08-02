import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendBookingConfirmation } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genConfirmation() {
  return "PC-" + Math.floor(100000 + Math.random() * 900000).toString();
}

// POST (PUBLIC): a website "request a visit" submission.
// - new patient: basic info only, no MRN (activated in-clinic).
// - existing patient: MRN + DOB verified against the patient record; on match we
//   link the patient and flag priority check-in.
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

  if (patientType === "existing") {
    if (!mrn || !dob) return NextResponse.json({ error: "MRN and date of birth are required for existing patients." }, { status: 400 });
    const patient = await db.patient.findUnique({ where: { mrn } });
    const dobMatches = patient && new Date(patient.dob).toISOString().slice(0, 10) === dob;
    if (!patient || !dobMatches) {
      return NextResponse.json({ error: "We couldn't verify that MRN and date of birth. Please double-check, visit the front desk, or use the Patient Portal." }, { status: 404 });
    }
    matchedPatientId = patient.id;
    priorityCheckin = true;
  }

  // Ensure a unique confirmation number.
  let confirmation = genConfirmation();
  for (let i = 0; i < 5; i++) {
    const exists = await db.appointmentRequest.findUnique({ where: { confirmation } });
    if (!exists) break;
    confirmation = genConfirmation();
  }

  const created = await db.appointmentRequest.create({
    data: {
      patientType, firstName, lastName,
      phone: String(b?.phone || "").trim() || null,
      email: String(b?.email || "").trim() || null,
      dob: dob || null,
      mrn: patientType === "existing" ? mrn : null,
      matchedPatientId,
      serviceInterest: String(b?.serviceInterest || "").trim() || null,
      preferredDate: String(b?.preferredDate || "").trim() || null,
      preferredTime: String(b?.preferredTime || "").trim() || null,
      message: String(b?.message || "").trim() || null,
      priorityCheckin,
      confirmation,
    },
  });

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
          subject: `New website appointment request — ${who} [${created.confirmation}]${priorityCheckin ? " ★PRIORITY" : ""}`,
          body: [
            `A new "Book a Visit" request was submitted from the website.`,
            ``,
            `Confirmation: ${created.confirmation}`,
            `Patient: ${who} (${kind})`,
            created.mrn ? `MRN: ${created.mrn}` : ``,
            created.phone ? `Phone: ${created.phone}` : ``,
            created.email ? `Email: ${created.email}` : ``,
            created.serviceInterest ? `Service: ${created.serviceInterest}` : ``,
            (created.preferredDate || created.preferredTime) ? `Preferred: ${created.preferredDate ?? ""} ${created.preferredTime ?? ""}`.trim() : ``,
            priorityCheckin ? `★ Priority check-in (verified current patient)` : ``,
            ``,
            `Review it under Appointment Requests to confirm or schedule.`,
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
      lang,
    });
    try { await db.appointmentRequest.update({ where: { id: created.id }, data: { emailStatus } }); } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, confirmation: created.confirmation, priorityCheckin, emailStatus });
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
