/**
 * Background worker for a "pull every patient" bulk migration from a connected
 * EHR (Practice Fusion/Veradigm, eCW) over its FHIR API.
 *
 * Two modes (dispatched by the connection's authMode):
 *  - "system": SMART Backend Services + Bulk Data $export (unattended, no user
 *    login). Kicks off $export, polls the manifest, downloads the NDJSON, groups
 *    resources per patient, and persists each patient with the SAME idempotent
 *    engine as the file/single importers.
 *  - "user": interactive authorization_code token; pages the Patient list and
 *    fetches each patient's resources on demand.
 *
 * Progress is written to the FhirBulkJob row after each patient so the admin UI
 * can poll live progress. Cancellation is cooperative. Runs detached in the
 * long-lived Next server process. No mock/fake data is ever produced.
 */

import { db } from "@/lib/db";
import {
  countPatients,
  ensureAccessToken,
  fetchPatientEverything,
  getConnection,
  iteratePatients,
  isProvider,
  type ProviderKey,
} from "@/lib/fhir/client";
import {
  EXPORT_TYPES,
  downloadManifest,
  getSystemToken,
  groupByPatient,
  kickoffExport,
  pollExport,
} from "@/lib/fhir/backend";
import { extractFromFhirResources } from "@/lib/import/clinical";
import { persistExtracted } from "@/lib/import/persist";

function patientName(pt: any): string {
  const n = pt?.name?.[0];
  const nm = [Array.isArray(n?.given) ? n.given.join(" ") : n?.given, n?.family].filter(Boolean).join(" ").trim();
  return nm || pt?.id || "(unnamed)";
}

type Counters = {
  processed: number; patientsCreated: number; patientsMerged: number;
  recordsCreated: number; recordsSkipped: number; failed: number;
  errors: { name: string; message: string }[]; providerNotice: boolean;
};

async function persistOnePatient(resources: any[], defaultProviderId: string | null, ctr: Counters, name: string): Promise<void> {
  try {
    const ex = extractFromFhirResources(resources);
    if (ex.patient.firstName || ex.patient.lastName) {
      const r = await persistExtracted(ex, { defaultProviderId });
      if (r.ok) {
        if (r.patientCreated) ctr.patientsCreated++; else ctr.patientsMerged++;
        ctr.recordsCreated += r.created;
        ctr.recordsSkipped += r.skipped;
        if (r.notice) ctr.providerNotice = true;
      } else { ctr.failed++; ctr.errors.push({ name, message: r.error }); }
    } else { ctr.failed++; ctr.errors.push({ name, message: "No usable Patient resource." }); }
  } catch (e: any) {
    ctr.failed++; ctr.errors.push({ name, message: String(e?.message || e).slice(0, 200) });
  }
}

async function isCancelled(jobId: string): Promise<boolean> {
  const fresh = await db.fhirBulkJob.findUnique({ where: { id: jobId }, select: { cancelRequested: true } });
  return !!fresh?.cancelRequested;
}

async function markCancelled(jobId: string): Promise<void> {
  await db.fhirBulkJob.update({ where: { id: jobId }, data: { status: "cancelled", finishedAt: new Date(), currentPatient: null } }).catch(() => {});
}

async function writeProgress(jobId: string, ctr: Counters, currentPatient: string | null): Promise<void> {
  await db.fhirBulkJob.update({
    where: { id: jobId },
    data: {
      processed: ctr.processed, patientsCreated: ctr.patientsCreated, patientsMerged: ctr.patientsMerged,
      recordsCreated: ctr.recordsCreated, recordsSkipped: ctr.recordsSkipped, failed: ctr.failed,
      currentPatient, errors: ctr.errors.slice(-50),
    },
  }).catch(() => {});
}

async function finalize(jobId: string, provider: string, ctr: Counters, status: string): Promise<void> {
  await db.fhirBulkJob.update({
    where: { id: jobId },
    data: {
      status, finishedAt: new Date(), currentPatient: null,
      notice: ctr.providerNotice ? "Some visit notes were skipped because no provider was matched — set a default provider and re-run to bring them in." : null,
    },
  }).catch(() => {});
  if (status === "completed") {
    await db.importJob.create({
      data: {
        source: `${provider}_fhir_bulk`, entity: "clinical", status: ctr.failed > 0 ? "partial" : "completed",
        total: ctr.processed, created: ctr.recordsCreated, skipped: ctr.recordsSkipped, failed: ctr.failed,
      },
    }).catch(() => {});
    await db.fhirConnection.update({ where: { provider }, data: { lastImportAt: new Date() } }).catch(() => {});
  }
}

