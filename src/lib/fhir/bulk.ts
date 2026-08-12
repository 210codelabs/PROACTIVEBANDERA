/**
 * Background worker for a "pull every patient" bulk migration from a connected
 * EHR (Practice Fusion/Veradigm, eCW) over its FHIR API. It pages through the
 * whole Patient list, and for each patient fetches all supported clinical
 * resources, normalizes them with the SAME engine as the file/single importer
 * (extractFromFhirResources), and persists them idempotently via
 * persistExtracted. Progress is written to the FhirBulkJob row after every
 * patient so the admin UI can poll live progress. Cancellation is cooperative:
 * the worker checks the cancelRequested flag before each patient.
 *
 * Runs detached (fire-and-forget) from the POST route in the long-lived Next
 * server process. No mock/fake data is ever produced.
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
import { extractFromFhirResources } from "@/lib/import/clinical";
import { persistExtracted } from "@/lib/import/persist";

function patientName(pt: any): string {
  const n = pt?.name?.[0];
  const nm = [Array.isArray(n?.given) ? n.given.join(" ") : n?.given, n?.family].filter(Boolean).join(" ").trim();
  return nm || pt?.id || "(unnamed)";
}

export async function runBulkImport(jobId: string): Promise<void> {
  const job = await db.fhirBulkJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const provider = job.provider;
  if (!isProvider(provider)) {
    await db.fhirBulkJob.update({ where: { id: jobId }, data: { status: "failed", finishedAt: new Date(), notice: "Unknown provider." } }).catch(() => {});
    return;
  }

  const errors: { name: string; message: string }[] = [];
  let processed = 0, patientsCreated = 0, patientsMerged = 0, recordsCreated = 0, recordsSkipped = 0, failed = 0;
  let providerNoticeShown = false;
  const limit = job.limit && job.limit > 0 ? job.limit : 0;

  try {
    let conn = await getConnection(provider as ProviderKey);
    if (!conn || conn.status !== "connected" || !conn.accessToken) throw new Error("Not connected — authorize this practice first.");
    let token = await ensureAccessToken(conn);

    // Best-effort total for the progress bar.
    const total = await countPatients(conn, token);
    if (total != null) {
      await db.fhirBulkJob.update({ where: { id: jobId }, data: { totalPatients: limit ? Math.min(total, limit) : total } }).catch(() => {});
    }

    let sinceRefresh = 0;
    for await (const pt of iteratePatients(conn, token)) {
      // Cooperative cancel check.
      const fresh = await db.fhirBulkJob.findUnique({ where: { id: jobId }, select: { cancelRequested: true } });
      if (fresh?.cancelRequested) {
        await db.fhirBulkJob.update({ where: { id: jobId }, data: { status: "cancelled", finishedAt: new Date(), currentPatient: null } }).catch(() => {});
        return;
      }

      // Refresh the token every 25 patients in case a long run outlives it.
      if (sinceRefresh >= 25) {
        conn = await getConnection(provider as ProviderKey);
        if (conn) token = await ensureAccessToken(conn);
        sinceRefresh = 0;
      }

      const name = patientName(pt);
      try {
        const resources = await fetchPatientEverything(conn, token, pt.id);
        const ex = extractFromFhirResources(resources);
        if (ex.patient.firstName || ex.patient.lastName) {
          const r = await persistExtracted(ex, { defaultProviderId: job.defaultProviderId });
          if (r.ok) {
            if (r.patientCreated) patientsCreated++; else patientsMerged++;
            recordsCreated += r.created;
            recordsSkipped += r.skipped;
            if (r.notice) providerNoticeShown = true;
          } else {
            failed++; errors.push({ name, message: r.error });
          }
        } else {
          failed++; errors.push({ name, message: "No usable Patient resource returned." });
        }
      } catch (e: any) {
        failed++; errors.push({ name, message: String(e?.message || e).slice(0, 200) });
      }

      processed++;
      sinceRefresh++;
      await db.fhirBulkJob.update({
        where: { id: jobId },
        data: { processed, patientsCreated, patientsMerged, recordsCreated, recordsSkipped, failed, currentPatient: name, errors: errors.slice(-50) },
      }).catch(() => {});

      if (limit && processed >= limit) break;
    }

    await db.fhirBulkJob.update({
      where: { id: jobId },
      data: {
        status: "completed", finishedAt: new Date(), currentPatient: null,
        notice: providerNoticeShown ? "Some visit notes were skipped because no provider was matched — set a default provider and re-run to bring them in." : null,
      },
    }).catch(() => {});

    // Roll a summary into the shared import-jobs history.
    await db.importJob.create({
      data: {
        source: `${provider}_fhir_bulk`, entity: "clinical", status: failed > 0 ? "partial" : "completed",
        total: processed, created: recordsCreated, skipped: recordsSkipped, failed,
        createdById: job.createdById, createdByName: job.createdByName,
      },
    }).catch(() => {});
    await db.fhirConnection.update({ where: { provider }, data: { lastImportAt: new Date() } }).catch(() => {});
  } catch (e: any) {
    await db.fhirBulkJob.update({
      where: { id: jobId },
      data: { status: "failed", finishedAt: new Date(), currentPatient: null, notice: String(e?.message || e).slice(0, 300) },
    }).catch(() => {});
  }
}
