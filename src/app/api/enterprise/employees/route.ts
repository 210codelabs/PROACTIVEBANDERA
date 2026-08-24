import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { resolveEnterpriseId } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

function nextMrn() { return `PC-${Math.floor(100000 + Math.random() * 900000)}`; }

export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const entId = resolveEnterpriseId(s, url.searchParams.get("enterpriseId"));
  if (!entId) return NextResponse.json({ error: "Select a company" }, { status: 400 });
  const employees = await db.enterpriseEmployee.findMany({ where: { enterpriseId: entId }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ employees });
}

const Body = z.object({
  enterpriseId: z.string().optional().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().optional().nullable(),
  sex: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  employeeNo: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  const b = parse.data;
  const entId = resolveEnterpriseId(s, b.enterpriseId);
  if (!entId) return NextResponse.json({ error: "Select a company" }, { status: 400 });
  const acct = await db.enterpriseAccount.findUnique({ where: { id: entId } });
  if (!acct) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Create the linked EMR patient chart (a real clinical patient).
  let patientId: string | null = null;
  try {
    const dob = b.dob ? new Date(b.dob) : new Date("1900-01-01");
    let mrn = nextMrn(); let guard = 0;
    while (await db.patient.findFirst({ where: { mrn }, select: { id: true } })) { mrn = nextMrn(); if (++guard > 8) break; }
    const p = await db.patient.create({
      data: {
        mrn, firstName: b.firstName, lastName: b.lastName, dob, sex: b.sex || "X",
        email: b.email || null, phone: b.phone || null, patientType: "clinical", status: "active",
      },
    });
    patientId = p.id;
    await db.auditLog.create({ data: { action: "enterprise.employee.create", resource: "Patient", resourceId: p.id, meta: JSON.stringify({ company: acct.companyName, by: s.name }) } }).catch(() => {});
  } catch { /* still record the employee */ }

  const emp = await db.enterpriseEmployee.create({
    data: {
      enterpriseId: entId, patientId,
      firstName: b.firstName, lastName: b.lastName,
      dob: b.dob ? new Date(b.dob) : null, sex: b.sex || "X",
      email: b.email || null, phone: b.phone || null,
      employeeNo: b.employeeNo || null, department: b.department || null, jobTitle: b.jobTitle || null,
      createdByName: s.name,
    },
  });
  return NextResponse.json({ ok: true, employee: emp });
}
