import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { computeDerived, outcomeFromFlags } from "@/lib/dot/apply";

export const runtime = "nodejs";

async function scopedExam(id: string) {
  const s = await getEnterpriseSession();
  if (!s) return { error: "Unauthorized", status: 401 as const };
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam) return { error: "Not found", status: 404 as const };
  if (s.role !== "super_admin" && exam.enterpriseId !== s.enterpriseId) return { error: "Not found", status: 404 as const };
  return { s, exam };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await scopedExam(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ exam: r.exam });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await scopedExam(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const body = await req.json().catch(() => ({}));

  const FIELDS = [
    "driverInfo", "healthHistory", "driverSignature",
    "vitals", "vision", "hearing", "urinalysis", "physicalExam",
    "certMonths", "restrictions", "determinationFlags",
    "examinerName", "examinerNrcme", "examinerLicense", "examinerLicenseState", "examinerSignature",
  ] as const;
  const data: any = {};
  for (const f of FIELDS) if (f in body) data[f] = body[f];
  if ("examDate" in body) data.examDate = body.examDate ? new Date(body.examDate) : null;
  if ("driverSignedAt" in body || "driverSignature" in body) {
    if (body.driverSignature) data.driverSignedAt = new Date();
  }

  // Merge current + incoming for derivation.
  const merged: any = { ...r.exam, ...data };
  const derived = computeDerived(merged);
  data.alerts = derived.alerts;
  data.additionalFormsRequired = derived.additionalFormsRequired;
  data.bpCategory = derived.bpCategory;
  data.expiresOn = derived.expiresOn;

  // Status / outcome transitions.
  const oc = outcomeFromFlags(merged.determinationFlags);
  if (oc) data.outcome = oc;
  if (merged.determinationFlags && (merged.examinerName || data.examinerName)) {
    data.status = "completed";
  } else if (merged.driverSignature) {
    data.status = merged.status === "completed" ? "completed" : "exam_pending";
  }
  if (data.outcome && data.outcome !== "pending" && data.outcome !== "incomplete") {
    data.transmissionStatus = r.exam.transmissionStatus === "exported" ? "exported" : "ready";
  }

  const exam = await db.dotExam.update({ where: { id }, data });
  return NextResponse.json({ ok: true, exam, suggestedCertMonths: derived.suggestedCertMonths });
}
