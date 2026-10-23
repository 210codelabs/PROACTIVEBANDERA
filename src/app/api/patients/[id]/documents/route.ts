import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DOC_CATEGORIES, ALLOWED_DOC_MIME, MAX_DOC_BYTES } from "@/lib/documentFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patients/[id]/documents
// Staff upload of ANY chart file (labs, imaging, referrals, attorney letters,
// insurance, etc.). Body: { title?, category, fileName, dataUrl, note? }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "The upload could not be read — the file may be too large (max 8 MB)." }, { status: 413 });
  if (!b.dataUrl || !b.fileName) return NextResponse.json({ error: "A file is required." }, { status: 400 });

  const category = String(b.category || "other");
  if (!DOC_CATEGORIES.some((c) => c.value === category)) return NextResponse.json({ error: "Unknown document category." }, { status: 400 });

  const m = /^data:([\w.+/-]+);base64,/.exec(String(b.dataUrl));
  const mime = (m?.[1] || "").toLowerCase();
  if (!m || !ALLOWED_DOC_MIME.includes(mime)) {
    return NextResponse.json({ error: "Unsupported file type. Upload a PDF, image (JPG/PNG/WEBP/GIF), Word, text or CSV file." }, { status: 400 });
  }
  const b64 = String(b.dataUrl).slice(m[0].length);
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_DOC_BYTES) return NextResponse.json({ error: `File is too large (max ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB).` }, { status: 413 });

  const patient = await db.patient.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const fileName = String(b.fileName).replace(/[\\/]+/g, "_").slice(0, 160);
  const catLabel = DOC_CATEGORIES.find((c) => c.value === category)?.label || "Document";
  const title = (String(b.title || "").trim() || `${catLabel} — ${fileName.replace(/\.[^.]+$/, "")}`).slice(0, 200);

  // --- Attorney Case Linking ------------------------------------------------
  // Attorney letters (or any upload with an explicit legalCaseId) are also
  // attached to the patient's Legal / PIP case. Explicit legalCaseId must
  // belong to this patient; otherwise the most recently updated OPEN case is
  // used. "none" opts out.
  const wantLink = category === "attorney-letter" || (b.legalCaseId && b.legalCaseId !== "none");
  let linkedCase: { id: string; caseNumber: string | null; caseType: string } | null = null;
  if (wantLink && b.legalCaseId !== "none") {
    if (b.legalCaseId) {
      linkedCase = await db.legalCase.findFirst({ where: { id: String(b.legalCaseId), patientId: id }, select: { id: true, caseNumber: true, caseType: true } }).catch(() => null);
      if (!linkedCase) return NextResponse.json({ error: "That legal case does not belong to this patient." }, { status: 400 });
    } else {
      linkedCase = await db.legalCase.findFirst({
        where: { patientId: id, status: { notIn: ["closed", "settled"] } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, caseNumber: true, caseType: true },
      }).catch(() => null);
    }
  }
  let caseDocumentId: string | null = null;
  if (linkedCase) {
    const actor = `${user.firstName} ${user.lastName}`.trim() || (user as any).email || "staff";
    const cd = await db.caseDocument.create({
      data: {
        legalCaseId: linkedCase.id,
        name: fileName,
        category: category === "attorney-letter" ? "correspondence" : category === "medical-records" || category === "lab-report" || category === "imaging" ? "medical" : category === "insurance" ? "billing" : "other",
        mimeType: mime,
        size: bytes,
        dataBase64: b64,
        uploadedBy: actor,
      },
      select: { id: true },
    });
    caseDocumentId = cd.id;
    await db.caseEvent.create({
      data: { legalCaseId: linkedCase.id, type: "document", title: `Document uploaded from chart: ${fileName}`, actor },
    }).catch(() => {});
    await db.legalCase.update({ where: { id: linkedCase.id }, data: { updatedAt: new Date() } }).catch(() => {});
  }

  const doc = await db.document.create({
    data: {
      patientId: id,
      title,
      category,
      body: JSON.stringify({
        source: "chart-upload",
        uploadedBy: "staff",
        uploadedById: user.id,
        uploadedByName: `${user.firstName} ${user.lastName}`.trim(),
        fileName,
        mime,
        size: bytes,
        note: String(b.note || "").slice(0, 1000) || undefined,
        fileDataUrl: b.dataUrl,
        linkedLegalCaseId: linkedCase?.id || undefined,
        linkedLegalCaseNumber: linkedCase?.caseNumber || undefined,
        linkedCaseDocumentId: caseDocumentId || undefined,
        submittedAt: new Date().toISOString(),
      }),
    },
  });

  await db.auditLog.create({
    data: { userId: user.id, action: "document.upload", resource: "Document", resourceId: doc.id, meta: JSON.stringify({ patientId: id, category, mime, size: bytes, legalCaseId: linkedCase?.id || null }) },
  }).catch(() => {});

  return NextResponse.json({
    ok: true, id: doc.id, title, category,
    linkedLegalCase: linkedCase ? { id: linkedCase.id, caseNumber: linkedCase.caseNumber, caseDocumentId } : null,
  });
}
