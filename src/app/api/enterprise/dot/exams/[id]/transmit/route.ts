import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { buildExamPayload } from "@/lib/dot/export";

export const runtime = "nodejs";

// POST /api/enterprise/dot/exams/:id/transmit
// Builds the National Registry (NRCME) data payload and stages it. FMCSA has NO
// public submission API — the certified examiner reports on the FMCSA portal.
// This marks the exam as "exported" and stores the JSON/XML for the examiner.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin" && exam.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (exam.status !== "completed" || exam.outcome === "pending") {
    return NextResponse.json({ error: "Complete the examiner determination before exporting to the National Registry." }, { status: 400 });
  }

  const payload = buildExamPayload(exam);
  const updated = await db.dotExam.update({
    where: { id },
    data: { transmissionStatus: "exported", transmittedAt: new Date(), transmitPayload: payload.json as any },
  });
  return NextResponse.json({
    ok: true,
    status: updated.transmissionStatus,
    note: "National Registry data package generated. FMCSA does not provide a public submission API; the certified medical examiner must file the result in the FMCSA National Registry portal.",
    payload,
  });
}
