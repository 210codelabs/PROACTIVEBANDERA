import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoOnlineConfig } from "@/lib/wenoOnline";

export const runtime = "nodejs";

// Weno EZ TEST pharmacy so clinicians always have a valid destination while the
// integration is in test mode.
const WENO_TEST_PHARMACIES = [
  { ncpdpId: "1234567", name: "Weno Test Pharmacy", city: "Test City", state: "TX", zip: "78201", phone: "(210) 555-0100" },
];

// GET /api/weno/pharmacies?q=... -> search the local Weno pharmacy directory by
// name / city / NCPDP ID. In the test environment, built-in Weno test
// pharmacies are merged so clinicians always have a destination to pick.
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  const cfg = await getWenoOnlineConfig();
  const environment = cfg.environment;

  let results: any[] = [];
  if (q.length >= 1) {
    const [wenoRows, localRows, dirRows] = await Promise.all([
      db.wenoPharmacy.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { ncpdpId: { contains: q } },
          ],
        },
        take: 25,
        orderBy: { name: "asc" },
      }).catch(() => []),
      // Also include the local pharmacy directory (seeded + NPPES-imported), all
      // treated as Weno-network destinations, so search stays populated even
      // before a full Weno directory sync.
      db.pharmacy.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { state: { contains: q } },
            { postalCode: { contains: q } },
            { ncpdpId: { contains: q } },
          ],
        },
        take: 25,
        orderBy: [{ preferred: "desc" }, { name: "asc" }],
      }).catch(() => []),
      // Weno EZ LITE directory (imported from the Weno directory export).
      // Weno-connected pharmacies (onWeno=true) rank first.
      db.wenoDirectoryPharmacy.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { state: { contains: q, mode: "insensitive" } },
            { zip: { contains: q } },
          ],
        },
        take: 40,
        orderBy: [{ onWeno: "desc" }, { name: "asc" }],
      }).catch(() => []),
    ]);
    results = [...wenoRows];
    for (const lp of localRows) {
      if (lp.ncpdpId && results.some((r) => r.ncpdpId === lp.ncpdpId)) continue;
      results.push({
        ncpdpId: lp.ncpdpId || lp.id,
        name: lp.name,
        city: lp.city,
        state: lp.state,
        zip: lp.postalCode,
        phone: lp.phone,
        address: lp.addressLine1,
      });
    }
    for (const d of dirRows) {
      results.push({
        // LITE directory rows have no NCPDP; use the row id as a reference key.
        ncpdpId: d.id,
        name: d.name,
        city: d.city,
        state: d.state,
        zip: d.zip,
        phone: null,
        address: [d.address1, d.address2].filter(Boolean).join(", ") || null,
        wenoConnected: d.onWeno,
        mailOrder: d.mailOrder,
      });
    }
  }

  // Merge test pharmacies (test env) matching the query.
  if (environment === "test") {
    const ql = q.toLowerCase();
    const tests = WENO_TEST_PHARMACIES.filter((p) => !q || p.name.toLowerCase().includes(ql) || p.ncpdpId.includes(q) || (p.city || "").toLowerCase().includes(ql));
    for (const t of tests) {
      if (!results.some((r) => r.ncpdpId === t.ncpdpId)) results.unshift({ ...t, isTest: true });
    }
  }

  return NextResponse.json({
    pharmacies: results.map((p) => ({
      ncpdpId: p.ncpdpId, name: p.name, city: p.city || null, state: p.state || null,
      zip: p.zip || null, phone: p.phone || null, address: p.address || null, isTest: Boolean(p.isTest),
      wenoConnected: p.wenoConnected ?? undefined, mailOrder: p.mailOrder ?? undefined,
    })),
    environment,
  });
}
