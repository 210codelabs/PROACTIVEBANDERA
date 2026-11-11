import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "provider", "nurse", "frontdesk"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.identityReviewed !== true || body.insuranceReviewed !== true) return NextResponse.json({ error: "Identity and insurance review must be acknowledged." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const request = await tx.appointmentRequest.findUnique({ where: { id } });
      if (!request || request.patientType !== "new" || !request.matchedPatientId || !request.appointmentId || request.status === "declined") return null;
      const patient = await tx.patient.findUnique({ where: { id: request.matchedPatientId } });
      if (!patient || patient.status !== "pending-verification") return null;
      let mrn = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = `PC-${randomInt(100000, 1000000)}`;
        if (!(await tx.patient.findUnique({ where: { mrn: candidate }, select: { id: true } }))) { mrn = candidate; break; }
      }
      if (!mrn) throw new Error("Unable to assign a record number");
      await tx.patient.update({ where: { id: patient.id }, data: { mrn, status: "active" } });
      await tx.appointmentRequest.update({ where: { id }, data: { mrn, status: "confirmed" } });
      await tx.auditLog.create({ data: { userId: session.id, action: "booking.first-visit-review", resource: "Patient", resourceId: patient.id, meta: JSON.stringify({ requestId: id, identityReviewed: true, insuranceReviewed: true }) } });
      return { mrn };
    });
    if (!result) return NextResponse.json({ error: "This booking is not awaiting first-visit verification." }, { status: 409 });
    return NextResponse.json({ ok: true, mrn: result.mrn });
  } catch {
    return NextResponse.json({ error: "Verification could not be completed. Please try again." }, { status: 503 });
  }
}