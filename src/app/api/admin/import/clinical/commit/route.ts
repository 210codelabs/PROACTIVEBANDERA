import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseClinicalDocument, detectFormat } from "@/lib/import/clinical";
import { persistExtracted } from "@/lib/import/persist";

// POST /api/admin/import/clinical/commit { content, defaultProviderId? }
// Imports a C-CDA XML / FHIR JSON bundle: creates or matches the patient
// (dedupe by MRN, else name+DOB), then attaches Problems / Medications /
// Allergies / Vitals / Immunizations / Encounters (visit notes) via the shared
// persistExtracted helper. Non-destructive & idempotent.
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const content = String(b.content || "");
  const defaultProviderId = b.defaultProviderId ? String(b.defaultProviderId) : null;
  if (!content.trim()) return NextResponse.json({ error: "No document content provided." }, { status: 400 });
  if (!detectFormat(content)) return NextResponse.json({ error: "Unrecognized file — expected C-CDA XML or FHIR JSON bundle." }, { status: 400 });

  let ex;
  try { ex = parseClinicalDocument(content); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 400 }); }

  const result = await persistExtracted(ex, { defaultProviderId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

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
    counts: result.counts,
    total: result.total, created: result.created, skipped: result.skipped,
    notice: result.notice,
  });
}
