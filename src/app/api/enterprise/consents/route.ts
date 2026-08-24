import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { resolveEnterpriseId, getScopedEmployee } from "@/lib/enterprise/scope";
import { formByKey } from "@/lib/enterprise/forms";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId");
  const entId = resolveEnterpriseId(s, url.searchParams.get("enterpriseId"));
  if (!entId) return NextResponse.json({ error: "Select a company" }, { status: 400 });
  const where: any = { enterpriseId: entId };
  if (employeeId) where.employeeId = employeeId;
  const consents = await db.enterpriseConsent.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ consents });
}

const Body = z.object({
  enterpriseId: z.string().optional().nullable(),
  employeeId: z.string().min(1),
  formKey: z.string().min(1),
});

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "employeeId and formKey are required" }, { status: 400 });
  const b = parse.data;
  const tpl = formByKey(b.formKey);
  if (!tpl) return NextResponse.json({ error: "Unknown form" }, { status: 400 });
  const scoped = await getScopedEmployee(s, b.employeeId, b.enterpriseId);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  const consent = await db.enterpriseConsent.create({
    data: {
      enterpriseId: emp.enterpriseId, employeeId: emp.id, patientId: emp.patientId,
      formKey: tpl.key, formTitle: tpl.title, signerRole: tpl.signerRole, status: "pending", createdByName: s.name,
    },
  });
  return NextResponse.json({ ok: true, consent });
}
