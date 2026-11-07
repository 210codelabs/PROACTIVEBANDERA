import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { formByKey, renderFormBody } from "@/lib/enterprise/forms";
import { buildConsentPdf } from "@/lib/enterprise/consentPdf";

export const runtime = "nodejs";

const Body = z.object({ signatureText: z.string().min(1), signerName: z.string().optional().nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const consent = await db.enterpriseConsent.findUnique({ where: { id } });
  if (!consent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin" && consent.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (consent.formKey === "dot_mec_release") {
    return NextResponse.json({ error: "This DOT certificate release must be signed by the employee through employee self-service." }, { status: 403 });
  }
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Signature is required" }, { status: 400 });
  const b = parse.data;

  const emp = consent.employeeId ? await db.enterpriseEmployee.findUnique({ where: { id: consent.employeeId } }) : null;
  const acct = await db.enterpriseAccount.findUnique({ where: { id: consent.enterpriseId } });
  const tpl = formByKey(consent.formKey);
  const employeeName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee";
  const company = acct?.companyName || s.companyName;
  const signerName = b.signerName || employeeName;
  const signedAt = new Date();

  let documentId: string | null = null;
  try {
    if (tpl) {
      const bodyText = renderFormBody(tpl, { employee: employeeName, company });
      const pdf = await buildConsentPdf({
        title: tpl.title, bodyText, company, employee: employeeName,
        signerName, signerRole: consent.signerRole || tpl.signerRole, signatureText: b.signatureText, signedAt,
      });
      const dataBase64 = Buffer.from(pdf).toString("base64");
      const doc = await db.enterpriseDocument.create({
        data: {
          enterpriseId: consent.enterpriseId, requestId: null,
          name: `${tpl.title.replace(/[^\w ]/g, "")} - ${employeeName}.pdf`,
          mimeType: "application/pdf", size: pdf.length, dataBase64,
          uploadedType: "employer", uploadedName: s.name,
        },
      });
      documentId = doc.id;
      // also drop a reference document onto the patient chart
      if (consent.patientId) {
        await db.document.create({ data: { patientId: consent.patientId, title: `${tpl.title} (signed)`, category: "consent", body: `Signed via Enterprise Portal on ${signedAt.toLocaleString()}` } }).catch(() => {});
      }
    }
  } catch { /* PDF is best-effort */ }

  const updated = await db.enterpriseConsent.update({
    where: { id },
    data: { status: "signed", signatureText: b.signatureText, signerName, signedAt, documentId },
  });
  return NextResponse.json({ ok: true, consent: updated, documentId });
}
