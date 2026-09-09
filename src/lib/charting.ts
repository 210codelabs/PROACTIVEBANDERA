import { db } from "@/lib/db";

// Lazy-seed sensible defaults so the feature is never an empty dead-end.
export async function getNoteTypes() {
  let types = await db.chartNoteType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  if (types.length === 0) {
    await db.chartNoteType.createMany({
      data: [
        { name: "SOAP note", format: "soap", isDefault: true, active: true },
        { name: "Simple note", format: "simple", isDefault: false, active: true },
      ],
    });
    types = await db.chartNoteType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  }
  return types;
}

export async function getEncounterTypes() {
  await ensureEncounterCatalog();
  let types = await db.encounterType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  if (types.length === 0) {
    await db.encounterType.createMany({
      data: ENCOUNTER_TYPE_CATALOG.map((c) => ({
        name: c.name, code: c.code || null, codeSystem: c.codeSystem || null,
        category: c.category, active: true, isDefault: Boolean(c.isDefault),
      })),
    });
    types = await db.encounterType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  }
  return types;
}

// Canonical Note Type catalog (name + corresponding CPT/HCPCS code + category).
// Physical Therapy + Occupational Therapy + Clinical (E&M). Codes are the
// billable CPT/HCPCS that the editor auto-adds to the visit charges when picked.
export const ENCOUNTER_TYPE_CATALOG: {
  name: string; code: string; codeSystem: "CPT" | "HCPCS" | "SNOMED" | ""; category: string; isDefault?: boolean;
}[] = [
  // ---- Clinical (E&M) ----
  { name: "New Patient Visit \u2014 Level 2", code: "99202", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "New Patient Visit \u2014 Level 3", code: "99203", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "New Patient Visit \u2014 Level 4", code: "99204", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "New Patient Visit \u2014 Level 5", code: "99205", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Established Patient Visit \u2014 Level 1", code: "99211", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Established Patient Visit \u2014 Level 2", code: "99212", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Established Patient Visit \u2014 Level 3", code: "99213", codeSystem: "CPT", category: "Clinical (E&M)", isDefault: true },
  { name: "Established Patient Visit \u2014 Level 4", code: "99214", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Established Patient Visit \u2014 Level 5", code: "99215", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Telehealth Visit (Established, L3)", code: "99213", codeSystem: "CPT", category: "Clinical (E&M)" },
  { name: "Annual Wellness Visit \u2014 Initial", code: "G0438", codeSystem: "HCPCS", category: "Clinical (E&M)" },
  { name: "Annual Wellness Visit \u2014 Subsequent", code: "G0439", codeSystem: "HCPCS", category: "Clinical (E&M)" },
  // ---- Physical Therapy ----
  { name: "PT Evaluation \u2014 Low Complexity", code: "97161", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "PT Evaluation \u2014 Moderate Complexity", code: "97162", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "PT Evaluation \u2014 High Complexity", code: "97163", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "PT Re-evaluation", code: "97164", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Therapeutic Exercise", code: "97110", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Therapeutic Activities", code: "97530", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Manual Therapy", code: "97140", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Neuromuscular Re-education", code: "97112", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Gait Training", code: "97116", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Self-Care/Home Management Training", code: "97535", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Aquatic Therapy", code: "97113", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Group Therapeutic Procedure", code: "97150", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Mechanical Traction", code: "97012", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Electrical Stimulation (unattended)", code: "G0283", codeSystem: "HCPCS", category: "Physical Therapy" },
  { name: "Ultrasound Therapy", code: "97035", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Hot/Cold Packs", code: "97010", codeSystem: "CPT", category: "Physical Therapy" },
  { name: "Massage Therapy", code: "97124", codeSystem: "CPT", category: "Physical Therapy" },
  // ---- Occupational Therapy ----
  { name: "OT Evaluation \u2014 Low Complexity", code: "97165", codeSystem: "CPT", category: "Occupational Therapy" },
  { name: "OT Evaluation \u2014 Moderate Complexity", code: "97166", codeSystem: "CPT", category: "Occupational Therapy" },
  { name: "OT Evaluation \u2014 High Complexity", code: "97167", codeSystem: "CPT", category: "Occupational Therapy" },
  { name: "OT Re-evaluation", code: "97168", codeSystem: "CPT", category: "Occupational Therapy" },
];

// One-time, non-destructive backfill so existing installs gain the full Note
// Type catalog. Guarded by an AppSetting flag; never deletes admin-made types
// and only sets a default when none exists yet.
const CATALOG_FLAG = "chartingCatalog:v2";
async function ensureEncounterCatalog() {
  const done = await db.appSetting.findUnique({ where: { key: CATALOG_FLAG } }).catch(() => null);
  if (done) return;
  const existing = await db.encounterType.findMany({ select: { name: true, isDefault: true } }).catch(() => []);
  const names = new Set(existing.map((e) => e.name));
  const anyDefault = existing.some((e) => e.isDefault);
  const toCreate = ENCOUNTER_TYPE_CATALOG.filter((c) => !names.has(c.name));
  if (toCreate.length) {
    await db.encounterType.createMany({
      data: toCreate.map((c) => ({
        name: c.name, code: c.code || null, codeSystem: c.codeSystem || null,
        category: c.category, active: true,
        isDefault: !anyDefault && Boolean(c.isDefault),
      })),
    }).catch(() => {});
  }
  await db.appSetting.upsert({
    where: { key: CATALOG_FLAG },
    create: { key: CATALOG_FLAG, value: { seededAt: new Date().toISOString(), added: toCreate.length } as object },
    update: { value: { seededAt: new Date().toISOString(), added: toCreate.length } as object },
  }).catch(() => {});
}

export async function getDefaultNoteType() {
  const types = await getNoteTypes();
  return types.find((t) => t.isDefault && t.active) || types.find((t) => t.active) || types[0] || null;
}

export async function getDefaultEncounterType() {
  const types = await getEncounterTypes();
  return types.find((t) => t.isDefault && t.active) || types.find((t) => t.active) || types[0] || null;
}
