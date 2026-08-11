import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { parseCsv, autoMap, rowToPatient, SOURCE_LABEL } from "@/lib/import/emr";

// POST /api/admin/import/preview { source, entity, csv }
// Parses the CSV, auto-detects the column mapping, and returns a preview
// (detected headers, mapping, first rows mapped, counts) — no data is written.
export async function POST(req: Request) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const source = String(b.source || "csv");
  const csv = String(b.csv || "");
  if (!SOURCE_LABEL[source]) return NextResponse.json({ error: "Unknown import source." }, { status: 400 });
  if (!csv.trim()) return NextResponse.json({ error: "Provide CSV content to preview." }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row." }, { status: 400 });

  const headers = rows[0];
  const mapping = autoMap(headers);
  const dataRows = rows.slice(1);
  const sample = dataRows.slice(0, 5).map((r) => rowToPatient(r, mapping));

  const mappedFields = Object.keys(mapping);
  const missingRequired = ["firstName", "lastName"].filter((f) => !mappedFields.includes(f));

  return NextResponse.json({
    ok: true,
    source,
    sourceLabel: SOURCE_LABEL[source],
    headers,
    mapping,
    mappedFields,
    unmappedHeaders: headers.filter((_, i) => !Object.values(mapping).includes(i)),
    missingRequired,
    rowCount: dataRows.length,
    sample,
  });
}
