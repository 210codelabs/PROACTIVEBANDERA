import { db } from "./db";

// Collections included in backup / restore (Mongo collection == Prisma model name).
export const BACKUP_MODELS: { name: string; delegate: any }[] = [
  { name: "Patient", delegate: db.patient },
  { name: "Encounter", delegate: db.encounter },
  { name: "EncounterNote", delegate: db.encounterNote },
  { name: "EncounterDiagnosis", delegate: db.encounterDiagnosis },
  { name: "EncounterCharge", delegate: db.encounterCharge },
  { name: "Order", delegate: db.order },
  { name: "Appointment", delegate: db.appointment },
  { name: "Document", delegate: db.document },
  { name: "Problem", delegate: db.problem },
  { name: "Allergy", delegate: db.allergy },
  { name: "Medication", delegate: db.medication },
  { name: "Vital", delegate: db.vital },
  { name: "Immunization", delegate: db.immunization },
  { name: "Message", delegate: db.message },
  { name: "CareTeamMember", delegate: db.careTeamMember },
  { name: "Template", delegate: db.template },
  { name: "Addendum", delegate: db.addendum },
  { name: "AppSetting", delegate: db.appSetting },
  { name: "ServiceType", delegate: db.serviceType },
  { name: "RefData", delegate: db.refData },
  { name: "ChartNoteType", delegate: db.chartNoteType },
  { name: "EncounterType", delegate: db.encounterType },
  { name: "Pharmacy", delegate: db.pharmacy },
];

const INDEX_PLAN: Record<string, Record<string, 1 | -1>[]> = {
  Patient: [{ lastName: 1 }, { firstName: 1 }, { mrn: 1 }, { status: 1 }, { dob: 1 }, { email: 1 }, { phone: 1 }],
  Encounter: [{ patientId: 1 }, { status: 1 }, { createdAt: -1 }],
  Order: [{ patientId: 1 }, { status: 1 }],
  Appointment: [{ patientId: 1 }, { start: 1 }],
  Document: [{ patientId: 1 }, { category: 1 }, { createdAt: -1 }],
  Message: [{ patientId: 1 }, { createdAt: -1 }],
  AuditLog: [{ createdAt: -1 }],
  CareTeamMember: [{ patientId: 1 }],
};

// ---- Health ----
export async function dbHealth() {
  const out: any = { ok: true, checkedAt: new Date().toISOString() };
  try {
    const t0 = Date.now();
    await db.$runCommandRaw({ ping: 1 });
    out.pingMs = Date.now() - t0;
  } catch (e: any) {
    out.ok = false;
    out.pingError = String(e?.message || e);
  }
  try {
    const stats: any = await db.$runCommandRaw({ dbStats: 1, scale: 1048576 });
    out.storage = {
      dataSizeMB: Math.round((stats.dataSize || 0) * 100) / 100,
      storageSizeMB: Math.round((stats.storageSize || 0) * 100) / 100,
      indexSizeMB: Math.round((stats.indexSize || 0) * 100) / 100,
      collections: stats.collections,
      objects: stats.objects,
    };
  } catch (e: any) {
    out.storageError = String(e?.message || e);
  }
  // key counts
  const counts: Record<string, number> = {};
  try {
    counts.patients = await db.patient.count();
    counts.encounters = await db.encounter.count();
    counts.orders = await db.order.count();
    counts.appointments = await db.appointment.count();
    counts.documents = await db.document.count();
    counts.messages = await db.message.count();
  } catch (e: any) {
    out.countsError = String(e?.message || e);
  }
  out.counts = counts;
  return out;
}

// ---- Reindex (create hot-path indexes; idempotent) ----
export async function dbReindex() {
  const results: { collection: string; created: number; error?: string }[] = [];
  for (const [collection, keys] of Object.entries(INDEX_PLAN)) {
    const indexes = keys.map((key) => {
      const name = Object.entries(key).map(([k, v]) => `${k}_${v}`).join("_");
      return { key, name };
    });
    try {
      await db.$runCommandRaw({ createIndexes: collection, indexes } as any);
      results.push({ collection, created: indexes.length });
    } catch (e: any) {
      results.push({ collection, created: 0, error: String(e?.message || e) });
    }
  }
  return { ok: true, results, ranAt: new Date().toISOString() };
}

// ---- Backup (export core collections to JSON) ----
export async function dbBackup(perCollectionLimit = 20000) {
  const collections: Record<string, any[]> = {};
  const meta: Record<string, { count: number; truncated: boolean }> = {};
  for (const { name, delegate } of BACKUP_MODELS) {
    try {
      const rows = await delegate.findMany({ take: perCollectionLimit });
      collections[name] = rows;
      meta[name] = { count: rows.length, truncated: rows.length >= perCollectionLimit };
    } catch (e) {
      collections[name] = [];
      meta[name] = { count: 0, truncated: false };
    }
  }
  return {
    version: 1,
    app: "proactive-clinic",
    exportedAt: new Date().toISOString(),
    meta,
    collections,
  };
}

// ---- Restore (best-effort additive import; upsert by id) ----
const DATE_KEYS = /(At|Date|dob|start|end|dueAt|expiresAt|signedAt|birth)$/i;
function coerceDates(obj: any): any {
  if (Array.isArray(obj)) return obj.map(coerceDates);
  if (obj && typeof obj === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && (DATE_KEYS.test(k) || k === "dob") && /^\d{4}-\d\d-\d\dT/.test(v)) {
        const d = new Date(v);
        o[k] = isNaN(d.getTime()) ? v : d;
      } else if (v && typeof v === "object") {
        o[k] = coerceDates(v);
      } else {
        o[k] = v;
      }
    }
    return o;
  }
  return obj;
}

export async function dbRestore(payload: any) {
  if (!payload || typeof payload !== "object" || !payload.collections) {
    return { ok: false, error: "Invalid backup file." };
  }
  const byName = new Map(BACKUP_MODELS.map((m) => [m.name, m.delegate]));
  const summary: { collection: string; created: number; skipped: number; failed: number }[] = [];
  for (const [name, rows] of Object.entries(payload.collections as Record<string, any[]>)) {
    const delegate = byName.get(name);
    if (!delegate || !Array.isArray(rows)) continue;
    let created = 0, skipped = 0, failed = 0;
    for (const raw of rows) {
      if (!raw || !raw.id) { failed++; continue; }
      try {
        const exists = await delegate.findUnique({ where: { id: raw.id }, select: { id: true } });
        if (exists) { skipped++; continue; }
        await delegate.create({ data: coerceDates(raw) });
        created++;
      } catch {
        failed++;
      }
    }
    summary.push({ collection: name, created, skipped, failed });
  }
  return { ok: true, summary, restoredAt: new Date().toISOString() };
}
