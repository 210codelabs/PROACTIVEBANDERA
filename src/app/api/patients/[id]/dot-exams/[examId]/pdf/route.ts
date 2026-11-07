import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { extractDocumentFile } from "@/lib/documentFile";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; examId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["provider", "admin"].includes(session.role)) return NextResponse.json({ error: "Provider or administrator access is required." }, { status: 403 });

  const { id, examId } = await params;
  const exam = await db.dotExam.findUnique({ where: { id: examId } });
  if (!exam || exam.patientId !== id) return NextResponse.json({ error: "DOT examination not found." }, { status: 404 });
  if (!exam.isLocked || !exam.signedAt) return NextResponse.json({ error: "Only signed and locked examinations can be downloaded." }, { status: 409 });

  const form = new URL(req.url).searchParams.get("form") || "5875";
  const isMec = form === "5876" || form === "mec";
  if (!isMec && form !== "5875") return NextResponse.json({ error: "Unsupported form." }, { status: 400 });
  if (isMec && !exam.mecIssuedAt) return NextResponse.json({ error: "No MEC was issued for this determination." }, { status: 404 });
  const docId = isMec ? exam.mecCardDocId : exam.form5875DocId;
  const expectedHash = isMec ? exam.mecDocumentHash : exam.signedDocumentHash;
  if (!docId || !expectedHash) return NextResponse.json({ error: "Signed document reference is missing." }, { status: 404 });

  const doc = await db.document.findUnique({ where: { id: docId } });
  if (!doc || doc.patientId !== id) return NextResponse.json({ error: "Signed document not found." }, { status: 404 });
  const file = extractDocumentFile(doc.body);
  if (!file || file.mime !== "application/pdf") return NextResponse.json({ error: "Stored signed PDF is invalid." }, { status: 409 });
  const bytes = Buffer.from(file.base64, "base64");
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    await db.auditLog.create({ data: { userId: session.id, action: "integrity_failure", resource: "DotExamDocument", resourceId: exam.id } }).catch(() => {});
    return NextResponse.json({ error: "Signed document integrity verification failed." }, { status: 409 });
  }
  await db.auditLog.create({ data: { userId: session.id, action: "download", resource: isMec ? "DotMEC" : "DotMER", resourceId: exam.id } });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${isMec ? "MCSA-5876" : "MCSA-5875"}-${exam.id}.pdf"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}