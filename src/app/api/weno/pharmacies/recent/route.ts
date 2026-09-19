import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/weno/pharmacies/recent
// Quick-pick list of pharmacies this clinic has recently assigned to patients
// (distinct primary-pharmacy NCPDPs from the most recently updated patients),
// resolved against the Weno directory (falling back to the local directory).
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const recent = await db.patient.findMany({
      where: { primaryPharmacyNcpdp: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { primaryPharmacyNcpdp: true },
    });
    const ncpdps: string[] = [];
    for (const r of recent) {
      const n = r.primaryPharmacyNcpdp || "";
      if (n && !n.startsWith("nppes:") && !ncpdps.includes(n)) ncpdps.push(n);
      if (ncpdps.length >= 8) break;
    }
    if (ncpdps.length === 0) return NextResponse.json({ pharmacies: [] });

    const [weno, local] = await Promise.all([
      db.wenoPharmacy.findMany({ where: { ncpdpId: { in: ncpdps } } }).catch(() => []),
      db.pharmacy.findMany({ where: { ncpdpId: { in: ncpdps } } }).catch(() => []),
    ]);
    const byNcpdp = new Map<string, any>();
    for (const w of weno as any[]) {
      byNcpdp.set(w.ncpdpId, { ncpdpId: w.ncpdpId, name: w.name, city: w.city, state: w.state, zip: w.zip, phone: w.phone, npi: w.npi, source: "weno", wenoConnected: (w.services || "").includes("weno"), routable: true });
    }
    for (const lp of local as any[]) {
      if (lp.ncpdpId && !byNcpdp.has(lp.ncpdpId)) {
        byNcpdp.set(lp.ncpdpId, { ncpdpId: lp.ncpdpId, name: lp.name, city: lp.city, state: lp.state, zip: lp.postalCode, phone: lp.phone, npi: lp.npi, source: "local", routable: true });
      }
    }
    // Preserve recency order.
    const pharmacies = ncpdps.map((n) => byNcpdp.get(n)).filter(Boolean);
    return NextResponse.json({ pharmacies });
  } catch {
    return NextResponse.json({ pharmacies: [] });
  }
}
