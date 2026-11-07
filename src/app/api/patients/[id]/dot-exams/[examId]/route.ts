import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { computeDerived, outcomeFromFlags } from "@/lib/dot/apply";
import { syncDotExamToChart } from "@/lib/enterprise/chartSync";

export const runtime = "nodejs";

const HistoryItem = z.object({ yes: z.boolean().optional(), detail: z.string().max(4000).optional() }).strict();
const Body = z.object({
  driverInfo: z.object({ medications: z.string().max(5000).optional(), diabetesTreatment: z.string().max(100).optional() }).strict().optional(),
  vitals: z.object({ heightIn: z.number().positive().max(120).optional(), weightLb: z.number().positive().max(1000).optional(), bpSystolic: z.number().int().positive().max(400).optional(), bpDiastolic: z.number().int().positive().max(300).optional(), pulse: z.number().int().positive().max(300).optional() }).strict().optional(),
  vision: z.object({ acuityRightUncorrected: z.string().max(20).optional(), acuityLeftUncorrected: z.string().max(20).optional(), acuityBothUncorrected: z.string().max(20).optional(), acuityRightCorrected: z.string().max(20).optional(), acuityLeftCorrected: z.string().max(20).optional(), acuityBothCorrected: z.string().max(20).optional(), fieldRightDeg: z.number().min(0).max(180).optional(), fieldLeftDeg: z.number().min(0).max(180).optional(), colorPass: z.boolean().optional() }).strict().optional(),
  hearing: z.object({ whisperRightFt: z.number().min(0).max(100).optional(), whisperLeftFt: z.number().min(0).max(100).optional(), dbLossBetterEar: z.number().min(0).max(200).optional() }).strict().optional(),
  urinalysis: z.object({ spGravity: z.string().max(20).optional(), protein: z.string().max(100).optional(), blood: z.string().max(100).optional(), sugar: z.string().max(100).optional() }).strict().optional(),
  physicalExam: z.record(z.string(), z.object({ abnormal: z.boolean(), notes: z.string().max(4000).optional() }).strict()).optional(),
  determinationFlags: z.object({ meetsStandards: z.boolean().optional(), meetsWithExemption: z.boolean().optional(), doesNotMeet: z.boolean().optional(), temporarilyDisqualified: z.boolean().optional(), incomplete: z.boolean().optional() }).strict().optional(),
  certMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).nullable().optional(),
  restrictions: z.array(z.enum(["corrective_lenses", "hearing_aid", "spe", "driving_exempt_intracity", "vision_exemption", "diabetes_exemption", "monitor_bp"])).optional(),
  examDate: z.string().date().optional(),
}).strict();

async function getScoped(patientId: string, examId: string) {
  const exam = await db.dotExam.findUnique({ where: { id: examId } });
  if (!exam || exam.patientId !== patientId) return null;
  return exam;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; examId: string }> }) {
  const user = await requireSession();
  if (!["provider", "admin"].includes(user.role)) return NextResponse.json({ error: "Provider or administrator access is required." }, { status: 403 });
  const { id, examId } = await params;
  const exam = await getScoped(id, examId);
  if (!exam) return NextResponse.json({ error: "DOT examination not found." }, { status: 404 });
  const examiner = user.role === "provider" ? await db.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, lastName: true, fmcsaExaminerVerified: true, fmcsaNrcmeNumber: true },
  }) : null;
  return NextResponse.json({ exam, examiner: examiner ? { ...examiner, displayName: `${examiner.firstName} ${examiner.lastName}`.trim() } : null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; examId: string }> }) {
  const user = await requireSession();
  if (!["provider", "admin"].includes(user.role)) return NextResponse.json({ error: "Provider or administrator access is required." }, { status: 403 });
  const { id, examId } = await params;
  const exam = await getScoped(id, examId);
  if (!exam) return NextResponse.json({ error: "DOT examination not found." }, { status: 404 });
  if (exam.isLocked || exam.signedAt) return NextResponse.json({ error: "This examination is signed and locked. Amend it through the authorized amendment workflow." }, { status: 409 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid examination data." }, { status: 400 });
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.driverInfo) data.driverInfo = { ...(exam.driverInfo as Record<string, unknown> || {}), ...parsed.data.driverInfo };
  if (parsed.data.examDate) data.examDate = new Date(`${parsed.data.examDate}T12:00:00.000Z`);

  const merged = { ...exam, ...data };
  const derived = computeDerived(merged);
  data.alerts = derived.alerts;
  data.additionalFormsRequired = derived.additionalFormsRequired;
  data.bpCategory = derived.bpCategory;
  data.expiresOn = derived.expiresOn;
  const outcome = outcomeFromFlags(merged.determinationFlags);
  if (outcome) data.outcome = outcome;
  if (Object.keys(parsed.data).some((key) => key !== "examDate")) data.status = exam.driverSignedAt ? "exam_pending" : "driver_pending";

  const updated = await db.dotExam.update({ where: { id: exam.id }, data });
  await db.auditLog.create({ data: { userId: user.id, action: "update", resource: "DotExam", resourceId: exam.id } });
  await syncDotExamToChart(updated).catch(() => {});
  return NextResponse.json({ ok: true, exam: updated, suggestedCertMonths: derived.suggestedCertMonths });
}