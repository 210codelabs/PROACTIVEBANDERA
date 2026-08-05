import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const CAN_EDIT = ["admin", "provider", "nurse", "frontdesk"];
const CAN_ARCHIVE = ["admin", "frontdesk", "provider"];
const CAN_DELETE = ["admin"];

const EDITABLE = [
  "firstName", "lastName", "sex", "pronouns", "email", "phone",
  "addressLine1", "addressLine2", "city", "state", "postalCode", "country",
  "preferredLang", "ethnicity", "race", "maritalStatus",
  "insurerName", "insurerPlan", "memberId", "groupNumber",
  "ecName", "ecRelation", "ecPhone",
];
const VALID_STATUS = ["active", "inactive", "archived", "deceased"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ patient });
}

// Update demographics and/or change status (archive / reactivate).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const existing = await db.patient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, any> = {};
  let touchesFields = false;
  for (const f of EDITABLE) {
    if (f in body) {
      const v = body[f];
      data[f] = typeof v === "string" ? v.trim() || null : v;
      touchesFields = true;
    }
  }
  if ("dob" in body && body.dob) {
    const d = new Date(body.dob);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid date of birth." }, { status: 400 });
    data.dob = d;
    touchesFields = true;
  }

  let touchesStatus = false;
  if ("status" in body) {
    if (!VALID_STATUS.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    data.status = body.status;
    touchesStatus = true;
  }

  // role checks
  if (touchesFields && !CAN_EDIT.includes(user.role)) {
    return NextResponse.json({ error: "Your role cannot edit patient records." }, { status: 403 });
  }
  if (touchesStatus && !CAN_ARCHIVE.includes(user.role)) {
    return NextResponse.json({ error: "Your role cannot change patient status." }, { status: 403 });
  }
  if (touchesFields && data.firstName === null) return NextResponse.json({ error: "First name is required." }, { status: 400 });
  if (touchesFields && data.lastName === null) return NextResponse.json({ error: "Last name is required." }, { status: 400 });
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const patient = await db.patient.update({ where: { id }, data });
  return NextResponse.json({ ok: true, patient });
}

// Hard delete (admin only) — removes patient and dependent records.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_DELETE.includes(user.role)) {
    return NextResponse.json({ error: "Only an administrator can permanently delete a patient. Consider archiving instead." }, { status: 403 });
  }
  const { id } = await params;
  const existing = await db.patient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await db.$transaction([
      db.document.deleteMany({ where: { patientId: id } }),
      db.order.deleteMany({ where: { patientId: id } }),
      db.encounter.deleteMany({ where: { patientId: id } }),
      db.appointment.deleteMany({ where: { patientId: id } }),
      db.problem.deleteMany({ where: { patientId: id } }),
      db.allergy.deleteMany({ where: { patientId: id } }),
      db.medication.deleteMany({ where: { patientId: id } }),
      db.vital.deleteMany({ where: { patientId: id } }),
      db.immunization.deleteMany({ where: { patientId: id } }),
      db.message.deleteMany({ where: { patientId: id } }),
      db.careTeamMember.deleteMany({ where: { patientId: id } }),
      db.legalCase.deleteMany({ where: { patientId: id } }),
      db.patient.delete({ where: { id } }),
    ]);
  } catch (e) {
    console.error("patient delete error", e);
    return NextResponse.json({ error: "Could not delete patient. Try archiving instead." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
