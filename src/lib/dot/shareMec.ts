import { db } from "@/lib/db";
import { extractDocumentFile } from "@/lib/documentFile";

export async function publishAuthorizedMec(examId: string): Promise<string | null> {
  const exam = await db.dotExam.findUnique({ where: { id: examId } });
  if (!exam?.enterpriseId || !exam.employeeId || !exam.mecIssuedAt || !exam.mecCardDocId) return null;
  if (exam.employerMecDocId) return exam.employerMecDocId;

  const authorization = await db.enterpriseConsent.findFirst({
    where: {
      enterpriseId: exam.enterpriseId,
      employeeId: exam.employeeId,
      patientId: exam.patientId,
      formKey: "dot_mec_release",
      status: "signed",
    },
  });
  if (!authorization) return null;

  const patientDocument = await db.document.findUnique({ where: { id: exam.mecCardDocId } });
  if (!patientDocument || patientDocument.patientId !== exam.patientId) return null;
  const file = extractDocumentFile(patientDocument.body);
  if (!file || file.mime !== "application/pdf") return null;

  const enterpriseDocument = await db.enterpriseDocument.create({
    data: {
      enterpriseId: exam.enterpriseId,
      name: `MCSA-5876-${exam.id}.pdf`,
      mimeType: "application/pdf",
      size: Buffer.from(file.base64, "base64").length,
      dataBase64: file.base64,
      uploadedType: "clinic",
      uploadedName: "Authorized DOT certificate",
    },
  });
  const attached = await db.dotExam.updateMany({
    where: { id: exam.id, employerMecDocId: null },
    data: { employerMecDocId: enterpriseDocument.id },
  });
  if (!attached.count) {
    await db.enterpriseDocument.delete({ where: { id: enterpriseDocument.id } }).catch(() => {});
    const current = await db.dotExam.findUnique({ where: { id: exam.id }, select: { employerMecDocId: true } });
    return current?.employerMecDocId || null;
  }
  return enterpriseDocument.id;
}