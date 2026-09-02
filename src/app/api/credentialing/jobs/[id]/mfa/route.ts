import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC WEBHOOK (token-guarded, no session). The external SMS/AI agent that
// intercepts the CAQH MFA code calls this to hand the code back and resume the
// job. Body/header must carry the job's webhookToken.
// POST /api/credentialing/jobs/[id]/mfa  { token, code }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || req.headers.get("x-webhook-token") || "");
  const code = String(b.code || "").trim();

  const job = await db.automationJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!token || token !== job.webhookToken) return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (job.status !== "awaiting_mfa") {
    return NextResponse.json({ error: `Job is not awaiting MFA (current status: ${job.status}).` }, { status: 409 });
  }

  const logs = Array.isArray(job.logs) ? (job.logs as any[]) : [];
  logs.push({ at: new Date().toISOString(), level: "info", message: "MFA code received via webhook; resuming (status -> processing)." });

  const updated = await db.automationJob.update({
    where: { id },
    data: { mfaCode: code, mfaReceivedAt: new Date(), status: "processing", logs },
  });
  return NextResponse.json({ ok: true, status: updated.status });
}

// GET is a lightweight poll so the external agent can check whether an MFA code
// is being awaited (returns status only, no secrets).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(_req.url);
  const token = url.searchParams.get("token") || "";
  const job = await db.automationJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!token || token !== job.webhookToken) return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  return NextResponse.json({ status: job.status, awaitingMfa: job.status === "awaiting_mfa" });
}
