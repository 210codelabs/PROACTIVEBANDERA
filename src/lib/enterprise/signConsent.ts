import { db } from "@/lib/db";
import { formByKey, renderFormBody } from "@/lib/enterprise/forms";
import { buildConsentPdf } from "@/lib/enterprise/consentPdf";
import { publishAuthorizedMec } from "@/lib/dot/shareMec";

// Shared consent e-sign routine used by both the company-admin sign route and
// the employee self-service sign route. Generates a signed PDF (best-effort),
// stores it as an EnterpriseDocument + a chart Document, and marks signed.
export async function signConsentRecord(opts: {
  consentId: string;
  signatureText: string;
  signerName?: string | null;
  actorName: string;
}): Promise<{ ok: true; consent: any; documentId: string | null } | { ok: false; status: number; error: string }> {
  const consent = await db.enterpriseConsent.findUnique({ where: { id: opts.consentId } });
  if (!consent) return { ok: false, status: 404, error: "Not found" };

  const emp = consent.employeeId ? await db.enterpriseEmployee.findUnique({ where: { id: consent.employeeId } }) : null;
  const acct = await db.enterpriseAccount.findUnique({ where: { id: consent.enterpriseId } });
  const tpl = formByKey(consent.formKey);
  const employeeName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee";
  const company = acct?.companyName || "";
  const signerName = opts.signerName || employeeName;
  const signedAt = new Date();

  let documentId: string | null = null;
  try {
    if (tpl) {
      const bodyText = renderFormBody(tpl, { employee: employeeName, company });
      const pdf = await buildConsentPdf({
        title: tpl.title, bodyText, company, employee: employeeName,
        signerName, signerRole: consent.signerRole || tpl.signerRole, signatureText: opts.signatureText, signedAt,
      });
      const dataBase64 = Buffer.from(pdf).toString("base64");
      const doc = await db.enterpriseDocument.create({
        data: {
          enterpriseId: consent.enterpriseId, requestId: null,
          name: `${tpl.title.replace(/[^\w ]/g, "")} - ${employeeName}.pdf`,
          mimeType: "application/pdf", size: pdf.length, dataBase64,
          uploadedType: "employer", uploadedName: opts.actorName,
        },
      });
      documentId = doc.id;
      if (consent.patientId) {
        await db.document.create({ data: { patientId: consent.patientId, title: `${tpl.title} (signed)`, category: "consent", body: `Signed via Enterprise Portal on ${signedAt.toLocaleString()}` } }).catch(() => {});
      }
    }
  } catch { /* PDF best-effort */ }

  const updated = await db.enterpriseConsent.update({
    where: { id: opts.consentId },
    data: { status: "signed", signatureText: opts.signatureText, signerName, signedAt, documentId },
  });
  if (updated.formKey === "dot_mec_release") {
    const exams = await db.dotExam.findMany({
      where: { enterpriseId: updated.enterpriseId, employeeId: updated.employeeId || undefined, patientId: updated.patientId || undefined, mecIssuedAt: { not: null } },
      select: { id: true },
    });
    await Promise.all(exams.map((exam) => publishAuthorizedMec(exam.id).catch(() => null)));
  }
  return { ok: true, consent: updated, documentId };
}
