import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { nppesSearch } from "@/lib/nppes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET (STAFF): pharmacy locator via NPPES (organizations with pharmacy taxonomy).
// Params: name(organization_name) | city | state | postal | taxonomy(default 'pharmacy') | limit
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const name = (u.searchParams.get("name") || "").trim();
  const city = (u.searchParams.get("city") || "").trim();
  const state = (u.searchParams.get("state") || "").trim().toUpperCase();
  const postal = (u.searchParams.get("postal") || "").trim();
  const taxonomy = (u.searchParams.get("taxonomy") || "pharmacy").trim();
  const limit = Number(u.searchParams.get("limit") || 25) || 25;

  // NPPES requires more than just state; ensure at least a city/postal/name is present.
  if (!name && !city && !postal) {
    return NextResponse.json({ error: "Enter a pharmacy name, city or ZIP to search." }, { status: 400 });
  }

  const out = await nppesSearch({
    organization_name: name || undefined,
    taxonomy_description: taxonomy || undefined,
    city: city || undefined,
    state: state || undefined,
    postal_code: postal || undefined,
    enumeration_type: "NPI-2",
    limit,
  });
  if (out.error) return NextResponse.json({ error: out.error, pharmacies: [] }, { status: 502 });

  const pharmacies = out.results.map((r) => ({
    npi: r.npi,
    name: r.name,
    taxonomy: r.primaryTaxonomy?.desc || "",
    address1: r.practice?.address1 || "",
    city: r.practice?.city || "",
    state: r.practice?.state || "",
    postal: r.practice?.postal || "",
    phone: r.practice?.phone || "",
    fax: r.practice?.fax || "",
  }));
  return NextResponse.json({ count: out.count, pharmacies });
}
