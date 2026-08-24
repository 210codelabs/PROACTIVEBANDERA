import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee, logChartWrite } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1),
  specialty: z.string().optional().nullable(),
  npi: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  if (!emp.patientId) return NextResponse.json({ error: "Employee has no linked chart" }, { status: 400 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Referral provider name is required" }, { status: 400 });
  const b = parse.data;
  const acct = await db.enterpriseAccount.findUnique({ where: { id: emp.enterpriseId } });
  await logChartWrite({ s, patientId: emp.patientId, companyName: acct?.companyName || s.companyName, field: "referral", detail: `${b.name}${b.specialty ? " - " + b.specialty : ""}` });
  const ctm = await db.careTeamMember.create({
    data: {
      patientId: emp.patientId, name: b.name, specialty: b.specialty || null, npi: b.npi || null,
      phone: b.phone || null, address: b.address || null, role: "Referring", source: "enterprise-portal",
    },
  });
  return NextResponse.json({ ok: true, referral: ctm });
}
