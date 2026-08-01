import { db } from "@/lib/db";
import { REFDATA_CATALOG } from "./catalog";

// Ensures the clinical dropdown catalog (RefData) is populated. This makes the
// dropdowns self-heal on a fresh database (e.g. first production boot) so they
// are never blank — independent of any boot/seed script. Idempotent upserts.
let seedPromise: Promise<void> | null = null;

export async function ensureRefDataSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const count = await db.refData.count();
    if (count > 0) return;
    console.log(`[refdata] catalog empty -> lazily seeding ${REFDATA_CATALOG.length} records`);
    for (const r of REFDATA_CATALOG) {
      await db.refData.upsert({
        where: { type_display: { type: r.type, display: r.display } },
        update: {
          code: r.code ?? null,
          system: r.system ?? null,
          data: (r.data ?? undefined) as object | undefined,
          sortOrder: r.sortOrder ?? 0,
          active: true,
        },
        create: {
          type: r.type,
          display: r.display,
          code: r.code ?? null,
          system: r.system ?? null,
          data: (r.data ?? undefined) as object | undefined,
          sortOrder: r.sortOrder ?? 0,
        },
      });
    }
    console.log("[refdata] lazy seed complete");
  })();

  try {
    await seedPromise;
  } catch (err) {
    // Allow a later request to retry if this attempt failed.
    seedPromise = null;
    throw err;
  }
}
