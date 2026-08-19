/**
 * openFDA client — official FDA public data (api.fda.gov). Server-only.
 * Powers medication typeahead (NDC Directory), NDC lookup, and real-time SPL
 * product labeling. No API key required; if OPENFDA_API_KEY is set it is used
 * (raises the daily rate limit). Small in-memory TTL cache reduces upstream calls.
 *
 * NOTE: FDA data is informational and unvalidated — never the sole basis for a
 * clinical decision. Surface a source/disclaimer wherever it is shown.
 */

const FDA = "https://api.fda.gov/drug";
type Dataset = "ndc" | "label" | "drugsfda";
const ENDPOINT: Record<Dataset, string> = {
  ndc: `${FDA}/ndc.json`,
  label: `${FDA}/label.json`,
  drugsfda: `${FDA}/drugsfda.json`,
};

// ---- tiny in-memory TTL cache ----
const cache = new Map<string, { exp: number; data: any }>();
function cget(k: string) {
  const e = cache.get(k);
  if (e && e.exp > Date.now()) return e.data;
  if (e) cache.delete(k);
  return null;
}
function cset(k: string, data: any, ttlMs: number) {
  if (cache.size > 600) { const first = cache.keys().next().value; if (first) cache.delete(first); }
  cache.set(k, { exp: Date.now() + ttlMs, data });
}

export async function openFda(dataset: Dataset, params: Record<string, string | number>, ttlMs = 60000): Promise<any> {
  const q = new URLSearchParams();
  if (process.env.OPENFDA_API_KEY) q.set("api_key", process.env.OPENFDA_API_KEY);
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  const ck = dataset + "?" + Array.from(q.entries()).filter(([k]) => k !== "api_key").map(([k, v]) => `${k}=${v}`).join("&");
  const hit = cget(ck);
  if (hit) return hit;

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT[dataset]}?${q.toString()}`, { signal: AbortSignal.timeout(12000) } as any);
  } catch {
    return { results: [], meta: null, error: "network" };
  }
  if (res.status === 404) { const empty = { results: [], meta: null, notFound: true }; cset(ck, empty, ttlMs); return empty; }
  if (!res.ok) return { results: [], meta: null, error: `status ${res.status}` };
  const data = await res.json();
  cset(ck, data, ttlMs);
  return data;
}

function sanitizeTerm(q: string): string {
  return String(q || "").replace(/[+\-!(){}\[\]^"~*?:\\/]/g, " ").trim();
}

export type DrugHit = {
  id: string;
  productNdc: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  route: string;
  labelerName: string;
  deaSchedule: string;
  productType: string;
  pharmClass: string[];
  activeIngredients: { name: string; strength: string }[];
  strengths: string[];
  packaging: { ndc: string; description: string }[];
  marketingCategory: string;
  display: string;
};

function normalizeNdc(d: any): DrugHit {
  const route = Array.isArray(d.route) ? d.route.join(", ") : (d.route || "");
  const ai = (d.active_ingredients || []).map((a: any) => ({ name: a.name || "", strength: a.strength || "" }));
  const strengths = ai.map((a: any) => a.strength).filter(Boolean);
  return {
    id: d.product_id || d.product_ndc || Math.random().toString(36).slice(2),
    productNdc: d.product_ndc || "",
    brandName: d.brand_name || "",
    genericName: d.generic_name || "",
    dosageForm: d.dosage_form || "",
    route,
    labelerName: d.labeler_name || "",
    deaSchedule: d.dea_schedule || "",
    productType: d.product_type || "",
    pharmClass: Array.isArray(d.pharm_class) ? d.pharm_class : (d.pharm_class ? [d.pharm_class] : []),
    activeIngredients: ai,
    strengths,
    packaging: (d.packaging || []).map((p: any) => ({ ndc: p.package_ndc || "", description: p.description || "" })),
    marketingCategory: d.marketing_category || "",
    display: [d.brand_name || d.generic_name, strengths[0], d.dosage_form].filter(Boolean).join(" "),
  };
}

export async function searchDrugs(qRaw: string, limit = 12): Promise<DrugHit[]> {
  const safe = sanitizeTerm(qRaw);
  if (safe.length < 2) return [];
  const data = await openFda("ndc", { search: `(brand_name:${safe}* OR generic_name:${safe}*)`, limit }, 120000);
  const seen = new Set<string>();
  const out: DrugHit[] = [];
  for (const d of data.results || []) {
    const hit = normalizeNdc(d);
    const key = hit.productNdc || hit.display;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

export async function ndcLookup(ndcRaw: string): Promise<DrugHit | null> {
  const norm = String(ndcRaw || "").trim();
  let data = await openFda("ndc", { search: `product_ndc.exact:"${norm}"`, limit: 1 }, 3600000);
  if (data.notFound || !data.results?.length) {
    data = await openFda("ndc", { search: `packaging.package_ndc.exact:"${norm}"`, limit: 1 }, 3600000);
  }
  const r = data.results?.[0];
  return r ? normalizeNdc(r) : null;
}

const sec = (v: any): string => (Array.isArray(v) ? v.join("\n\n") : (v || ""));

export type DrugLabel = {
  brandName: string;
  genericName: string;
  manufacturer: string;
  rxcui: string[];
  boxedWarning: string;
  indications: string;
  dosage: string;
  contraindications: string;
  warnings: string;
  adverseReactions: string;
  drugInteractions: string;
  description: string;
  effectiveTime: string;
};

export async function labelLookup(opts: { productNdc?: string; name?: string }): Promise<DrugLabel | null> {
  let data: any = null;
  if (opts.productNdc) {
    data = await openFda("label", { search: `openfda.product_ndc.exact:"${opts.productNdc}"`, limit: 1 }, 900000);
  }
  if ((!data || data.notFound || !data.results?.length) && opts.name) {
    const safe = sanitizeTerm(opts.name);
    if (safe.length >= 2) {
      data = await openFda("label", { search: `(openfda.generic_name:${safe}* OR openfda.brand_name:${safe}*)`, limit: 1 }, 900000);
    }
  }
  const r = data?.results?.[0];
  if (!r) return null;
  return {
    brandName: r.openfda?.brand_name?.[0] || "",
    genericName: r.openfda?.generic_name?.[0] || "",
    manufacturer: r.openfda?.manufacturer_name?.[0] || "",
    rxcui: r.openfda?.rxcui || [],
    boxedWarning: sec(r.boxed_warning),
    indications: sec(r.indications_and_usage),
    dosage: sec(r.dosage_and_administration),
    contraindications: sec(r.contraindications),
    warnings: sec(r.warnings || r.warnings_and_cautions),
    adverseReactions: sec(r.adverse_reactions),
    drugInteractions: sec(r.drug_interactions),
    description: sec(r.description),
    effectiveTime: r.effective_time || "",
  };
}
