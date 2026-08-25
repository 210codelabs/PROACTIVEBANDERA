import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST (STAFF): import/save an NPPES pharmacy into the local Pharmacy directory
// so it can be selected for e-prescribe routing. Idempotent on NPI.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || "").trim();
  const npi = String(b.npi || "").replace(/\D/g, "");
  if (!name) return NextResponse.json({ error: "Pharmacy name is required." }, { status: 400 });

  // ncpdpId is @unique, and MongoDB's unique index treats missing values as a
  // single null — so two imports without an NCPDP collide. Always assign a
  // stable, non-null id (real NCPDP if provided, else derived from NPI).
  const rawNcpdp = String((b as any).ncpdpId || "").trim();
  const ncpdpId = rawNcpdp || (npi ? `NPI-${npi}` : `GEN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  const data = {
    name,
    ncpdpId,
    npi: npi || null,
    network: "weno",
    addressLine1: String(b.address1 || "") || null,
    city: String(b.city || "") || null,
    state: String(b.state || "") || null,
    postalCode: String(b.postal || "") || null,
    phone: String(b.phone || "") || null,
    fax: String(b.fax || "") || null,
    active: true,
  };

  try {
    // Reuse if a pharmacy with this NPI already exists (keep its existing id).
    const existing = npi ? await db.pharmacy.findFirst({ where: { npi } }) : null;
    if (existing) {
      const updated = await db.pharmacy.update({ where: { id: existing.id }, data });
      return NextResponse.json({ ok: true, pharmacy: updated, reused: true });
    }
    // Idempotent on ncpdpId — avoids the null-collision and duplicate imports.
    const created = await db.pharmacy.upsert({ where: { ncpdpId }, create: data, update: data });
    return NextResponse.json({ ok: true, pharmacy: created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save pharmacy." }, { status: 500 });
  }
}
