// Free, public CMS NPPES NPI Registry API (v2.1) — no API key required.
// https://npiregistry.cms.hhs.gov/api/?version=2.1

const BASE = "https://npiregistry.cms.hhs.gov/api/";

export type NppesAddress = {
  purpose: string; // LOCATION | MAILING
  address1: string; address2: string; city: string; state: string;
  postal: string; country: string; phone: string; fax: string;
};

export type NppesTaxonomy = { code: string; desc: string; primary: boolean; state: string; license: string };

export type NppesResult = {
  npi: string;
  type: "individual" | "organization";
  name: string;
  credential: string;
  gender: string;
  status: string; // A active
  soleProprietor: string;
  enumerationDate: string;
  lastUpdated: string;
  authorizedOfficial: string;
  primaryTaxonomy: NppesTaxonomy | null;
  taxonomies: NppesTaxonomy[];
  practice: NppesAddress | null;
  mailing: NppesAddress | null;
};

type RawAddr = {
  address_purpose?: string; address_1?: string; address_2?: string; city?: string; state?: string;
  postal_code?: string; country_code?: string; telephone_number?: string; fax_number?: string;
};
type RawTax = { code?: string; desc?: string; primary?: boolean; state?: string; license?: string };
type RawResult = {
  number?: number | string;
  enumeration_type?: string;
  basic?: Record<string, string | undefined>;
  addresses?: RawAddr[];
  taxonomies?: RawTax[];
};

export type NppesQuery = {
  number?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  taxonomy_description?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  enumeration_type?: string; // NPI-1 | NPI-2
  limit?: number;
};

function normAddr(a?: RawAddr): NppesAddress | null {
  if (!a) return null;
  return {
    purpose: a.address_purpose || "",
    address1: a.address_1 || "", address2: a.address_2 || "",
    city: a.city || "", state: a.state || "", postal: (a.postal_code || "").slice(0, 5),
    country: a.country_code || "US", phone: a.telephone_number || "", fax: a.fax_number || "",
  };
}

function normTax(t: RawTax): NppesTaxonomy {
  return { code: t.code || "", desc: t.desc || "", primary: Boolean(t.primary), state: t.state || "", license: t.license || "" };
}

export function normalize(r: RawResult): NppesResult {
  const b = r.basic || {};
  const isOrg = r.enumeration_type === "NPI-2";
  const name = isOrg
    ? (b.organization_name || "").trim()
    : `${b.first_name || ""} ${b.middle_name || ""} ${b.last_name || ""}`.replace(/\s+/g, " ").trim();
  const taxes = (r.taxonomies || []).map(normTax);
  const primary = taxes.find((t) => t.primary) || taxes[0] || null;
  const addrs = r.addresses || [];
  const practice = normAddr(addrs.find((a) => a.address_purpose === "LOCATION") || addrs[0]);
  const mailing = normAddr(addrs.find((a) => a.address_purpose === "MAILING"));
  return {
    npi: String(r.number || ""),
    type: isOrg ? "organization" : "individual",
    name,
    credential: (b.credential || "").trim(),
    gender: b.gender || "",
    status: b.status || "",
    soleProprietor: b.sole_proprietor || "",
    enumerationDate: b.enumeration_date || "",
    lastUpdated: b.last_updated || "",
    authorizedOfficial: isOrg
      ? `${b.authorized_official_first_name || ""} ${b.authorized_official_last_name || ""}`.trim()
      : "",
    primaryTaxonomy: primary,
    taxonomies: taxes,
    practice,
    mailing,
  };
}

export async function nppesSearch(q: NppesQuery): Promise<{ count: number; results: NppesResult[]; error?: string }> {
  const params = new URLSearchParams({ version: "2.1" });
  // NPPES name fields need a trailing wildcard (>=2 chars) to match as "starts with".
  const wc = (v?: string) => {
    const s = (v || "").trim();
    if (!s) return undefined;
    if (s.includes("*")) return s;
    return s.length >= 2 ? `${s}*` : s;
  };
  if (q.number) params.set("number", q.number);
  const fn = wc(q.first_name); if (fn) params.set("first_name", fn);
  const ln = wc(q.last_name); if (ln) params.set("last_name", ln);
  const on = wc(q.organization_name); if (on) params.set("organization_name", on);
  if (q.taxonomy_description) params.set("taxonomy_description", q.taxonomy_description);
  if (q.city) params.set("city", q.city);
  if (q.state) params.set("state", q.state);
  if (q.postal_code) params.set("postal_code", q.postal_code);
  if (q.enumeration_type) params.set("enumeration_type", q.enumeration_type);
  // NPPES can be loose with name filtering, so pull a wide page and filter locally.
  const hasName = Boolean(q.first_name || q.last_name || q.organization_name);
  const fetchLimit = hasName ? 200 : Math.min(q.limit || 20, 200);
  params.set("limit", String(fetchLimit));

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { count: 0, results: [], error: `NPPES responded ${res.status}` };
    const data = await res.json();
    if (data?.Errors?.length) {
      return { count: 0, results: [], error: data.Errors[0]?.description || "NPPES query error" };
    }
    let results: NppesResult[] = (data.results || []).map((r: RawResult) => normalize(r));

    // Enforce relevance client-side (NPPES sometimes ignores single name fields).
    const first = (q.first_name || "").trim().toLowerCase();
    const last = (q.last_name || "").trim().toLowerCase();
    const org = (q.organization_name || "").trim().toLowerCase();
    if (first || last) {
      results = results.filter((r) => {
        if (r.type !== "individual") return false;
        const parts = r.name.toLowerCase().split(/\s+/);
        const lastName = parts[parts.length - 1] || "";
        const firstName = parts[0] || "";
        const okFirst = !first || firstName.startsWith(first);
        const okLast = !last || lastName.startsWith(last) || r.name.toLowerCase().includes(` ${last}`);
        return okFirst && okLast;
      });
    }
    if (org) {
      results = results.filter((r) => r.name.toLowerCase().includes(org));
    }

    const finalLimit = Math.min(q.limit || 20, 200);
    const trimmed = results.slice(0, finalLimit);
    return { count: hasName ? results.length : (data.result_count || results.length), results: trimmed };
  } catch (e) {
    return { count: 0, results: [], error: e instanceof Error ? e.message : "NPPES request failed" };
  }
}
