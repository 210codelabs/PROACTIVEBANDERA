import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { nppesSearch } from "@/lib/nppes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET (STAFF): general NPPES provider/organization lookup for credentialing.
// Params: npi | first_name | last_name | organization_name | taxonomy | city | state | postal | type(NPI-1|NPI-2) | limit
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const npi = (u.searchParams.get("npi") || "").replace(/\D/g, "");
  const first = (u.searchParams.get("first_name") || "").trim();
  const last = (u.searchParams.get("last_name") || "").trim();
  const org = (u.searchParams.get("organization_name") || "").trim();
  const taxonomy = (u.searchParams.get("taxonomy") || "").trim();
  const city = (u.searchParams.get("city") || "").trim();
  const state = (u.searchParams.get("state") || "").trim().toUpperCase();
  const postal = (u.searchParams.get("postal") || "").trim();
  const type = (u.searchParams.get("type") || "").trim();
  const limit = Number(u.searchParams.get("limit") || 20) || 20;

  if (!npi && !first && !last && !org && !taxonomy && !city && !postal) {
    return NextResponse.json({ error: "Provide an NPI, name, organization, taxonomy, city or ZIP to search." }, { status: 400 });
  }

  const out = await nppesSearch({
    number: npi || undefined,
    first_name: first || undefined,
    last_name: last || undefined,
    organization_name: org || undefined,
    taxonomy_description: taxonomy || undefined,
    city: city || undefined,
    state: state || undefined,
    postal_code: postal || undefined,
    enumeration_type: type === "NPI-1" || type === "NPI-2" ? type : undefined,
    limit,
  });
  if (out.error) return NextResponse.json({ error: out.error, results: [] }, { status: 502 });
  return NextResponse.json({ count: out.count, results: out.results });
}
