import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
  return NextResponse.json({ ok: true, confirmation: created.confirmation, priorityCheckin });
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
