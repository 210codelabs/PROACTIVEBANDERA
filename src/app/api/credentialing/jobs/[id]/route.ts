import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = await db.automationJob.findUnique({ where: { id }, include: { provider: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    job: {
      id: job.id, status: job.status, target: job.target, error: job.error, logs: job.logs,
      webhookToken: job.webhookToken, mfaRequestedAt: job.mfaRequestedAt, mfaReceivedAt: job.mfaReceivedAt,
      package: job.package, providerName: `${job.provider.firstName} ${job.provider.lastName}`, npi: job.provider.npi,
    },
  });
}

// PATCH /api/credentialing/jobs/[id] { status }  (staff advances the job)
const ALLOWED = new Set(["pending", "validating", "validated", "awaiting_mfa", "processing", "completed", "failed"]);
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const status = String(b.status || "");
  if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const job = await db.automationJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const logs = Array.isArray(job.logs) ? (job.logs as any[]) : [];
  logs.push({ at: new Date().toISOString(), level: "info", message: `Status -> ${status} (by ${s.firstName} ${s.lastName})` });
  const updated = await db.automationJob.update({ where: { id }, data: { status, error: b.error || job.error, logs } });
  return NextResponse.json({ ok: true, job: { ...updated, package: undefined } });
}
