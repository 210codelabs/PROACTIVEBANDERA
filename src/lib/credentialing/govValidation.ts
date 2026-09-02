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
// No official REST API; the List of Excluded Individuals/Entities is a monthly CSV
// download. Placeholder until a data source is configured (OIG_LEIE_DATA_URL).
export async function checkOigLeie(_firstName: string, _lastName: string, _npi: string): Promise<CheckResult> {
  if (!process.env.OIG_LEIE_DATA_URL) {
    return { screened: false, excluded: null, note: "OIG LEIE not screened (no data source configured). Verify manually at oig.hhs.gov/exclusions." };
  }
  // A configured deployment could load/index the LEIE CSV here and match on name+NPI.
  return { screened: false, excluded: null, note: "OIG LEIE data source configured but matching not enabled in this build." };
}

// --- SAM.gov Exclusions (federal debarments) — live if SAM_API_KEY present ---
export async function checkSamGov(firstName: string, lastName: string): Promise<CheckResult> {
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) return { screened: false, excluded: null, note: "SAM.gov not screened (SAM_API_KEY not configured). Get a free key at sam.gov." };
  try {
    const q = encodeURIComponent(`${lastName}, ${firstName}`.trim());
    const url = `https://api.sam.gov/entity-information/v3/exclusions?api_key=${apiKey}&exclusionName=${q}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return { screened: false, excluded: null, note: `SAM.gov HTTP ${res.status}` };
    const json = await res.json();
    const total = json.totalRecords ?? (json.excludedEntities?.length || 0);
    return { screened: true, excluded: total > 0, note: total > 0 ? `SAM.gov: ${total} possible exclusion match(es) — review required.` : "SAM.gov: no exclusions found.", raw: { total } };
  } catch (e: any) {
    return { screened: false, excluded: null, note: `SAM.gov request failed: ${String(e?.message || e).slice(0, 160)}` };
  }
}
