import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import {
  parseCsv, autoMapAppt, rowToAppt, apptStartsAt, normStatus, normDuration,
  APPT_SOURCE_LABEL, type ApptMapping,
} from "@/lib/import/appointments";

// POST /api/admin/import/appointments/preview { source, csv, mapping? }
// Parses the schedule CSV, auto-detects (or applies an override) column mapping,
// and returns a preview + the provider roster (for the "default provider" picker).
// No data is written.
export async function POST(req: Request) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const source = String(b.source || "csv");
  const csv = String(b.csv || "");
  if (!APPT_SOURCE_LABEL[source]) return NextResponse.json({ error: "Unknown import source." }, { status: 400 });
  if (!csv.trim()) return NextResponse.json({ error: "Provide CSV content to preview." }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row." }, { status: 400 });

  const headers = rows[0];
  const override = (b.mapping && typeof b.mapping === "object") ? (b.mapping as ApptMapping) : null;
  const mapping: ApptMapping = override && Object.keys(override).length ? override : autoMapAppt(headers);
  const dataRows = rows.slice(1);
  const sampleRows = dataRows.slice(0, 5);

  const sample = sampleRows.map((r) => {
    const row = rowToAppt(r, mapping);
    const starts = apptStartsAt(row);
    return {
      patient: row.patientMrn ? `MRN ${row.patientMrn}` : [row.patientFirst, row.patientLast].filter(Boolean).join(" ") || "—",
      startsAt: starts ? starts.toISOString() : null,
      provider: row.provider || row.providerNpi || "—",
      service: row.serviceName || row.serviceCode || "—",
      duration: normDuration(row.durationMin),
      status: normStatus(row.status),
      reason: row.reason || "",
    };
  });

  const mappedFields = Object.keys(mapping);
  const hasPatientId = mappedFields.includes("patientMrn") || (mappedFields.includes("patientFirst") && mappedFields.includes("patientLast"));
  const hasDate = mappedFields.includes("startsAt") || mappedFields.includes("date");
  const missingRequired: string[] = [];
  if (!hasPatientId) missingRequired.push("patient (MRN or first + last name)");
  if (!hasDate) missingRequired.push("appointment date");

  const providers = await db.user
    .findMany({ where: { role: "provider", active: true }, select: { id: true, firstName: true, lastName: true, npi: true, credential: true }, orderBy: { lastName: "asc" } })
    .catch(() => []);

  return NextResponse.json({
    ok: true,
    source,
    sourceLabel: APPT_SOURCE_LABEL[source],
    headers,
    mapping,
    mappedFields,
    unmappedHeaders: headers.filter((_, i) => !Object.values(mapping).includes(i)),
    missingRequired,
    rowCount: dataRows.length,
    sample,
    sampleRows,
    providers: providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}${p.credential ? ", " + p.credential : ""}`, npi: p.npi || null })),
  });
}
