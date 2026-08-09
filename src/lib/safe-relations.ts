import { db } from "@/lib/db";

/**
 * Referential-integrity safety net for MongoDB + Prisma.
 *
 * Prisma throws an "inconsistent query result / required relation" error the
 * moment a findMany `include` points at a record that no longer exists (an
 * orphaned reference). MongoDB does not enforce foreign keys, so orphans can
 * exist. That single orphan blanks an entire page with a
 * "temporarily unavailable" banner.
 *
 * Instead of using `include`, callers fetch the base rows WITHOUT relations and
 * then hydrate the relations here in bulk. Missing references simply resolve to
 * `undefined` and the caller filters those rows out — the page keeps working.
 */
export async function mapByIds(
  model: "patient" | "user" | "serviceType" | "inventoryItem",
  ids: Array<string | null | undefined>,
): Promise<Map<string, any>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  if (uniq.length === 0) return new Map();
  try {
    const rows = await (db as any)[model].findMany({ where: { id: { in: uniq } } });
    return new Map(rows.map((r: any) => [r.id, r]));
  } catch (err) {
    console.error(`[safe-relations] failed loading ${model}:`, err);
    return new Map();
  }
}

/** Load related children (e.g. charges/diagnoses) grouped by a foreign-key field. */
export async function groupByForeignKey(
  model: "encounterCharge" | "encounterDiagnosis",
  fk: string,
  ids: Array<string | null | undefined>,
): Promise<Map<string, any[]>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, any[]>();
  if (uniq.length === 0) return out;
  try {
    const rows = await (db as any)[model].findMany({ where: { [fk]: { in: uniq } } });
    for (const r of rows) {
      const key = r[fk];
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
  } catch (err) {
    console.error(`[safe-relations] failed grouping ${model}:`, err);
  }
  return out;
}
