import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import {
  parseCsv, autoMapAppt, rowToAppt, apptStartsAt, normStatus, normDuration,
  dobToIso, providerMatchKeys, APPT_SOURCE_LABEL, type ApptMapping,
} from "@/lib/import/appointments";

type Prov = { id: string; firstName: string; lastName: string; npi: string | null };
type Svc = { id: string; code: string; name: string; durationMin: number; defaultCpt: string | null };

function matchProvider(row: ReturnType<typeof rowToAppt>, providers: Prov[], defaultId: string | null): string | null {
  if (row.providerNpi) {
    const npi = row.providerNpi.replace(/[^0-9]/g, "");
    const byNpi = providers.find((p) => (p.npi || "").replace(/[^0-9]/g, "") === npi && npi.length > 0);
    if (byNpi) return byNpi.id;
  }
  if (row.provider) {
    const keys = providerMatchKeys(row.provider);
    if (keys.length) {
      const exact = providers.filter((p) => keys.includes(p.firstName.toLowerCase()) && keys.includes(p.lastName.toLowerCase()));
      if (exact.length === 1) return exact[0].id;
      const byLast = providers.filter((p) => keys.includes(p.lastName.toLowerCase()));
      if (byLast.length === 1) return byLast[0].id;
    }
  }
  return defaultId;
}

async function matchPatient(row: ReturnType<typeof rowToAppt>): Promise<{ id: string } | null | "ambiguous"> {
  if (row.patientMrn) {
    const p = await db.patient.findFirst({ where: { mrn: row.patientMrn.trim() }, select: { id: true } });
    if (p) return p;
  }
  if (row.patientFirst && row.patientLast) {
    const candidates = await db.patient.findMany({
      where: {
        firstName: { equals: row.patientFirst, mode: "insensitive" },
        lastName: { equals: row.patientLast, mode: "insensitive" },
      },
      select: { id: true, dob: true },
    });
    if (candidates.length === 0) return null;
    const dobIso = dobToIso(row.patientDob);
    const narrowed = dobIso ? candidates.filter((c) => c.dob && c.dob.toISOString().slice(0, 10) === dobIso) : candidates;
    if (narrowed.length === 1) return { id: narrowed[0].id };
    if (narrowed.length === 0) return null;
    return "ambiguous";
  }
  return null;
}

// POST /api/admin/import/appointments/commit { source, csv, mapping?, defaultProviderId }
// Imports appointment rows for EXISTING patients. Rows whose patient can't be
// matched are SKIPPED (never creates patients). Providers are matched by NPI/name,
// falling back to the chosen default provider. Non-destructive: dedupes by
// patient + start time.
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const source = String(b.source || "csv");
  const csv = String(b.csv || "");
  const defaultProviderId = b.defaultProviderId ? String(b.defaultProviderId) : null;
  if (!APPT_SOURCE_LABEL[source]) return NextResponse.json({ error: "Unknown import source." }, { status: 400 });
  if (!csv.trim()) return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row." }, { status: 400 });

  const headers = rows[0];
  const mapping: ApptMapping = (b.mapping && typeof b.mapping === "object") ? b.mapping : autoMapAppt(headers);
  const mf = Object.keys(mapping);
  const hasPatientId = mf.includes("patientMrn") || (mf.includes("patientFirst") && mf.includes("patientLast"));
  const hasDate = mf.includes("startsAt") || mf.includes("date");
  if (!hasPatientId) return NextResponse.json({ error: "Map a patient identifier (MRN, or first + last name) before importing." }, { status: 400 });
  if (!hasDate) return NextResponse.json({ error: "Map an appointment date column before importing." }, { status: 400 });

  // Roster + services for matching
  const providers = (await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, firstName: true, lastName: true, npi: true } }).catch(() => [])) as Prov[];
  if (defaultProviderId && !providers.some((p) => p.id === defaultProviderId)) {
    return NextResponse.json({ error: "The selected default provider was not found." }, { status: 400 });
  }
  const services = (await db.serviceType.findMany({ where: { active: true }, select: { id: true, code: true, name: true, durationMin: true, defaultCpt: true } }).catch(() => [])) as Svc[];
  const svcByCode = new Map(services.map((s) => [s.code.toLowerCase(), s]));
  const svcByName = new Map(services.map((s) => [s.name.toLowerCase(), s]));

  const dataRows = rows.slice(1);
  let created = 0, skipped = 0, failed = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2;
    const row = rowToAppt(dataRows[i], mapping);
    try {
      const starts = apptStartsAt(row);
      if (!starts) { skipped++; if (errors.length < 50) errors.push({ row: rowNum, message: "Could not read appointment date/time" }); continue; }

      const patient = await matchPatient(row);
      if (patient === "ambiguous") { skipped++; if (errors.length < 50) errors.push({ row: rowNum, message: "Multiple patients match — skipped (add MRN or DOB)" }); continue; }
      if (!patient) { skipped++; if (errors.length < 50) errors.push({ row: rowNum, message: "Patient not found — skipped (patients are not created here)" }); continue; }

      const providerId = matchProvider(row, providers, defaultProviderId);
      if (!providerId) { skipped++; if (errors.length < 50) errors.push({ row: rowNum, message: "Provider not matched and no default provider selected — skipped" }); continue; }

      // service (optional)
      let svc: Svc | undefined;
      if (row.serviceCode) svc = svcByCode.get(row.serviceCode.toLowerCase());
      if (!svc && row.serviceName) svc = svcByName.get(row.serviceName.toLowerCase());

      const duration = normDuration(row.durationMin) ?? svc?.durationMin ?? 45;
      const ends = new Date(starts.getTime() + duration * 60_000);

      // Dedupe: same patient + same start time
      const existing = await db.appointment.findFirst({ where: { patientId: patient.id, startsAt: starts }, select: { id: true } });
      if (existing) { skipped++; continue; }

      await db.appointment.create({
        data: {
          patientId: patient.id,
          providerId,
          serviceTypeId: svc?.id ?? null,
          startsAt: starts,
          endsAt: ends,
          location: row.location || null,
          status: normStatus(row.status),
          reason: row.reason || row.serviceName || null,
          notes: null,
        },
      });
      created++;
    } catch (e: any) {
      failed++;
      if (errors.length < 50) errors.push({ row: rowNum, message: String(e?.message || e).slice(0, 140) });
    }
  }

  const status = failed > 0 ? (created > 0 ? "partial" : "failed") : "completed";
  const job = await db.importJob.create({
    data: {
      source, entity: "appointments", status,
      total: dataRows.length, created, skipped, failed,
      errors: errors.length ? errors : undefined,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, jobId: job?.id || null, source, status, total: dataRows.length, created, skipped, failed, errors: errors.slice(0, 25) });
}
