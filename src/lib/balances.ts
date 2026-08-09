import { db } from "@/lib/db";

/**
 * Patient outstanding balance helpers, derived from the patient ledger
 * (charges − payments − adjustments). Used for the schedule "Balance due" badge.
 */

/** Map of patientId -> outstanding balance in cents (only positive balances). */
export async function getBalanceMap(patientIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = Array.from(new Set(patientIds.filter(Boolean)));
  if (!ids.length) return map;
  try {
    const entries = await db.patientLedgerEntry.findMany({
      where: { patientId: { in: ids } },
      select: { patientId: true, type: true, amountCents: true },
    });
    const totals = new Map<string, number>();
    for (const e of entries) {
      const sign = e.type === "charge" ? 1 : -1; // payments & adjustments reduce balance
      totals.set(e.patientId, (totals.get(e.patientId) || 0) + sign * e.amountCents);
    }
    for (const [pid, cents] of totals) {
      if (cents > 0) map.set(pid, cents);
    }
  } catch {
    /* best-effort */
  }
  return map;
}

export function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
