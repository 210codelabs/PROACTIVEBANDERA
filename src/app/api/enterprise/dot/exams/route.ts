import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { resolveEnterpriseId, getScopedEmployee } from "@/lib/enterprise/scope";
import { ensureEmployeeChart } from "@/lib/enterprise/chartSync";
import { employerDotExamSummary } from "@/lib/dot/access";

export const runtime = "nodejs";

// GET /api/enterprise/dot/exams?enterpriseId=&employeeId=  -> list DOT exams
export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const entId = resolveEnterpriseId(s, url.searchParams.get("enterpriseId"));
  if (!entId) return NextResponse.json({ error: "Select a company" }, { status: 400 });
  const where: any = { enterpriseId: entId };
  const employeeId = url.searchParams.get("employeeId");
  if (employeeId) where.employeeId = employeeId;
  const exams = await db.dotExam.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  if (s.role === "super_admin") return NextResponse.json({ exams });
  const employeeIds = [...new Set(exams.map((exam) => exam.employeeId).filter((value): value is string => Boolean(value)))];
  const authorizations = employeeIds.length ? await db.enterpriseConsent.findMany({
    where: { enterpriseId: entId, employeeId: { in: employeeIds }, formKey: "dot_mec_release", status: "signed" },
    select: { employeeId: true, patientId: true },
  }) : [];
  const authorized = new Set(authorizations.map((consent) => `${consent.employeeId}:${consent.patientId || ""}`));
  return NextResponse.json({ exams: exams.map((exam) => employerDotExamSummary(exam, Boolean(exam.employeeId && authorized.has(`${exam.employeeId}:${exam.patientId || ""}`)))) });
}

const Body = z.object({
  enterpriseId: z.string().optional().nullable(),
  employeeId: z.string().min(1),
  dotReason: z.string().optional(),
  carrier: z.any().optional(),
});

// POST /api/enterprise/dot/exams  -> create a new DOT exam for an employee
export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  const b = parse.data;
  const scoped = await getScopedEmployee(s, b.employeeId, b.enterpriseId);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  const patientId = await ensureEmployeeChart(emp);
  const exam = await db.dotExam.create({
    data: {
      enterpriseId: emp.enterpriseId,
      employeeId: emp.id,
      patientId,
      driverName: `${emp.firstName} ${emp.lastName}`.trim(),
      status: "driver_pending",
      kioskToken: randomUUID(),
      driverInfo: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        dob: emp.dob ? new Date(emp.dob).toISOString().slice(0, 10) : "",
        phone: emp.phone || "",
        email: emp.email || "",
        dotReason: b.dotReason || "Certification",
      },
      carrier: b.carrier || undefined,
      createdByName: s.name,
    },
  });
  await db.enterpriseConsent.create({
    data: {
      enterpriseId: emp.enterpriseId,
      employeeId: emp.id,
      patientId: exam.patientId,
      formKey: "dot_mec_release",
      formTitle: "DOT Medical Examiner's Certificate Release Authorization",
      signerRole: "employee",
      status: "pending",
      createdByName: s.name,
    },
  });
  return NextResponse.json({ ok: true, exam });
}
