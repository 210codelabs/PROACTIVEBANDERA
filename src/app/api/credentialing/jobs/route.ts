import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { validateNppes, checkOigLeie, checkSamGov } from "@/lib/credentialing/govValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await db.automationJob.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { provider: true } });
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id, providerId: j.providerId, target: j.target, status: j.status,
      providerName: `${j.provider.firstName} ${j.provider.lastName}`, npi: j.provider.npi,
      webhookToken: j.webhookToken, mfaReceivedAt: j.mfaReceivedAt, error: j.error,
      logs: j.logs, createdAt: j.createdAt, updatedAt: j.updatedAt,
    })),
  });
}

// POST /api/credentialing/jobs { providerId }
// Creates a job, runs Gov validation, and (if validated) builds a CAQH submission
// package + a webhook token for the external RPA/SMS agent. We do NOT drive the
// portal browser or intercept MFA ourselves.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const provider = await db.credentialingProvider.findUnique({ where: { id: String(b.providerId || "") } });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const logs: any[] = [{ at: new Date().toISOString(), level: "info", message: "Job created; starting Gov validation." }];
  const job = await db.automationJob.create({
    data: {
      providerId: provider.id, status: "validating", webhookToken: crypto.randomUUID(),
      logs, createdByName: `${s.firstName} ${s.lastName}`,
    },
  });

  const nppes = await validateNppes(provider.npi);
  const oig = await checkOigLeie(provider.firstName, provider.lastName, provider.npi);
  const sam = await checkSamGov(provider.firstName, provider.lastName);
  const passed = nppes.ok && oig.excluded !== true && sam.excluded !== true;
  logs.push({ at: new Date().toISOString(), level: passed ? "info" : "error", message: passed ? "Validation passed." : `Validation failed: ${nppes.error || "exclusion/debarment flag"}` });

  if (!passed) {
    const failed = await db.automationJob.update({ where: { id: job.id }, data: { status: "failed", error: nppes.error || "Provider not validated.", logs } });
    await db.credentialingProvider.update({ where: { id: provider.id }, data: { status: "failed", nppesVerified: nppes.ok, lastValidationAt: new Date() } }).catch(() => {});
    return NextResponse.json({ ok: false, job: { ...failed, package: undefined } });
  }

  // Build the validated CAQH package (NO portal password is ever included).
  const pkg = {
    target: "caqh_proview",
    provider: {
      npi: provider.npi, firstName: provider.firstName, lastName: provider.lastName,
      credential: provider.credential, taxonomy: nppes.data?.taxonomy || provider.taxonomy,
      taxonomyCode: nppes.data?.taxonomyCode || provider.taxonomyCode,
      email: provider.email, phone: provider.phone || nppes.data?.phone,
      address: { line1: provider.addressLine1, city: provider.city || nppes.data?.city, state: provider.state || nppes.data?.state, postalCode: provider.postalCode || nppes.data?.postalCode },
    },
    portalUsername: provider.portalUsername || null,
    validation: { nppes: nppes.ok, oig, sam, at: new Date().toISOString() },
  };
  logs.push({ at: new Date().toISOString(), level: "info", message: "Package ready. Awaiting external RPA agent; will pause for MFA." });

  const ready = await db.automationJob.update({
    where: { id: job.id },
    data: { status: "awaiting_mfa", mfaRequestedAt: new Date(), package: pkg as object, logs },
  });
  await db.credentialingProvider.update({ where: { id: provider.id }, data: { status: "validated", nppesVerified: true, oigClear: oig.excluded === false ? true : oig.excluded === true ? false : null, samClear: sam.excluded === false ? true : sam.excluded === true ? false : null, lastValidationAt: new Date() } }).catch(() => {});

  return NextResponse.json({ ok: true, job: ready });
}
