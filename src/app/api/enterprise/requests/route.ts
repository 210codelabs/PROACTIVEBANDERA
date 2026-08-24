import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { serviceByKey } from "@/lib/enterprise/catalog";

export const runtime = "nodejs";

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

export async function GET() {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await db.enterpriseServiceRequest.findMany({ where: { enterpriseId: s.enterpriseId }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ requests });
}

const Body = z.object({
  employeeFirstName: z.string().min(1),
  employeeLastName: z.string().min(1),
  employeeDob: z.string().optional().nullable(),
  employeeEmail: z.string().optional().nullable(),
  employeePhone: z.string().optional().nullable(),
  serviceKey: z.string().min(1),
  priority: z.enum(["routine", "urgent"]).optional(),
  dueDate: z.string().optional().nullable(),
  consentEmployee: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  const b = parse.data;
  const svc = serviceByKey(b.serviceKey);
  const serviceLabel = svc?.label || b.serviceKey;

  // Register the employee in the general patient charts, linked to this request.
  let patientId: string | null = null;
  try {
    const dob = b.employeeDob ? new Date(b.employeeDob) : new Date("1900-01-01");
    let mrn = nextMrn();
    let guard = 0;
    while (await db.patient.findFirst({ where: { mrn }, select: { id: true } })) { mrn = nextMrn(); if (++guard > 8) break; }
    const patient = await db.patient.create({
      data: {
        mrn,
        firstName: b.employeeFirstName,
        lastName: b.employeeLastName,
        dob,
        sex: "X",
        email: b.employeeEmail || null,
        phone: b.employeePhone || null,
        patientType: "clinical",
        status: "active",
      },
    });
    patientId = patient.id;
  } catch {
    // If chart creation fails, still record the request (clinic can link later).
  }

  const consentSigned = !!(b.consentEmployee && b.consentEmployee.trim());
  const request = await db.enterpriseServiceRequest.create({
    data: {
      enterpriseId: s.enterpriseId,
      patientId,
      employeeFirstName: b.employeeFirstName,
      employeeLastName: b.employeeLastName,
      employeeDob: b.employeeDob ? new Date(b.employeeDob) : null,
      employeeEmail: b.employeeEmail || null,
      employeePhone: b.employeePhone || null,
      serviceKey: b.serviceKey,
      serviceLabel,
      priority: b.priority || "routine",
      dueDate: b.dueDate ? new Date(b.dueDate) : null,
      consentStatus: consentSigned ? "signed" : "pending",
      consentEmployer: s.name,
      consentEmployee: b.consentEmployee || null,
      consentSignedAt: consentSigned ? new Date() : null,
      clinicNotes: b.notes || null,
      createdByName: s.name,
    },
  });
  return NextResponse.json({ ok: true, request });
}
