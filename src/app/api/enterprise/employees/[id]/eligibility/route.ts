import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { getScopedEmployee } from "@/lib/enterprise/scope";
import { checkEligibility, getStediConfig } from "@/lib/stedi";

export const runtime = "nodejs";

// GET -> latest saved eligibility for the employee's chart (read-only)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id, new URL(req.url).searchParams.get("enterpriseId"));
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  if (!emp.patientId) return NextResponse.json({ checks: [] });
  const checks = await db.eligibilityCheck.findMany({ where: { patientId: emp.patientId }, orderBy: { createdAt: "desc" }, take: 10 });
  return NextResponse.json({ checks });
}

// POST -> run a real-time eligibility check against the employee's insurance on
// the linked chart. Read-only w.r.t. patient coverage (only writes an
// EligibilityCheck record, never modifies the patient's stored insurance).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const scoped = await getScopedEmployee(s, id);
  if ("error" in scoped) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const emp = scoped.employee;
  if (!emp.patientId) return NextResponse.json({ error: "Employee has no linked chart" }, { status: 400 });

  const cfg = await getStediConfig();
  if (!cfg.apiKey) return NextResponse.json({ error: "Eligibility is not configured. Ask the clinic to set up the Stedi integration." }, { status: 400 });

  const p = await db.patient.findUnique({ where: { id: emp.patientId } });
  if (!p) return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  const payerId = p.payerId || "";
  if (!payerId) return NextResponse.json({ error: "Add insurance (with a payer) to this employee before checking eligibility." }, { status: 400 });

  try {
    const result = await checkEligibility({
      payerId,
      memberId: p.memberId || undefined,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dob,
    });
    const saved = await db.eligibilityCheck.create({
      data: {
        patientId: p.id, patientName: `${p.lastName}, ${p.firstName}`, payerId,
        payerName: result.payerName || p.insurerName || null, memberId: p.memberId || null,
        status: result.status, planName: result.planName || null,
        summary: result.summary as any, raw: result.raw as any,
        checkedByName: `${s.name} (Enterprise Portal)`,
      },
    });
    return NextResponse.json({ ok: true, status: result.status, planName: result.planName, payerName: result.payerName, summary: result.summary, checkId: saved.id });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 200 });
  }
}
