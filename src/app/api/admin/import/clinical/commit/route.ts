import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseClinicalDocument, detectFormat } from "@/lib/import/clinical";
import { persistExtracted } from "@/lib/import/persist";
import { MAX_DOC_BYTES } from "@/lib/documentFile";
import { createHash } from "node:crypto";

// POST /api/admin/import/clinical/commit { content, defaultProviderId? }
// Imports a C-CDA XML / FHIR JSON bundle: creates or matches the patient
// (dedupe by MRN, else name+DOB), then attaches Problems / Medications /
// Allergies / Vitals / Immunizations / Encounters (visit notes) via the shared
// persistExtracted helper. Non-destructive & idempotent.
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  let bytes: Buffer;
  let fileName: string;
  let defaultProviderId: string | null;
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Could not read the uploaded document." }, { status: 400 });
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > MAX_DOC_BYTES) return NextResponse.json({ error: "Source document exceeds the 8 MB chart document limit." }, { status: 413 });
      bytes = Buffer.from(await file.arrayBuffer());
      fileName = file.name.replace(/[\\/]+/g, "_").slice(0, 160) || "clinical-source";
    } else {
      bytes = Buffer.from(String(form.get("content") || ""), "utf8");
      fileName = "clinical-source.txt";
    }
    defaultProviderId = form.get("defaultProviderId") ? String(form.get("defaultProviderId")) : null;
  } else {
    const b = await req.json().catch(() => ({}));
    bytes = Buffer.from(String(b.content || ""), "utf8");
    fileName = "clinical-source.txt";
    defaultProviderId = b.defaultProviderId ? String(b.defaultProviderId) : null;
  }
  if (bytes.length > MAX_DOC_BYTES) return NextResponse.json({ error: "Source document exceeds the 8 MB chart document limit." }, { status: 413 });
  let content: string;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return NextResponse.json({ error: "The source document must use UTF-8 encoding." }, { status: 400 }); }
  if (!content.trim()) return NextResponse.json({ error: "No document content provided." }, { status: 400 });
  if (!detectFormat(content)) return NextResponse.json({ error: "Unrecognized file — expected C-CDA XML or FHIR JSON bundle." }, { status: 400 });

  let ex;
  try { ex = parseClinicalDocument(content); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 400 }); }

  const result = await persistExtracted(ex, { defaultProviderId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const sourceMime = ex.format === "ccda" ? "application/xml" : "application/json";
  let sourceDocument;
  try {
    sourceDocument = await db.document.findFirst({
      where: { patientId: result.patientId, category: "medical-records", body: { contains: `"sha256":"${sourceHash}"` } },
      select: { id: true },
    });
    if (!sourceDocument) sourceDocument = await db.document.create({
      data: {
        patientId: result.patientId,
        title: `Imported ${ex.format.toUpperCase()} source - ${fileName}`.slice(0, 200),
        category: "medical-records",
        body: JSON.stringify({
          source: "clinical-import", fileName, mime: sourceMime, size: bytes.length,
          sha256: sourceHash, uploadedById: admin.id, uploadedByName: `${admin.firstName} ${admin.lastName}`.trim(),
          fileDataUrl: `data:${sourceMime};base64,${bytes.toString("base64")}`,
        }),
      },
      select: { id: true },
    });
    await db.auditLog.create({ data: { userId: admin.id, action: "clinical_import.source_saved", resource: "Document", resourceId: sourceDocument.id, meta: JSON.stringify({ patientId: result.patientId, sha256: sourceHash }) } });
  } catch {
    return NextResponse.json({ error: "Clinical records may have been imported, but the original source document could not be saved. Review the patient chart before retrying.", patientId: result.patientId }, { status: 500 });
  }

  const job = await db.importJob.create({
    data: {
      source: ex.format, entity: "clinical", status: "completed",
      total: result.total, created: result.created, skipped: result.skipped, failed: 0,
      errors: undefined,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true, jobId: job?.id || null, format: ex.format,
    patientId: result.patientId, patientCreated: result.patientCreated,
    sourceDocumentId: sourceDocument.id,
    counts: result.counts,
    total: result.total, created: result.created, skipped: result.skipped,
    notice: result.notice,
  });
}
