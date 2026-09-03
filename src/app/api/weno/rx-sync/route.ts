import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WenoIntegrationService, WenoOnlineError, type RxSyncRow } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESCRIBER_ROLES = ["provider", "admin"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Split a Weno "Prescribe" drug string (e.g. "Lipitor 20 MG Oral Tablet") into
// a display name + best-effort strength.
function parseDrug(s: string): { name: string; strength: string | null } {
  const name = String(s || "").trim();
  const m = name.match(/(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units?|%|iu))\b/i);
  return { name, strength: m ? m[1].trim() : null };
}

const normName = (s: string | null | undefined) => String(s || "").trim().toLowerCase();

// POST /api/weno/rx-sync?patientId=<optional>&days=7
// Pulls Weno's NewRx Sync Report for the last <days> (max 7) and imports signed
// prescriptions into the patient medication history (source="weno"). If a
// patientId is supplied, only that patient's rows are imported. Admin/prescriber.
export async function POST(req: Request) {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber/admin account is required." }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const patientId = (sp.get("patientId") || "").trim();
  let days = parseInt(sp.get("days") || "7", 10);
  if (!Number.isFinite(days) || days < 1) days = 7;
  if (days > 7) days = 7; // Weno max window is 7 days

  const now = new Date();
  const from = ymd(new Date(now.getTime() - (days - 1) * 86400000));
  const to = ymd(now);

  let rows: RxSyncRow[];
  let environment: string;
  try {
    const res = await new WenoIntegrationService().fetchRxSyncReport(from, to);
    rows = res.rows;
    environment = res.environment;
  } catch (e: any) {
    const status = e instanceof WenoOnlineError ? (e.status && e.status >= 400 && e.status < 600 ? e.status : 502) : 502;
    return NextResponse.json({ error: String(e?.message || "Weno sync failed.").slice(0, 300) }, { status });
  }

  // Only NewRx rows that actually carry a drug; optionally scoped to one patient.
  const candidates = rows.filter((r) => r.drug && (!patientId || r.patientId === patientId));

  let imported = 0;
  let skipped = 0;
  const importedNames: string[] = [];

  for (const r of candidates) {
    const pid = r.patientId;
    if (!pid) { skipped++; continue; }
    const patient = await db.patient.findUnique({ where: { id: pid } }).catch(() => null);
    if (!patient) { skipped++; continue; }

    const { name, strength } = parseDrug(r.drug);
    if (!name) { skipped++; continue; }

    const startDate = r.dateUtc && !isNaN(Date.parse(r.dateUtc)) ? new Date(r.dateUtc) : new Date();
    const dayKey = ymd(startDate);
    const msgTag = r.relatesToMsgId ? `msg ${r.relatesToMsgId}` : "";
    const notes = `Weno eRx${r.deliveryStatus ? ` · ${r.deliveryStatus}` : ""}${r.dateUtc ? ` · ${r.dateUtc}` : ""}${msgTag ? ` (${msgTag})` : ""}`.slice(0, 300);

    // Idempotency: skip if we already imported this message id, or the same
    // drug for the same patient on the same day from Weno.
    try {
      const existing = await db.medication.findMany({ where: { patientId: pid, source: "weno" } });
      const dup = existing.find((m) => {
        if (msgTag && String(m.notes || "").includes(msgTag)) return true;
        return normName(m.name) === normName(name) && ymd(new Date(m.startDate || m.createdAt)) === dayKey;
      });
      if (dup) { skipped++; continue; }
    } catch { /* best-effort dedupe */ }

    try {
      await db.medication.create({
        data: {
          patientId: pid,
          name: name.slice(0, 200),
          strength: strength,
          status: "active",
          source: "weno",
          startDate,
          notes,
        },
      });
      imported++;
      if (importedNames.length < 20) importedNames.push(name);
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    environment,
    range: { from, to },
    rowCount: rows.length,
    matched: candidates.length,
    imported,
    skipped,
    importedNames,
  });
}
