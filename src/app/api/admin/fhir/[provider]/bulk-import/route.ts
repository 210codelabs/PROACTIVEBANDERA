import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getConnection, isProvider } from "@/lib/fhir/client";
import { runBulkImport } from "@/lib/fhir/bulk";

// Shape a FhirBulkJob row for the client (all fields are non-sensitive).
function publicJob(j: any) {
  if (!j) return null;
  return {
    id: j.id, provider: j.provider, status: j.status,
    totalPatients: j.totalPatients, processed: j.processed,
    patientsCreated: j.patientsCreated, patientsMerged: j.patientsMerged,
    recordsCreated: j.recordsCreated, recordsSkipped: j.recordsSkipped, failed: j.failed,
    limit: j.limit ?? null, currentPatient: j.currentPatient || null,
    errors: Array.isArray(j.errors) ? j.errors : [],
    notice: j.notice || null, cancelRequested: j.cancelRequested,
    startedAt: j.startedAt, finishedAt: j.finishedAt || null, updatedAt: j.updatedAt,
  };
}

// POST /api/admin/fhir/[provider]/bulk-import
// Body: { limit?: number (trial-run cap), defaultProviderId?: string }
// Starts a background "pull every patient" migration from the connected EHR.
// Returns immediately with the job id; the client polls GET for live progress.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const conn = await getConnection(provider);
  if (!conn) return NextResponse.json({ error: "This provider is not configured yet." }, { status: 400 });
  const mode = (conn as any).authMode || "user";
  if (mode === "system") {
    if (!conn.baseUrl || !conn.tokenUrl || !conn.clientId || !(conn as any).privateJwk) {
      return NextResponse.json({ error: "System access is not fully configured — set the FHIR base URL, token URL and client ID, and generate a signing key." }, { status: 400 });
    }
  } else if (conn.status !== "connected" || !conn.accessToken) {
    return NextResponse.json({ error: "Not connected. Click Connect to authorize this practice before importing." }, { status: 400 });
  }

  // Only one active run per provider.
  const running = await db.fhirBulkJob.findFirst({ where: { provider, status: "running" }, orderBy: { startedAt: "desc" } });
  if (running) {
    return NextResponse.json({ error: "A bulk import is already running for this provider.", jobId: running.id, job: publicJob(running) }, { status: 409 });
  }

  const b = await req.json().catch(() => ({}));
  let limit: number | null = null;
  if (b.limit != null && b.limit !== "") {
    const n = Number(b.limit);
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: "Trial-run limit must be a positive number (or leave blank to import everyone)." }, { status: 400 });
    limit = Math.floor(n);
  }
  const defaultProviderId = b.defaultProviderId ? String(b.defaultProviderId) : null;

  const job = await db.fhirBulkJob.create({
    data: {
      provider, status: "running", limit, defaultProviderId,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  });

  // Fire-and-forget: the worker runs in the long-lived Next server process and
  // writes progress to the job row. Do NOT await it (the request returns now).
  void runBulkImport(job.id).catch(() => { /* worker records its own failure */ });

  return NextResponse.json({ ok: true, jobId: job.id, job: publicJob(job) });
}

// GET /api/admin/fhir/[provider]/bulk-import[?jobId=...]
// Returns the requested job (or the latest job for this provider) for polling.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  const job = jobId
    ? await db.fhirBulkJob.findFirst({ where: { id: jobId, provider } })
    : await db.fhirBulkJob.findFirst({ where: { provider }, orderBy: { startedAt: "desc" } });

  return NextResponse.json({ ok: true, job: publicJob(job) });
}

// DELETE /api/admin/fhir/[provider]/bulk-import?jobId=...
// Requests cooperative cancellation of a running job.
export async function DELETE(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId is required." }, { status: 400 });

  const job = await db.fhirBulkJob.findFirst({ where: { id: jobId, provider } });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (job.status !== "running") return NextResponse.json({ ok: true, job: publicJob(job) });

  const updated = await db.fhirBulkJob.update({ where: { id: jobId }, data: { cancelRequested: true } });
  return NextResponse.json({ ok: true, job: publicJob(updated) });
}
