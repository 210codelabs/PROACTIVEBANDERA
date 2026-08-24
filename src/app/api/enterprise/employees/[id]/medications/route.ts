import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee, logChartWrite } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1),
  strength: z.string().optional().nullable(),
  form: z.string().optional().nullable(),
  sig: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
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
  if (!parse.success) return NextResponse.json({ error: "Medication name is required" }, { status: 400 });
  const b = parse.data;
  const acct = await db.enterpriseAccount.findUnique({ where: { id: emp.enterpriseId } });
  const stamp = await logChartWrite({ s, patientId: emp.patientId, companyName: acct?.companyName || s.companyName, field: "medication", detail: b.name });
  const med = await db.medication.create({
    data: {
      patientId: emp.patientId, name: b.name, strength: b.strength || null, form: b.form || null,
      sig: b.sig || null, route: b.route || null, frequency: b.frequency || null, ndc: b.ndc || null,
      status: "active", source: "enterprise-portal", notes: stamp,
    },
  });
  return NextResponse.json({ ok: true, medication: med });
}
