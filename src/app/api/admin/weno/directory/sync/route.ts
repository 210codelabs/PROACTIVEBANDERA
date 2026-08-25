import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { downloadPharmacyDirectory, getWenoConfig, WenoError } from "@/lib/weno";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/admin/weno/directory/sync -> download Weno pharmacy directory and
// upsert into the local WenoPharmacy cache so clinicians can search by name.
export async function POST() {
  await requireAdminSession();
  const cfg = await getWenoConfig();
  if (!cfg.partnerId || !cfg.md5Password) {
    return NextResponse.json({ error: "Configure Weno credentials first (Admin → Integrations)." }, { status: 400 });
  }
  try {
    const rows = await downloadPharmacyDirectory();
    if (rows.length === 0) return NextResponse.json({ ok: true, imported: 0, note: "Weno returned an empty directory." });
    // Bound the batch to keep the request within limits.
    const capped = rows.slice(0, 20000);
    let imported = 0;
    for (const p of capped) {
      try {
        await db.wenoPharmacy.upsert({
          where: { ncpdpId: p.ncpdpId },
          create: { ncpdpId: p.ncpdpId, name: p.name, address: p.address || null, city: p.city || null, state: p.state || null, zip: p.zip || null, phone: p.phone || null, fax: p.fax || null, npi: p.npi || null, services: p.services || null, raw: p.raw || null },
          update: { name: p.name, address: p.address || null, city: p.city || null, state: p.state || null, zip: p.zip || null, phone: p.phone || null, fax: p.fax || null, npi: p.npi || null, services: p.services || null, raw: p.raw || null, active: true },
        });
        imported++;
      } catch { /* skip bad row */ }
    }
    return NextResponse.json({ ok: true, imported, total: rows.length });
  } catch (e: any) {
    const status = e instanceof WenoError ? e.status : undefined;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: status && status >= 400 && status < 500 ? 400 : 502 });
  }
}

// GET -> how many pharmacies are cached locally.
export async function GET() {
  await requireAdminSession();
  const count = await db.wenoPharmacy.count().catch(() => 0);
  return NextResponse.json({ count });
}
