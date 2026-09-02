// Government validation services for medical credentialing.
// NPPES is live & public. OIG LEIE has no official REST API (monthly CSV), so it
// is a documented placeholder. SAM.gov Exclusions is live IF a SAM_API_KEY is set.

export type CheckResult = { screened: boolean; excluded: boolean | null; note: string; raw?: unknown };

export type NppesResult = {
  ok: boolean;
  error?: string;
  data?: {
    firstName: string; lastName: string; credential?: string;
    taxonomy?: string; taxonomyCode?: string;
    city?: string; state?: string; postalCode?: string; phone?: string;
    npi: string; enumerationType?: string; status?: string;
  };
};

// --- NPPES NPI Registry (public, no key) ---
export async function validateNppes(npi: string): Promise<NppesResult> {
  const clean = String(npi || "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(clean)) return { ok: false, error: "NPI must be 10 digits." };
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${clean}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, error: `NPPES HTTP ${res.status}` };
    const json = await res.json();
    if (!json.results || !json.results.length) return { ok: false, error: "No NPI record found in NPPES." };
    const r = json.results[0];
    const basic = r.basic || {};
    const primaryTax = (r.taxonomies || []).find((t: any) => t.primary) || (r.taxonomies || [])[0] || {};
    const addr = (r.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || (r.addresses || [])[0] || {};
    return {
      ok: true,
      data: {
        npi: clean,
        firstName: basic.first_name || basic.authorized_official_first_name || "",
        lastName: basic.last_name || basic.organization_name || basic.authorized_official_last_name || "",
        credential: basic.credential || undefined,
        taxonomy: primaryTax.desc || undefined,
        taxonomyCode: primaryTax.code || undefined,
        city: addr.city || undefined,
        state: addr.state || undefined,
        postalCode: addr.postal_code || undefined,
        phone: addr.telephone_number || undefined,
        enumerationType: r.enumeration_type,
        status: basic.status,
      },
    };
  } catch (e: any) {
    return { ok: false, error: `NPPES request failed: ${String(e?.message || e).slice(0, 200)}` };
  }
}

// --- OIG LEIE (Medicare/Medicaid exclusions) ---
// Uses the monthly LEIE CSV (OIG_LEIE_DATA_URL) via a lazily-cached index.
export async function checkOigLeie(firstName: string, lastName: string, npi: string): Promise<CheckResult> {
  const { matchOigLeie } = await import("./oigLeie");
  return matchOigLeie(firstName, lastName, npi);
}

// --- SAM.gov Exclusions (federal debarments) — live if SAM_API_KEY present ---
export async function checkSamGov(firstName: string, lastName: string): Promise<CheckResult> {
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) return { screened: false, excluded: null, note: "SAM.gov not screened (SAM_API_KEY not configured). Get a free key at sam.gov." };
  try {
    // v4 is the only supported version (v3 retired). Do NOT send Accept: application/json (406).
    const name = encodeURIComponent(`${lastName}, ${firstName}`.trim());
    const url = `https://api.sam.gov/entity-information/v4/exclusions?api_key=${encodeURIComponent(apiKey)}&exclusionName=${name}`;
    const res = await fetch(url);
    if (!res.ok) return { screened: false, excluded: null, note: `SAM.gov HTTP ${res.status} (v4 exclusions).` };
    const json: any = await res.json().catch(() => ({}));
    const total = json.totalRecords ?? json._embedded?.exclusionDetails?.length ?? json.excludedEntities?.length ?? 0;
    return { screened: true, excluded: total > 0, note: total > 0 ? `SAM.gov: ${total} possible exclusion match(es) — manual review required.` : "SAM.gov: no exclusions found.", raw: { total } };
  } catch (e: any) {
    return { screened: false, excluded: null, note: `SAM.gov request failed: ${String(e?.message || e).slice(0, 160)}` };
  }
}
