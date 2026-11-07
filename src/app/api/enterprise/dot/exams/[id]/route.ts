import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { computeDerived, outcomeFromFlags } from "@/lib/dot/apply";
import { syncDotExamToChart } from "@/lib/enterprise/chartSync";
import { employerDotExamSummary } from "@/lib/dot/access";

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
  if (r.s.role === "super_admin") return NextResponse.json({ exam: r.exam });
  const authorization = await db.enterpriseConsent.findFirst({
    where: { enterpriseId: r.exam.enterpriseId || undefined, employeeId: r.exam.employeeId || undefined, patientId: r.exam.patientId || undefined, formKey: "dot_mec_release", status: "signed" },
    select: { id: true },
  });
  return NextResponse.json({ exam: employerDotExamSummary(r.exam, Boolean(authorization)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await scopedExam(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.s.role !== "super_admin") {
    return NextResponse.json({ error: "Clinical examination updates are not available to employer users." }, { status: 403 });
  }
  if (r.exam.isLocked || r.exam.signedAt) {
    return NextResponse.json({ error: "This examination is signed and locked. Use the authorized amendment workflow." }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));

  const FIELDS = [
    "driverInfo",
    "vitals", "vision", "hearing", "urinalysis", "physicalExam",
    "certMonths", "restrictions", "determinationFlags",
  ] as const;
  const data: any = {};
  for (const f of FIELDS) if (f in body) data[f] = body[f];
  if ("examDate" in body) data.examDate = body.examDate ? new Date(body.examDate) : null;
  // Merge current + incoming for derivation.
  const merged: any = { ...r.exam, ...data };
  const derived = computeDerived(merged);
  data.alerts = derived.alerts;
  data.additionalFormsRequired = derived.additionalFormsRequired;
  data.bpCategory = derived.bpCategory;
  data.expiresOn = derived.expiresOn;

  // Draft determinations do not finalize or authorize reporting.
  const oc = outcomeFromFlags(merged.determinationFlags);
  if (oc) data.outcome = oc;

  const exam = await db.dotExam.update({ where: { id }, data });
  // Real-time sync of vitals / medications into the linked EMR patient chart.
  await syncDotExamToChart(exam).catch(() => {});
  return NextResponse.json({ ok: true, exam, suggestedCertMonths: derived.suggestedCertMonths });
}
