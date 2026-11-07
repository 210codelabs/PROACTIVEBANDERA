import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.enterpriseDocument.findUnique({ where: { id } });
  if (!doc || doc.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dotExam = await db.dotExam.findFirst({ where: { employerMecDocId: id, enterpriseId: s.enterpriseId } });
  if (dotExam) {
    const authorization = await db.enterpriseConsent.findFirst({
      where: { enterpriseId: dotExam.enterpriseId!, employeeId: dotExam.employeeId!, patientId: dotExam.patientId || undefined, formKey: "dot_mec_release", status: "signed" },
      select: { id: true },
    });
    if (!authorization || !dotExam.mecIssuedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = Buffer.from(doc.dataBase64, "base64");
  await db.auditLog.create({ data: { action: "download", resource: dotExam ? "DotMECEmployer" : "EnterpriseDocument", resourceId: id } }).catch(() => {});
  return new NextResponse(buf, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
