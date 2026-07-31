import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}
function confNumber() {
  return "PC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Public kiosk intake: creates/updates a patient and records a HIPAA consent + intake
// Document that appears in the patient's chart (Documents tab).
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const firstName = (b.firstName || "").trim();
    const lastName = (b.lastName || "").trim();
    if (!firstName || !lastName || !b.dob) {
      return NextResponse.json({ error: "First name, last name and date of birth are required." }, { status: 400 });
    }
    if (!b.hipaaConsent) {
      return NextResponse.json({ error: "HIPAA acknowledgement is required." }, { status: 400 });
    }
    if (!b.signature || !String(b.signature).trim()) {
      return NextResponse.json({ error: "An electronic signature is required." }, { status: 400 });
    }

    // Find existing patient by email, else by name + dob; otherwise create.
    let patient = null as any;
    const dob = new Date(b.dob);
    if (b.email) {
      patient = await db.patient.findFirst({ where: { email: String(b.email).trim() } });
    }
    if (!patient) {
      patient = await db.patient.findFirst({ where: { firstName, lastName, dob } });
    }
    if (!patient) {
      patient = await db.patient.create({
        data: {
          mrn: nextMrn(),
          firstName,
          lastName,
          dob,
          sex: b.sex || "U",
          email: b.email ? String(b.email).trim() : null,
          phone: b.phone ? String(b.phone).trim() : null,
          status: "active",
        },
      });
    }

    const confirmation = confNumber();
    await db.document.create({
      data: {
        patientId: patient.id,
        title: "HIPAA Consent & Kiosk Intake",
        category: "consent",
        body: JSON.stringify({
          source: "kiosk",
          confirmation,
          module: b.module || "ProactiveMed",
          reason: b.reason || "",
          phone: b.phone || "",
          email: b.email || "",
          hipaaConsent: true,
          signature: String(b.signature).trim(),
          submittedAt: new Date().toISOString(),
        }),
      },
    });

    // Notify front desk
    try {
      await db.message.create({
        data: {
          patientId: patient.id,
          subject: "New kiosk intake + HIPAA consent",
          body: `${firstName} ${lastName} completed self-service intake at the kiosk (module: ${b.module || "ProactiveMed"}). Confirmation ${confirmation}.`,
          direction: "inbound",
          status: "unread",
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, confirmation, patientId: patient.id, mrn: patient.mrn });
  } catch (err) {
    console.error("kiosk intake error", err);
    return NextResponse.json({ error: "Could not submit intake. Please ask the front desk for help." }, { status: 500 });
  }
}
