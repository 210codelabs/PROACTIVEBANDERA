import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Sample clinical records are disabled in production." }, { status: 403 });
  const admin = await requireAdminSession();
  const token = randomUUID();
  const patient = await db.patient.create({
    data: {
      mrn: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`,
      firstName: "Sample",
      lastName: "DOT Driver",
      dob: new Date("1985-01-15T12:00:00.000Z"),
      sex: "X",
      email: `sample.dot.${token.slice(0, 8)}@example.test`,
      phone: "555-0100",
      addressLine1: "100 Example Road",
      city: "Example City",
      state: "TX",
      postalCode: "78000",
      patientType: "dot",
      dotRegistration: {
        licenseNumber: `SAMPLE-${token.slice(0, 8).toUpperCase()}`,
        licenseState: "TX",
        hasCdl: "yes",
        cdlClass: "A",
        examReason: "certification",
        paymentResponsibility: "self_pay",
      },
    },
  });
  const exam = await db.dotExam.create({
    data: {
      patientId: patient.id,
      driverName: `${patient.firstName} ${patient.lastName}`,
      status: "driver_pending",
      driverInfo: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: "1985-01-15",
        phone: patient.phone,
        email: patient.email,
        address: patient.addressLine1,
        city: patient.city,
        zip: patient.postalCode,
        licenseNumber: `SAMPLE-${token.slice(0, 8).toUpperCase()}`,
        licenseState: "TX",
        hasCdl: true,
        cdlClass: "A",
        dotReason: "Certification",
        paymentResponsibility: "self_pay",
        medications: "",
      },
      kioskToken: token,
      createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  });
  await db.auditLog.create({ data: { userId: admin.id, action: "create_sample", resource: "DotExam", resourceId: exam.id } });
  return NextResponse.json({ ok: true, patientId: patient.id, examId: exam.id });
}