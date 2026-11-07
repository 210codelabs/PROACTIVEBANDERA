import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  examReason: z.enum(["certification", "renewal", "follow_up", "return_to_duty"]).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid examination reason" }, { status: 400 });

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  const registration = patient.dotRegistration && typeof patient.dotRegistration === "object"
    ? patient.dotRegistration as Record<string, unknown>
    : {};
  const reason = body.data.examReason || String(registration.examReason || "certification");
  const exam = await db.dotExam.create({
    data: {
      patientId: patient.id,
      driverName: `${patient.firstName} ${patient.lastName}`.trim(),
      status: "driver_pending",
      kioskToken: randomUUID(),
      driverInfo: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob.toISOString().slice(0, 10),
        phone: patient.phone || "",
        email: patient.email || "",
        address: [patient.addressLine1, patient.addressLine2].filter(Boolean).join(" "),
        city: patient.city || "",
        zip: patient.postalCode || "",
        licenseNumber: String(registration.licenseNumber || ""),
        licenseState: String(registration.licenseState || ""),
        hasCdl: registration.hasCdl === "yes",
        cdlClass: String(registration.cdlClass || ""),
        dotReason: reason,
        employerName: String(registration.employerName || ""),
        paymentResponsibility: String(registration.paymentResponsibility || "self_pay"),
      },
      createdByName: `${user.firstName} ${user.lastName}`.trim(),
    },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "create", resource: "DotExam", resourceId: exam.id },
  });
  return NextResponse.json({
    ok: true,
    exam: { id: exam.id, status: exam.status, outcome: exam.outcome, examDate: exam.examDate, expiresOn: exam.expiresOn, createdAt: exam.createdAt, kioskToken: exam.kioskToken },
  });
}