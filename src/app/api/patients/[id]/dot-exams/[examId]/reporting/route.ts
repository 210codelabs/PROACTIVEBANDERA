import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({ confirmed: z.literal(true), reference: z.string().max(200).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; examId: string }> }) {
  const session = await requireSession();
  if (session.role !== "provider") return NextResponse.json({ error: "Only an authorized examiner can record FMCSA reporting." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Confirm the external FMCSA submission first." }, { status: 400 });

  const { id, examId } = await params;
  const [exam, examiner] = await Promise.all([
    db.dotExam.findUnique({ where: { id: examId } }),
    db.user.findUnique({ where: { id: session.id }, select: { fmcsaExaminerVerified: true } }),
  ]);
  if (!exam || exam.patientId !== id) return NextResponse.json({ error: "DOT examination not found." }, { status: 404 });
  if (!exam.isLocked || !exam.signedAt) return NextResponse.json({ error: "Only signed and locked examinations can be reported." }, { status: 409 });
  if (!examiner?.fmcsaExaminerVerified || exam.signedByUserId !== session.id) return NextResponse.json({ error: "The reporting examiner must be the verified provider who signed this examination." }, { status: 403 });

  const reportedAt = new Date();
  const result = await db.dotExam.updateMany({
    where: { id: exam.id, isLocked: true, signedByUserId: session.id },
    data: { reportingStatus: "reported", reportedAt, reportedByUserId: session.id, reportingReference: parsed.data.reference?.trim() || null },
  });
  if (!result.count) return NextResponse.json({ error: "Reporting status could not be updated." }, { status: 409 });
  await db.auditLog.create({ data: { userId: session.id, action: "confirm_external_report", resource: "DotExam", resourceId: exam.id } });
  return NextResponse.json({ ok: true, reportingStatus: "reported", reportedAt, reference: parsed.data.reference?.trim() || null });
}