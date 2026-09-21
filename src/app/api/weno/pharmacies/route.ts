import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoOnlineConfig } from "@/lib/wenoOnline";
import { maybeDailyWenoSync } from "@/lib/weno/dailySync";

export const runtime = "nodejs";

// Weno EZ TEST pharmacy so clinicians always have a valid destination while the
// integration is in test mode.
const WENO_TEST_PHARMACIES = [
  { ncpdpId: "1234567", name: "Weno Test Pharmacy", city: "Test City", state: "TX", zip: "78201", phone: "(210) 555-0100" },
];

// Query the NPPES national registry for PHARMACY organizations (NPI-2). This has
// no NCPDP ID (so it can't route a ComposeRx destination), but it lets staff
// find any US pharmacy by name/city/state/zip/NPI. Results are flagged source:nppes.
async function searchNppesPharmacies(f: { name: string; city: string; state: string; zip: string; npi: string }): Promise<any[]> {
  const canSearch = Boolean(f.npi) || f.name.length >= 2 || (f.city.length >= 2 && f.state.length >= 2) || f.zip.length >= 3;
  if (!canSearch) return [];
  const p = new URLSearchParams({ version: "2.1", enumeration_type: "NPI-2", limit: "20" });
  if (f.npi) p.set("number", f.npi);
  else {
    if (f.name) p.set("organization_name", `${f.name}*`);
    if (f.city) p.set("city", f.city);
    if (f.state) p.set("state", f.state.toUpperCase().slice(0, 2));
    if (f.zip) p.set("postal_code", `${f.zip}*`);
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://npiregistry.cms.gov/api/?${p.toString()}`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json().catch(() => ({}));
    const out: any[] = [];
    for (const res of d.results || []) {
      const taxes = res.taxonomies || [];
      const isPharmacy = taxes.some((t: any) => /pharmac/i.test(t.desc || "") || String(t.code || "").startsWith("3336"));
      // When searching by NPI directly, keep the result even if taxonomy isn't a pharmacy.
      if (!isPharmacy && !f.npi) continue;
      const addr = (res.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || (res.addresses || [])[0] || {};
      out.push({
        ncpdpId: `nppes:${res.number}`,
        npi: String(res.number),
        name: res.basic?.organization_name || res.basic?.name || "Pharmacy",
        address: [addr.address_1, addr.address_2].filter(Boolean).join(", ") || null,
        city: addr.city || null,
        state: addr.state || null,
        zip: (addr.postal_code || "").slice(0, 5) || null,
        phone: addr.telephone_number || null,
        source: "nppes",
        routable: false,
      });
    }
    return out;
  } catch { return []; }
}

// GET /api/weno/pharmacies
// Structured search across the Weno directory (real NCPDP), the local directory,
// and (optionally) the NPPES national registry.
// Params: q (free text: name/city/NCPDP/NPI) | name | city | state | zip | address | npi | nppes=0 to skip NPPES.
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  // Keep the national Weno directory fresh: kick a background daily sync if the
  // directory is stale. Never blocks or affects this response.
  maybeDailyWenoSync();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim();
  const name = (sp.get("name") || "").trim();
  const city = (sp.get("city") || "").trim();
  const state = (sp.get("state") || "").trim();
  const zip = (sp.get("zip") || "").trim();
  const address = (sp.get("address") || "").trim();
  const npi = (sp.get("npi") || "").trim();
  const sortZip = (sp.get("sortZip") || "").replace(/[^0-9]/g, "").slice(0, 5);
  const wantNppes = sp.get("nppes") !== "0";

  // A free-text value that is exactly 10 digits is treated as an NPI.
  const qIsNpi = /^\d{10}$/.test(q);
  const effNpi = npi || (qIsNpi ? q : "");

  const cfg = await getWenoOnlineConfig();
  const environment = cfg.environment;

  // Build AND conditions from whichever fields are provided.
  const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
  const and: any[] = [];
  if (name) and.push({ name: ci(name) });
  if (city) and.push({ city: ci(city) });
  if (state) and.push({ OR: [{ state: ci(state) }] });
  if (zip) and.push({ zip: { contains: zip } });
  if (address) and.push({ address: ci(address) });
  if (npi) and.push({ npi: { contains: npi } });
  // Free-text q searches name/city/ncpdp/npi together.
  if (q) and.push({ OR: [{ name: ci(q) }, { city: ci(q) }, { ncpdpId: { contains: q } }, { npi: { contains: q } }] });

  const hasCriteria = and.length > 0;
  let results: any[] = [];
  let total = 0;

  const WENO_TAKE = 60;

  if (hasCriteria) {
    // SINGLE SOURCE OF TRUTH: the Weno national directory (WenoPharmacy) only.
    // No local table, no NPPES — every pharmacy search across the app uses this
    // one authoritative, daily-synced list.
    const wenoWhere = { active: true, AND: and } as any;
    const [wenoRows, wenoTotal] = await Promise.all([
      db.wenoPharmacy.findMany({ where: wenoWhere, take: WENO_TAKE, orderBy: { name: "asc" } }).catch(() => []),
      db.wenoPharmacy.count({ where: wenoWhere }).catch(() => 0),
    ]);
    total = wenoTotal;

    results = wenoRows.map((w: any) => ({
      ncpdpId: w.ncpdpId, name: w.name, city: w.city, state: w.state, zip: w.zip, phone: w.phone, address: w.address, npi: w.npi,
      wenoConnected: (w.services || "").includes("weno"), isTest: (w.services || "").includes("test"), source: "weno", routable: true,
    }));
  }

  // Merge test pharmacies (test env) matching the query.
  if (environment === "test") {
    const needle = (q || name || city).toLowerCase();
    const tests = WENO_TEST_PHARMACIES.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.ncpdpId.includes(needle) || (p.city || "").toLowerCase().includes(needle));
    for (const t of tests) {
      if (!results.some((r) => r.ncpdpId === t.ncpdpId)) results.unshift({ ...t, isTest: true, source: "weno", routable: true });
    }
  }

  // Ranking: Weno-connected pharmacies first (they can actually receive
  // e-scripts), then other Weno rows, then saved/local, then national registry.
  const baseRank = (p: any) => (p.source === "weno" ? (p.wenoConnected ? 0 : 1) : p.source === "local" ? 2 : 3);
  // ZIP-proximity rank (exact ZIP, then same ZIP3 area, then numeric closeness).
  const zipRank = (zip: string | null | undefined, target: string) => {
    const z = (zip || "").replace(/[^0-9]/g, "").slice(0, 5);
    if (!z || !target) return 9_999_999;
    if (z === target) return 0;
    const a = parseInt(z, 10), b = parseInt(target, 10);
    const num = Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : 9_000_000;
    if (z.slice(0, 3) === target.slice(0, 3)) return 1_000 + Math.min(num, 8_998_999);
    return 100_000 + num;
  };
  if (sortZip) {
    results.sort((a, b) => zipRank(a.zip, sortZip) - zipRank(b.zip, sortZip) || baseRank(a) - baseRank(b) || String(a.name).localeCompare(String(b.name)));
  } else {
    results.sort((a, b) => baseRank(a) - baseRank(b) || String(a.name).localeCompare(String(b.name)));
  }

  const pharmacies = results.map((p) => ({
    ncpdpId: p.ncpdpId, name: p.name, city: p.city || null, state: p.state || null,
    zip: p.zip || null, phone: p.phone || null, address: p.address || null, npi: p.npi || null,
    isTest: Boolean(p.isTest), wenoConnected: p.wenoConnected ?? undefined,
    source: p.source || "weno", routable: p.routable !== false,
  }));

  return NextResponse.json({
    pharmacies,
    environment,
    // total = number of Weno-directory matches (may exceed what's returned);
    // shown = how many rows are in this response.
    total: Math.max(total, pharmacies.length),
    shown: pharmacies.length,
    wenoShown: Math.min(total, WENO_TAKE),
  });
}
