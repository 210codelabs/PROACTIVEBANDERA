import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeSession } from "@/lib/employeeAuth";
import { computeDerived } from "@/lib/dot/apply";
import { syncDotExamToChart } from "@/lib/enterprise/chartSync";

export const runtime = "nodejs";

async function scoped(id: string) {
  const s = await getEmployeeSession();
  if (!s) return { error: "Unauthorized", status: 401 as const };
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam || exam.employeeId !== s.employeeId) return { error: "Not found", status: 404 as const };
  return { s, exam };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await scoped(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const e = r.exam;
  return NextResponse.json({ exam: { id: e.id, status: e.status, driverName: e.driverName, driverInfo: e.driverInfo, healthHistory: e.healthHistory, driverSignedAt: e.driverSignedAt } });
}

// POST -> driver submits health-history questionnaire + signature.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await scoped(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const body = await req.json().catch(() => ({}));
  if (!body.driverSignature) return NextResponse.json({ error: "A signature is required to submit." }, { status: 400 });

  const driverInfo = { ...(r.exam.driverInfo as any || {}), ...(body.driverInfo || {}) };
  const merged: any = { ...r.exam, driverInfo, healthHistory: body.healthHistory || r.exam.healthHistory };
  const derived = computeDerived(merged);

  const exam = await db.dotExam.update({
    where: { id },
    data: {
      driverInfo,
      healthHistory: body.healthHistory ?? r.exam.healthHistory ?? undefined,
      driverSignature: String(body.driverSignature),
      driverSignedAt: new Date(),
      status: r.exam.status === "completed" ? "completed" : "exam_pending",
      alerts: derived.alerts,
      additionalFormsRequired: derived.additionalFormsRequired,
      bpCategory: derived.bpCategory,
    },
  });
  await syncDotExamToChart(exam).catch(() => {});
  return NextResponse.json({ ok: true, exam: { id: exam.id, status: exam.status } });
}
