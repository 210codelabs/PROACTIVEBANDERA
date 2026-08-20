import { db } from "@/lib/db";

/**
 * Coverage helpers built on top of saved Stedi eligibility (270/271) checks.
 * Used by the patient chart header (latest coverage card), schedule copay
 * prefill, and re-verify flows.
 */

export type CoverageSummaryItem = { label: string; value: string };

/** Number of days after which a saved eligibility check is considered "stale". */
export const COVERAGE_STALE_DAYS = 30;

/**
 * Minimum interval (days) between paid Stedi eligibility checks for the same
 * patient. If a SUCCESSFUL (active) check already exists inside this window we
 * reuse it instead of spending another transaction. Overridable with `force`.
 */
export const ELIGIBILITY_MIN_INTERVAL_DAYS = 30;

/** Whole days elapsed since a date (0 if invalid/absent). */
export function daysSince(d: Date | string | null | undefined): number {
  if (!d) return Number.POSITIVE_INFINITY;
  const t = new Date(d).getTime();
  if (isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Return the most recent SUCCESSFUL (active) eligibility check for a patient
 * that is still inside the reuse window, or null. Used to decide whether an
 * on-demand verification can be skipped to save cost.
 */
export async function getReusableCheck(
  patientId: string,
  withinDays: number = ELIGIBILITY_MIN_INTERVAL_DAYS,
) {
  if (!patientId) return null;
  try {
    const last = await db.eligibilityCheck.findFirst({
      where: { patientId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;
    return daysSince(last.createdAt) < withinDays ? last : null;
  } catch {
    return null;
  }
}

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

/**
 * Latest coverage to DISPLAY for a patient. Prefers the most recent SUCCESSFUL
 * (active) eligibility check so a later failed / misspelled / errored attempt
 * never replaces the last known-good coverage on the chart. Falls back to the
 * latest check of any status only when the patient has never had an active one.
 */
export async function getLatestCoverage(patientId: string) {
  try {
    const active = await db.eligibilityCheck.findFirst({
      where: { patientId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    if (active) return active;
    return await db.eligibilityCheck.findFirst({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

/**
 * Map of patientId -> coverage to display. Prefers each patient's most recent
 * ACTIVE check (last valid coverage), falling back to their latest check of any
 * status only if no active check exists. This keeps the chart / worklist showing
 * the last valid and active insurance even after a failed verification attempt.
 */
export async function getLatestCoverageMap(patientIds: string[]) {
  const map = new Map<string, any>();
  const ids = Array.from(new Set(patientIds.filter(Boolean)));
  if (!ids.length) return map;
  try {
    const checks = await db.eligibilityCheck.findMany({
      where: { patientId: { in: ids } },
      orderBy: { createdAt: "desc" },
    });
    const latestAny = new Map<string, any>();
    for (const c of checks) {
      if (!c.patientId) continue;
      if (!latestAny.has(c.patientId)) latestAny.set(c.patientId, c);
      if (c.status === "active" && !map.has(c.patientId)) map.set(c.patientId, c);
    }
    // Patients with no active check ever fall back to their latest attempt.
    for (const [pid, c] of latestAny) if (!map.has(pid)) map.set(pid, c);
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
