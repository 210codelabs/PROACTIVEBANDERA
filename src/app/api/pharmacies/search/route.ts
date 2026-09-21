import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { maybeDailyWenoSync } from "@/lib/weno/dailySync";

export const runtime = "nodejs";

// Pharmacy search — SINGLE SOURCE OF TRUTH: the Weno national directory
// (WenoPharmacy). No local table, no hardcoded fallback. Every pharmacy search
// across the app resolves to this one authoritative, daily-synced list.
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  maybeDailyWenoSync();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });

  const where: any = { active: true };
  if (q) {
    where.OR = [
      { name: ci(q) },
      { city: ci(q) },
      { state: { contains: q } },
      { zip: { contains: q } },
      { ncpdpId: { contains: q } },
      { npi: { contains: q } },
    ];
  }

  const rows = await db.wenoPharmacy.findMany({ where, take: 25, orderBy: { name: "asc" } }).catch(() => []);
  const pharmacies = rows.map((w: any) => ({
    id: w.ncpdpId,
    ncpdpId: w.ncpdpId,
    name: w.name,
    city: w.city,
    state: w.state,
    postalCode: w.zip,
    phone: w.phone,
    npi: w.npi,
    network: (w.services || "").includes("weno") ? "weno" : "directory",
    wenoConnected: (w.services || "").includes("weno"),
    routable: true,
    source: "weno",
  }));
  return NextResponse.json({ ok: true, pharmacies });
}
