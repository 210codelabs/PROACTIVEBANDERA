import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getForm } from "@/lib/intake/forms";

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}
function confNumber() {
  return "PC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Public online intake submission. Creates/updates a patient and stores the
// completed intake as a Document on the patient chart (Documents tab).
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.slug || typeof b.values !== "object") {
      return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
    }
    const form = getForm(b.slug);
    if (!form || !form.online) {
      return NextResponse.json({ error: "This form is not available for online submission." }, { status: 400 });
    }

    const values = b.values as Record<string, any>;
    const firstName = String(values.firstName || "").trim();
    const lastName = String(values.lastName || "").trim();
    const dobRaw = values.dob ? String(values.dob).trim() : "";
    if (!firstName || !lastName || !dobRaw) {
      return NextResponse.json({ error: "First name, last name and date of birth are required." }, { status: 400 });
    }
    if (!values.signature || !String(values.signature).trim()) {
      return NextResponse.json({ error: "An electronic signature is required." }, { status: 400 });
    }

    const dob = new Date(dobRaw);
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
    }

    const email = values.email ? String(values.email).trim() : null;
    const phone = values.phone ? String(values.phone).trim() : null;
    const mrn = values.mrn ? String(values.mrn).trim() : "";

    // Find existing patient (by MRN, then email, then name+dob), else create.
    let patient: any = null;
    if (mrn) patient = await db.patient.findFirst({ where: { mrn } });
    if (!patient && email) patient = await db.patient.findFirst({ where: { email } });
    if (!patient) patient = await db.patient.findFirst({ where: { firstName, lastName, dob } });

    const isNew = !patient;
    if (!patient) {
      patient = await db.patient.create({
        data: {
          mrn: nextMrn(),
          firstName,
          lastName,
          dob,
          sex: values.sex || "U",
          email,
          phone,
          status: "active",
        },
      });
    }

    const confirmation = confNumber();
    await db.document.create({
      data: {
        patientId: patient.id,
        title: `${form.title} — Online Intake`,
        category: form.slug === "new-patient-intake" ? "intake" : "intake-followup",
        body: JSON.stringify({
          source: "online-intake",
          formSlug: form.slug,
          formTitle: form.title,
          confirmation,
          values,
          submittedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      confirmation,
      patientId: patient.id,
      mrn: patient.mrn,
      isNew,
    });
  } catch (err) {
    console.error("intake submit error", err);
    return NextResponse.json({ error: "Could not submit your intake. Please ask the front desk for help." }, { status: 500 });
  }
}
