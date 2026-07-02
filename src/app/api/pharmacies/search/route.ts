import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Curated fallback so pharmacy search keeps working even if the DB is
// briefly unavailable in the serverless runtime.
const FALLBACK_PHARMACIES = [
  { id: "fallback-cvs", name: "CVS Pharmacy #4821", network: "surescripts", ncpdpId: "0512381", city: "Miami", state: "FL", phone: "(305) 555-0112", hours: "Mon-Sun 8a-10p", services: "drive-thru,delivery", preferred: true },
  { id: "fallback-walgreens", name: "Walgreens #6610", network: "surescripts", ncpdpId: "0661102", city: "Miami", state: "FL", phone: "(305) 555-0144", hours: "24 hours", services: "24h,delivery", preferred: true },
  { id: "fallback-inhouse", name: "Proactive In-House Dispensary", network: "internal", ncpdpId: "9000001", city: "Miami", state: "FL", phone: "(305) 555-0148", hours: "Mon-Fri 8a-6p", services: "in-house,compounding", preferred: true },
];

export async function GET(req: Request) {
  await requireSession();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  try {
    const pharmacies = await db.pharmacy.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { city: { contains: q } },
                { state: { contains: q } },
                { postalCode: { contains: q } },
                { services: { contains: q } },
                { ncpdpId: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      take: 25,
    });
    return NextResponse.json({ ok: true, pharmacies });
  } catch {
    const needle = q.toLowerCase();
    const filtered = needle
      ? FALLBACK_PHARMACIES.filter((p) =>
          [p.name, p.city, p.state, p.services].some((v) => v.toLowerCase().includes(needle)),
        )
      : FALLBACK_PHARMACIES;
    return NextResponse.json({ ok: true, pharmacies: filtered, fallback: true });
  }
}
