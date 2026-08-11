import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseCsv, autoMap, rowToPatient, SOURCE_LABEL, type Mapping } from "@/lib/import/emr";

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

// POST /api/admin/import/commit { source, entity, csv, mapping? }
// Imports patient rows. Non-destructive: dedupes by MRN (if present) or by
// firstName+lastName+dob, and skips existing records. Never overwrites.
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const source = String(b.source || "csv");
  const csv = String(b.csv || "");
  if (!SOURCE_LABEL[source]) return NextResponse.json({ error: "Unknown import source." }, { status: 400 });
  if (!csv.trim()) return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row." }, { status: 400 });

  const headers = rows[0];
  const mapping: Mapping = (b.mapping && typeof b.mapping === "object") ? b.mapping : autoMap(headers);
  if (mapping.firstName == null || mapping.lastName == null) {
    return NextResponse.json({ error: "Could not map first name and last name columns. Check your file headers." }, { status: 400 });
  }

  const dataRows = rows.slice(1);
  let created = 0, skipped = 0, failed = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const p = rowToPatient(dataRows[i], mapping);
    const rowNum = i + 2; // header = row 1
    try {
      if (!p.firstName || !p.lastName) { skipped++; errors.push({ row: rowNum, message: "Missing first/last name" }); continue; }
      const dob = p.dob ? new Date(p.dob) : null;

      // Dedupe
      let existing = null as any;
      if (p.mrn) existing = await db.patient.findFirst({ where: { mrn: p.mrn } });
      if (!existing) {
        existing = await db.patient.findFirst({
          where: {
            firstName: { equals: p.firstName, mode: "insensitive" },
            lastName: { equals: p.lastName, mode: "insensitive" },
            ...(dob ? { dob } : {}),
          },
        });
      }
      if (existing) { skipped++; continue; }

      // Ensure MRN uniqueness
      let mrn = p.mrn && p.mrn.trim() ? p.mrn.trim() : nextMrn();
      let guard = 0;
      while (await db.patient.findFirst({ where: { mrn } })) { mrn = nextMrn(); if (++guard > 8) break; }

      await db.patient.create({
        data: {
          mrn,
          firstName: p.firstName,
          lastName: p.lastName,
          dob: dob || new Date("1900-01-01"),
          sex: p.sex || "U",
          email: p.email || null,
          phone: p.phone || null,
          addressLine1: p.addressLine1 || null,
          addressLine2: p.addressLine2 || null,
          city: p.city || null,
          state: p.state || null,
          postalCode: p.postalCode || null,
          insurerName: p.insurerName || null,
          insurerPlan: p.insurerPlan || null,
          memberId: p.memberId || null,
          groupNumber: p.groupNumber || null,
          preferredLang: p.preferredLang || null,
          status: "active",
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
      source, entity: "patients", status,
      total: dataRows.length, created, skipped, failed,
      errors: errors.length ? errors : undefined,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, jobId: job?.id || null, source, status, total: dataRows.length, created, skipped, failed, errors: errors.slice(0, 25) });
}

// GET /api/admin/import/commit -> recent import jobs
export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const jobs = await db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []);
  return NextResponse.json({ jobs });
}
