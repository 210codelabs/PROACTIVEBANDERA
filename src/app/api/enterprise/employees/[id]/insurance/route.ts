import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee, logChartWrite } from "@/lib/enterprise/scope";

export const runtime = "nodejs";

const Body = z.object({
  insurerName: z.string().optional().nullable(),
  insurerPlan: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  groupNumber: z.string().optional().nullable(),
  payerId: z.string().optional().nullable(),
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
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const b = parse.data;
  const acct = await db.enterpriseAccount.findUnique({ where: { id: emp.enterpriseId } });
  await db.patient.update({
    where: { id: emp.patientId },
    data: {
      insurerName: b.insurerName ?? undefined, insurerPlan: b.insurerPlan ?? undefined,
      memberId: b.memberId ?? undefined, groupNumber: b.groupNumber ?? undefined, payerId: b.payerId ?? undefined,
    },
  });
  await logChartWrite({ s, patientId: emp.patientId, companyName: acct?.companyName || s.companyName, field: "insurance", detail: `${b.insurerName || ""} ${b.memberId || ""}`.trim() });
  return NextResponse.json({ ok: true });
}
