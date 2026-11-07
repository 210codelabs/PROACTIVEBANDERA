import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeSession } from "@/lib/employeeAuth";

export const runtime = "nodejs";

// An employee may download only: (a) clinic result docs tied to their own
// requests, or (b) signed consent PDFs generated for them.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEmployeeSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.enterpriseDocument.findUnique({ where: { id } });
  if (!doc || doc.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = false;
  // (a) result docs for their requests
  if (doc.requestId && s.patientId) {
    const r = await db.enterpriseServiceRequest.findUnique({ where: { id: doc.requestId } });
    if (r && r.patientId === s.patientId) allowed = true;
  }
  // (b) their signed consent PDFs
  if (!allowed) {
    const c = await db.enterpriseConsent.findFirst({ where: { employeeId: s.employeeId, documentId: id } });
    if (c) allowed = true;
  }
  if (!allowed) {
    const exam = await db.dotExam.findFirst({
      where: { employerMecDocId: id, employeeId: s.employeeId, enterpriseId: s.enterpriseId },
    });
    if (exam?.mecIssuedAt) {
      const authorization = await db.enterpriseConsent.findFirst({
        where: { enterpriseId: s.enterpriseId, employeeId: s.employeeId, patientId: exam.patientId || undefined, formKey: "dot_mec_release", status: "signed" },
        select: { id: true },
      });
      if (authorization) allowed = true;
    }
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = Buffer.from(doc.dataBase64, "base64");
  await db.auditLog.create({ data: { action: "download", resource: "DotMECEmployee", resourceId: id } }).catch(() => {});
  return new NextResponse(buf, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
