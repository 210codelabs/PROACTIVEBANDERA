import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fillMcsa5875, fillMcsa5876 } from "@/lib/dot/fillOfficialPdf";
import { outcomeFromFlags } from "@/lib/dot/apply";
import { publishAuthorizedMec } from "@/lib/dot/shareMec";
import { HEALTH_HISTORY, PHYSICAL_SYSTEMS } from "@/lib/dot/forms";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1), examinerSignature: z.string().min(2).max(200) });
const TEMPLATE_DIR = path.join(process.cwd(), "public", "dot-templates");
const sha256 = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex");

function missingExamFields(exam: any): string[] {
  const missing: string[] = [];
  const history = exam.healthHistory || {};
  if (!exam.driverSignedAt || !exam.driverSignature) missing.push("driver-signed health history");
  for (const item of HEALTH_HISTORY) if (typeof history[item.key]?.yes !== "boolean") missing.push(`driver history: ${item.key}`);
  const vitals = exam.vitals || {};
  for (const key of ["heightIn", "weightLb", "bpSystolic", "bpDiastolic", "pulse"]) if (!Number.isFinite(Number(vitals[key])) || Number(vitals[key]) <= 0) missing.push(`vital: ${key}`);
  const vision = exam.vision || {};
  for (const key of ["acuityRightUncorrected", "acuityLeftUncorrected", "acuityBothUncorrected", "acuityRightCorrected", "acuityLeftCorrected", "acuityBothCorrected", "fieldRightDeg", "fieldLeftDeg"]) if (vision[key] === undefined || vision[key] === null || vision[key] === "") missing.push(`vision: ${key}`);
  if (typeof vision.colorPass !== "boolean") missing.push("vision: color recognition");
  const hearing = exam.hearing || {};
  for (const key of ["whisperRightFt", "whisperLeftFt"]) if (!Number.isFinite(Number(hearing[key]))) missing.push(`hearing: ${key}`);
  const urine = exam.urinalysis || {};
  for (const key of ["spGravity", "protein", "blood", "sugar"]) if (urine[key] === undefined || urine[key] === null || urine[key] === "") missing.push(`urinalysis: ${key}`);
  const physical = exam.physicalExam || {};
  for (const item of PHYSICAL_SYSTEMS) if (typeof physical[item.key]?.abnormal !== "boolean") missing.push(`physical exam: ${item.key}`);
  const flags = exam.determinationFlags || {};
  const selected = ["meetsStandards", "meetsWithExemption", "doesNotMeet", "temporarilyDisqualified", "incomplete"].filter((key) => flags[key] === true);
  if (selected.length !== 1) missing.push("exactly one medical examiner determination");
  if (!exam.examDate) missing.push("examination date");
  if (![1, 3, 6, 12, 24].includes(Number(exam.certMonths)) && outcomeFromFlags(flags)?.startsWith("qualified")) missing.push("certificate duration");
  return missing;
}

