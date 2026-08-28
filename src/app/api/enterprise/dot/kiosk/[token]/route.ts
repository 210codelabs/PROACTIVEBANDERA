import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeDerived } from "@/lib/dot/apply";

export const runtime = "nodejs";

// PUBLIC kiosk endpoint (tablet at the clinic). Access is via an unguessable
// one-time kioskToken embedded in the URL — no login. Only the driver
// health-history section is exposed; examiner data is never returned here.
async function byToken(token: string) {
  if (!token) return null;
  const exam = await db.dotExam.findFirst({ where: { kioskToken: token } });
  return exam;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const exam = await byToken(token);
  if (!exam) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  return NextResponse.json({
    exam: {
      id: exam.id,
      status: exam.status,
      driverName: exam.driverName,
      driverInfo: exam.driverInfo,
      healthHistory: exam.healthHistory,
      alreadySigned: Boolean(exam.driverSignedAt),
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const exam = await byToken(token);
  if (!exam) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (!body.driverSignature) return NextResponse.json({ error: "A signature is required to submit." }, { status: 400 });

  const driverInfo = { ...(exam.driverInfo as any || {}), ...(body.driverInfo || {}) };
  const merged: any = { ...exam, driverInfo, healthHistory: body.healthHistory || exam.healthHistory };
  const derived = computeDerived(merged);

  await db.dotExam.update({
    where: { id: exam.id },
    data: {
      driverInfo,
      healthHistory: body.healthHistory ?? exam.healthHistory ?? undefined,
      driverSignature: String(body.driverSignature),
      driverSignedAt: new Date(),
      status: exam.status === "completed" ? "completed" : "exam_pending",
      alerts: derived.alerts,
      additionalFormsRequired: derived.additionalFormsRequired,
      bpCategory: derived.bpCategory,
      // Invalidate the one-time kiosk link after submission.
      kioskToken: null,
    },
  });
  return NextResponse.json({ ok: true });
}
