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
  let types = await db.encounterType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  if (types.length === 0) {
    await db.encounterType.createMany({
      data: [
        { name: "Office Visit — Established (Level 3)", code: "99213", codeSystem: "CPT", isDefault: true, active: true },
        { name: "Office Visit — Established (Level 4)", code: "99214", codeSystem: "CPT", active: true },
        { name: "New Patient Visit (Level 3)", code: "99203", codeSystem: "CPT", active: true },
        { name: "Follow-up Visit", code: "390906007", codeSystem: "SNOMED", active: true },
        { name: "Telehealth Visit", code: "448337001", codeSystem: "SNOMED", active: true },
        { name: "Procedure Visit", code: "", codeSystem: "", active: true },
        { name: "Physical Rehabilitation", code: "97110", codeSystem: "CPT", active: true },
      ],
    });
    types = await db.encounterType.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  }
  return types;
}

export async function getDefaultNoteType() {
  const types = await getNoteTypes();
  return types.find((t) => t.isDefault && t.active) || types.find((t) => t.active) || types[0] || null;
}

export async function getDefaultEncounterType() {
  const types = await getEncounterTypes();
  return types.find((t) => t.isDefault && t.active) || types.find((t) => t.active) || types[0] || null;
}
