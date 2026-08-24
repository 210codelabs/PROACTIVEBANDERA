import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id, new URL(req.url).searchParams.get("enterpriseId"));
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;

  let chart: any = null;
  if (emp.patientId) {
    const p = await db.patient.findUnique({ where: { id: emp.patientId } });
    if (p) {
      const [medications, careTeam, eligibility, consents] = await Promise.all([
        db.medication.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        db.careTeamMember.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        db.eligibilityCheck.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, take: 10 }),
        db.enterpriseConsent.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      ]);
      chart = {
        mrn: p.mrn,
        insurance: { insurerName: p.insurerName, insurerPlan: p.insurerPlan, memberId: p.memberId, groupNumber: p.groupNumber, payerId: p.payerId },
        medications, referrals: careTeam, eligibility, consents,
      };
    }
  }
  if (!chart) {
    const consents = await db.enterpriseConsent.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" }, take: 50 });
    chart = { insurance: {}, medications: [], referrals: [], eligibility: [], consents };
  }
  return NextResponse.json({ employee: emp, chart });
}

const Patch = z.object({
  firstName: z.string().optional(), lastName: z.string().optional(), dob: z.string().optional().nullable(),
  email: z.string().optional().nullable(), phone: z.string().optional().nullable(),
  employeeNo: z.string().optional().nullable(), department: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(), status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const parse = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const b = parse.data;
  const data: any = {};
  for (const k of ["firstName", "lastName", "email", "phone", "employeeNo", "department", "jobTitle", "status"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.dob !== undefined) data.dob = b.dob ? new Date(b.dob) : null;
  const emp = await db.enterpriseEmployee.update({ where: { id }, data });
  // keep the linked chart demographics loosely in sync
  if (emp.patientId) {
    const pd: any = {};
    if (b.firstName) pd.firstName = b.firstName;
    if (b.lastName) pd.lastName = b.lastName;
    if (b.email !== undefined) pd.email = b.email || null;
    if (b.phone !== undefined) pd.phone = b.phone || null;
    if (Object.keys(pd).length) await db.patient.update({ where: { id: emp.patientId }, data: pd }).catch(() => {});
  }
  return NextResponse.json({ ok: true, employee: emp });
}
