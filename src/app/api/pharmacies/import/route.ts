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

  const data = {
    name,
    npi: npi || null,
    network: "surescripts",
    addressLine1: String(b.address1 || "") || null,
    city: String(b.city || "") || null,
    state: String(b.state || "") || null,
    postalCode: String(b.postal || "") || null,
    phone: String(b.phone || "") || null,
    fax: String(b.fax || "") || null,
    active: true,
  };

  try {
    // Reuse if a pharmacy with this NPI already exists.
    const existing = npi ? await db.pharmacy.findFirst({ where: { npi } }) : null;
    if (existing) {
      const updated = await db.pharmacy.update({ where: { id: existing.id }, data });
      return NextResponse.json({ ok: true, pharmacy: updated, reused: true });
    }
    const created = await db.pharmacy.create({ data });
    return NextResponse.json({ ok: true, pharmacy: created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save pharmacy." }, { status: 500 });
  }
}
