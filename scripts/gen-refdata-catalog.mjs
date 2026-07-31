// Dev-only generator: dumps the currently-seeded RefData catalog from the DB
// into a TS module the app can use to lazily self-seed an empty catalog in
// production. Run: DATABASE_URL=... node scripts/gen-refdata-catalog.mjs
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const db = new PrismaClient();

const rows = await db.refData.findMany({
  orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { display: "asc" }],
  select: { type: true, display: true, code: true, system: true, sortOrder: true, data: true },
});

const clean = rows.map((r) => ({
  type: r.type,
  display: r.display,
  code: r.code ?? null,
  system: r.system ?? null,
  sortOrder: r.sortOrder ?? 0,
  data: r.data ?? null,
}));

const header = `// AUTO-GENERATED from the seeded RefData catalog (scripts/gen-refdata-catalog.mjs).
// Do not edit by hand. Used to lazily self-seed the catalog when empty (e.g. in
// a fresh production database) so clinical dropdowns are never blank.
export type RefCatalogRow = {
  type: string;
  display: string;
  code: string | null;
  system: string | null;
  sortOrder: number;
  data: unknown | null;
};

export const REFDATA_CATALOG: RefCatalogRow[] = `;

writeFileSync(
  "src/lib/refdata/catalog.ts",
  header + JSON.stringify(clean, null, 2) + ";\n",
  "utf8",
);

console.log(`Wrote src/lib/refdata/catalog.ts with ${clean.length} records.`);
await db.$disconnect();