export async function runBulkImport(jobId: string): Promise<void> {
  const job = await db.fhirBulkJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const provider = job.provider;
  if (!isProvider(provider)) {
    await db.fhirBulkJob.update({ where: { id: jobId }, data: { status: "failed", finishedAt: new Date(), notice: "Unknown provider." } }).catch(() => {});
    return;
  }
  const ctr: Counters = { processed: 0, patientsCreated: 0, patientsMerged: 0, recordsCreated: 0, recordsSkipped: 0, failed: 0, errors: [], providerNotice: false };
  const limit = job.limit && job.limit > 0 ? job.limit : 0;

  try {
    const conn = await getConnection(provider as ProviderKey);
    if (!conn) throw new Error("Not connected — authorize this practice first.");
    const mode = conn.authMode || "user";

    if (mode === "system") {
      if (!conn.privateJwk) throw new Error("No signing key — generate a key and register the JWKS URL with the vendor.");
      await runSystemBulkImport(jobId, conn, job, ctr, limit);
    } else {
      if (conn.status !== "connected" || !conn.accessToken) throw new Error("Not connected — authorize this practice first.");
      await runUserBulkImport(jobId, conn, job, ctr, limit);
    }
  } catch (e: any) {
    await db.fhirBulkJob.update({
      where: { id: jobId },
      data: { status: "failed", finishedAt: new Date(), currentPatient: null, notice: String(e?.message || e).slice(0, 300) },
    }).catch(() => {});
  }
}

// ---- System (Backend Services + $export) ----
async function runSystemBulkImport(jobId: string, conn: any, job: any, ctr: Counters, limit: number): Promise<void> {
  const token = await getSystemToken(conn);

  await db.fhirBulkJob.update({ where: { id: jobId }, data: { currentPatient: "Requesting export from the EHR…" } }).catch(() => {});
  const statusUrl = await kickoffExport(conn, token, { types: EXPORT_TYPES });

  const manifest = await pollExport(statusUrl, token, {
    maxMs: 180_000,
    onProgress: (p) => { db.fhirBulkJob.update({ where: { id: jobId }, data: { currentPatient: `Exporting from the EHR… ${p}` } }).catch(() => {}); },
  });

  if (await isCancelled(jobId)) { await markCancelled(jobId); return; }

  await db.fhirBulkJob.update({ where: { id: jobId }, data: { currentPatient: "Downloading exported records…" } }).catch(() => {});
  const resources = await downloadManifest(manifest, token);
  const byPatient = groupByPatient(resources);

  const ids = [...byPatient.keys()];
  const total = limit ? Math.min(ids.length, limit) : ids.length;
  await db.fhirBulkJob.update({ where: { id: jobId }, data: { totalPatients: total } }).catch(() => {});

  for (const pid of ids) {
    if (await isCancelled(jobId)) { await markCancelled(jobId); return; }
    const bucket = byPatient.get(pid)!;
    const name = patientName(bucket.find((r) => r.resourceType === "Patient"));
    await persistOnePatient(bucket, job.defaultProviderId, ctr, name);
    ctr.processed++;
    await writeProgress(jobId, ctr, name);
    if (limit && ctr.processed >= limit) break;
  }

  await finalize(jobId, job.provider, ctr, "completed");
}

// ---- User (authorization_code) — page the Patient list, fetch each on demand ----
async function runUserBulkImport(jobId: string, conn: any, job: any, ctr: Counters, limit: number): Promise<void> {
  let token = await ensureAccessToken(conn);

  const total = await countPatients(conn, token);
  if (total != null) await db.fhirBulkJob.update({ where: { id: jobId }, data: { totalPatients: limit ? Math.min(total, limit) : total } }).catch(() => {});

  let sinceRefresh = 0;
  for await (const pt of iteratePatients(conn, token)) {
    if (await isCancelled(jobId)) { await markCancelled(jobId); return; }
    if (sinceRefresh >= 25) { const c2 = await getConnection(job.provider); if (c2) token = await ensureAccessToken(c2); sinceRefresh = 0; }

    const name = patientName(pt);
    try {
      const resources = await fetchPatientEverything(conn, token, pt.id);
      await persistOnePatient(resources, job.defaultProviderId, ctr, name);
    } catch (e: any) {
      ctr.failed++; ctr.errors.push({ name, message: String(e?.message || e).slice(0, 200) });
    }
    ctr.processed++; sinceRefresh++;
    await writeProgress(jobId, ctr, name);
    if (limit && ctr.processed >= limit) break;
  }

  await finalize(jobId, job.provider, ctr, "completed");
}
