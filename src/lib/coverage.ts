import { db } from "@/lib/db";

/**
 * Coverage helpers built on top of saved Stedi eligibility (270/271) checks.
 * Used by the patient chart header (latest coverage card), schedule copay
 * prefill, and re-verify flows.
 */

export type CoverageSummaryItem = { label: string; value: string };

/** Number of days after which a saved eligibility check is considered "stale". */
export const COVERAGE_STALE_DAYS = 30;

/** Pull a dollar copay amount (as a string like "25" or "25.00") from a summary. */
export function extractCopayDollars(summary: unknown): string | null {
  if (!Array.isArray(summary)) return null;
  const copay = summary.find(
    (s: any) => s && typeof s.label === "string" && /co-?pay/i.test(s.label) && typeof s.value === "string",
  ) as CoverageSummaryItem | undefined;
  if (!copay) return null;
  const m = copay.value.replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return m ? m[1] : null;
}

/** Latest saved eligibility check for a single patient (or null). */
export async function getLatestCoverage(patientId: string) {
  try {
    return await db.eligibilityCheck.findFirst({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

/** Map of patientId -> latest saved eligibility check (or absent if none). */
export async function getLatestCoverageMap(patientIds: string[]) {
  const map = new Map<string, any>();
  const ids = Array.from(new Set(patientIds.filter(Boolean)));
  if (!ids.length) return map;
  try {
    const checks = await db.eligibilityCheck.findMany({
      where: { patientId: { in: ids } },
      orderBy: { createdAt: "desc" },
    });
    for (const c of checks) {
      if (c.patientId && !map.has(c.patientId)) map.set(c.patientId, c);
    }
  } catch {
    /* ignore */
  }
  return map;
}

/** Classify a coverage check for worklist purposes. */
export function classifyCoverage(check: any): { kind: "ok" | "stale" | "lapsed" | "none"; label: string } {
  if (!check) return { kind: "none", label: "No check on file" };
  if (check.status === "inactive" || check.status === "error") return { kind: "lapsed", label: "Coverage not confirmed" };
  const days = check.createdAt ? Math.floor((Date.now() - new Date(check.createdAt).getTime()) / 86_400_000) : 0;
  if (check.status === "active" && days > COVERAGE_STALE_DAYS) return { kind: "stale", label: `Stale (${days}d old)` };
  if (check.status === "active") return { kind: "ok", label: "Active" };
  return { kind: "stale", label: "Unknown status" };
}

/**
 * Map of patientId -> verified copay dollar amount, using the most recent
 * ACTIVE eligibility check per patient. Patients with no active check (or no
 * copay in the benefits) are simply omitted.
 */
export async function getCopayMap(patientIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(patientIds.filter(Boolean)));
  if (!ids.length) return map;
  try {
    const checks = await db.eligibilityCheck.findMany({
      where: { patientId: { in: ids }, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    for (const c of checks) {
      if (!c.patientId || map.has(c.patientId)) continue; // first per patient = latest
      const copay = extractCopayDollars(c.summary);
      if (copay) map.set(c.patientId, copay);
    }
  } catch {
    /* ignore — copay prefill is best-effort */
  }
  return map;
}