function dataUrl(bytes: Uint8Array) {
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; examId: string }> }) {
  const session = await requireSession();
  if (session.role !== "provider") return NextResponse.json({ error: "Only an authorized Medical Examiner can sign and lock a DOT examination." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Password reauthentication and examiner signature are required." }, { status: 400 });

  const { id, examId } = await params;
  const [patient, exam, examiner] = await Promise.all([
    db.patient.findUnique({ where: { id } }),
    db.dotExam.findUnique({ where: { id: examId } }),
    db.user.findUnique({ where: { id: session.id } }),
  ]);
  if (!patient || !exam || exam.patientId !== id) return NextResponse.json({ error: "DOT examination not found." }, { status: 404 });
  if (exam.isLocked || exam.signedAt) return NextResponse.json({ error: "This DOT examination has already been signed and locked." }, { status: 409 });
  if (!examiner?.active || !examiner.fmcsaExaminerVerified || !examiner.fmcsaNrcmeNumber || !examiner.fmcsaLicenseState || !examiner.licenseNo || !examiner.credential) {
    return NextResponse.json({ error: "The provider profile is not marked as FMCSA examiner-verified by a clinic administrator." }, { status: 403 });
  }
  if (!await bcrypt.compare(parsed.data.password, examiner.passwordHash)) return NextResponse.json({ error: "Reauthentication failed." }, { status: 401 });

  const missing = missingExamFields(exam);
  if (missing.length) return NextResponse.json({ error: "Examination is incomplete.", missing }, { status: 400 });
  const outcome = outcomeFromFlags(exam.determinationFlags);
  if (!outcome || outcome === "incomplete") return NextResponse.json({ error: "A final medical examiner determination is required." }, { status: 400 });
  const now = new Date();
  const examinerName = `${examiner.firstName} ${examiner.lastName}`.trim();
  if (parsed.data.examinerSignature.trim().toLowerCase() !== examinerName.toLowerCase()) {
    return NextResponse.json({ error: "Type your legal name exactly as it appears in the verified provider profile." }, { status: 400 });
  }
  const examForDocument = {
    ...exam,
    outcome,
    examinerName,
    examinerNrcme: examiner.fmcsaNrcmeNumber,
    examinerLicense: examiner.licenseNo,
    examinerLicenseState: examiner.fmcsaLicenseState,
    examinerSignature: parsed.data.examinerSignature.trim(),
    signedByUserId: examiner.id,
    signedByName: examinerName,
    signedAt: now,
  };

  let merBytes: Uint8Array;
  let mecBytes: Uint8Array | null = null;
  try {
    merBytes = await fillMcsa5875(examForDocument, true);
    if (outcome === "qualified" || outcome === "qualified_with_restrictions") mecBytes = await fillMcsa5876(examForDocument, true);
  } catch {
    return NextResponse.json({ error: "Official DOT PDF template population failed; the examination was not signed." }, { status: 503 });
  }

  const merTemplateHash = sha256(fs.readFileSync(path.join(TEMPLATE_DIR, "mcsa-5875.pdf")));
  const mecTemplateHash = mecBytes ? sha256(fs.readFileSync(path.join(TEMPLATE_DIR, "mcsa-5876.pdf"))) : null;
  const merHash = sha256(merBytes);
  const mecHash = mecBytes ? sha256(mecBytes) : null;
  const merDocument = await db.document.create({
    data: {
      patientId: id,
      title: `Signed MCSA-5875 - ${exam.driverName} - ${now.toISOString()}`,
      category: "dot-mer-signed",
      body: JSON.stringify({ fileDataUrl: dataUrl(merBytes), fileName: `MCSA-5875-${exam.id}.pdf`, uploadedByName: examinerName, examId: exam.id, documentHash: merHash, templateHash: merTemplateHash, formVersion: "MCSA-5875 bundled template" }),
    },
  });
  let mecDocument: { id: string } | null = null;
  try {
    if (mecBytes && mecHash && mecTemplateHash) {
      mecDocument = await db.document.create({
        data: {
          patientId: id,
          title: `Issued MCSA-5876 - ${exam.driverName} - ${now.toISOString()}`,
          category: "dot-mec-issued",
          body: JSON.stringify({ fileDataUrl: dataUrl(mecBytes), fileName: `MCSA-5876-${exam.id}.pdf`, uploadedByName: examinerName, examId: exam.id, sourceMerDocumentId: merDocument.id, documentHash: mecHash, templateHash: mecTemplateHash, formVersion: "MCSA-5876 bundled template" }),
        },
      });
    }
    const updated = await db.dotExam.updateMany({
      where: { id: exam.id, isLocked: false, signedAt: null },
      data: {
        outcome,
        examinerName,
        examinerNrcme: examiner.fmcsaNrcmeNumber,
        examinerLicense: examiner.licenseNo,
        examinerLicenseState: examiner.fmcsaLicenseState,
        examinerSignature: parsed.data.examinerSignature.trim(),
        examDate: exam.examDate || now,
        status: "completed",
        isLocked: true,
        signedAt: now,
        signedByUserId: examiner.id,
        signedByName: examinerName,
        signedDocumentHash: merHash,
        formVersion: "MCSA-5875 bundled template",
        templateHash: merTemplateHash,
        mecIssuedAt: mecDocument ? now : null,
        mecSignedByUserId: mecDocument ? examiner.id : null,
        mecDocumentHash: mecHash,
        form5875DocId: merDocument.id,
        mecCardDocId: mecDocument?.id || null,
        reportingStatus: "due",
      },
    });
    if (!updated.count) throw new Error("This DOT examination was signed concurrently. Reload the chart.");
  } catch (error) {
    await db.document.deleteMany({ where: { id: { in: [merDocument.id, ...(mecDocument ? [mecDocument.id] : [])] } } }).catch(() => {});
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to lock the examination." }, { status: 409 });
  }

  if (mecDocument) await publishAuthorizedMec(exam.id).catch(() => null);
  await db.auditLog.create({
    data: { userId: examiner.id, action: "sign_lock", resource: "DotExam", resourceId: exam.id, meta: JSON.stringify({ merHash, mecHash, outcome }) },
  });
  const lockedExam = await db.dotExam.findUnique({ where: { id: exam.id } });
  return NextResponse.json({ ok: true, exam: lockedExam, merDocumentId: merDocument.id, mecDocumentId: mecDocument?.id || null });
}