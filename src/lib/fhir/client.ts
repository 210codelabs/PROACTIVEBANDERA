/**
 * SMART-on-FHIR client for live EHR imports (Practice Fusion / Veradigm, eCW).
 * Implements the authorization_code + PKCE flow, token refresh, and paged FHIR
 * reads. All vendor calls are server-side only. Secrets/tokens live in the
 * FhirConnection row and are never returned to the client unmasked.
 *
 * NOTE: this is inert until an admin supplies vendor-approved OAuth config
 * (client id, FHIR base URL, auth/token URLs, scopes) and completes the connect
 * flow. No mock/fake data is ever produced.
 */

import crypto from "node:crypto";
import { db } from "@/lib/db";

export type ProviderKey = "veradigm" | "ecw";

export const FHIR_PROVIDERS: Record<ProviderKey, { label: string; defaultScopes: string; docs: string }> = {
  veradigm: {
    label: "Practice Fusion (Veradigm)",
    defaultScopes: "openid fhirUser offline_access user/Patient.read user/Condition.read user/MedicationRequest.read user/AllergyIntolerance.read user/Observation.read user/Immunization.read user/Encounter.read user/DocumentReference.read",
    docs: "https://www.practicefusion.com/fhir/get-started/",
  },
  ecw: {
    label: "eClinicalWorks",
    defaultScopes: "openid fhirUser offline_access user/Patient.read user/Condition.read user/MedicationRequest.read user/AllergyIntolerance.read user/Observation.read user/Immunization.read user/Encounter.read user/DocumentReference.read",
    docs: "https://fhir.eclinicalworks.com/ecwopendev/documentation",
  },
};

export function isProvider(p: string): p is ProviderKey {
  return p === "veradigm" || p === "ecw";
}

export type FhirVersion = "r4" | "dstu2";

/** Normalize a raw CapabilityStatement.fhirVersion into our r4|dstu2 buckets. */
export function normalizeFhirVersion(raw?: string): FhirVersion {
  const v = String(raw || "");
  // DSTU2 = 1.0.x, STU3 treated as r4-ish is uncommon; we support R4 (4.x) + DSTU2 (1.0.x).
  if (/^1\.0/.test(v) || /dstu2/i.test(v)) return "dstu2";
  return "r4";
}

/** DSTU2 uses MedicationOrder; R4 uses MedicationRequest. Everything else is
 * named the same across the two versions for the resources we import. */
export function medicationResource(version: FhirVersion): string {
  return version === "dstu2" ? "MedicationOrder" : "MedicationRequest";
}

/** DSTU2 servers historically prefer the legacy JSON media type. */
export function fhirAccept(version: FhirVersion): string {
  return version === "dstu2" ? "application/json+fhir" : "application/fhir+json";
}

/** Resource types the bulk/patient importer pulls, for preflight checks. */
export function expectedImportResources(version: FhirVersion): string[] {
  return ["Patient", "Condition", medicationResource(version), "MedicationStatement", "AllergyIntolerance", "Observation", "Immunization", "Encounter", "DocumentReference"];
}

/**
 * Probe a FHIR base URL's public CapabilityStatement (/metadata) — no auth
 * required. Confirms reachability and detects the FHIR version + which of the
 * resource types we import are supported. This is the "test the server URL"
 * connectivity check.
 */
export async function probeServer(baseUrl: string): Promise<{
  ok: boolean; status: number; fhirVersionRaw?: string; version?: FhirVersion;
  software?: string; supported?: string[]; error?: string;
}> {
  const base = baseUrl.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/metadata`, { headers: { Accept: "application/fhir+json, application/json+fhir" }, signal: AbortSignal.timeout(12000) });
    const status = r.status;
    if (!r.ok) return { ok: false, status, error: `Server returned HTTP ${status} for /metadata.` };
    const cs = await r.json();
    const version = normalizeFhirVersion(cs.fhirVersion);
    const supported: string[] = [];
    for (const rest of (cs.rest || [])) for (const res of (rest.resource || [])) if (res.type) supported.push(res.type);
    const software = cs.software?.name ? `${cs.software.name}${cs.software.version ? " " + cs.software.version : ""}` : undefined;
    return { ok: true, status, fhirVersionRaw: cs.fhirVersion, version, software, supported: Array.from(new Set(supported)) };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message || e).slice(0, 200) };
  }
}

export function redirectUriFor(provider: ProviderKey): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/admin/fhir/${provider}/callback`;
}

// Auto-discover the SMART/OAuth endpoints from a FHIR base URL. Tries the
// standard /.well-known/smart-configuration first, then falls back to the
// CapabilityStatement (/metadata) security oauth-uris extension. This lets an
// admin enter ONLY the base URL and have the authorize/token URLs filled in.
export async function discoverSmartConfig(baseUrl: string): Promise<{
  authUrl?: string; tokenUrl?: string; introspectUrl?: string;
  capabilities?: string[]; grantTypes?: string[]; codeChallengeMethods?: string[];
  fhirVersion?: string; source: string;
}> {
  const base = baseUrl.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/.well-known/smart-configuration`, { headers: { accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      if (j.authorization_endpoint || j.token_endpoint) {
        return {
          authUrl: j.authorization_endpoint, tokenUrl: j.token_endpoint, introspectUrl: j.introspection_endpoint,
          capabilities: j.capabilities, grantTypes: j.grant_types_supported, codeChallengeMethods: j.code_challenge_methods_supported,
          source: "well-known",
        };
      }
    }
  } catch { /* fall through to metadata */ }
  try {
    const r = await fetch(`${base}/metadata`, { headers: { accept: "application/fhir+json" } });
    if (r.ok) {
      const cs = await r.json();
      let authUrl: string | undefined, tokenUrl: string | undefined;
      for (const rest of (cs.rest || [])) {
        const oauth = (rest?.security?.extension || []).find((e: any) => String(e.url).includes("oauth-uris"));
        for (const e of (oauth?.extension || [])) {
          if (e.url === "authorize") authUrl = e.valueUri;
          if (e.url === "token") tokenUrl = e.valueUri;
        }
      }
      return { authUrl, tokenUrl, fhirVersion: cs.fhirVersion, source: "metadata" };
    }
  } catch { /* fall through to error */ }
  throw new Error("Could not read SMART configuration from that base URL (tried /.well-known/smart-configuration and /metadata).");
}

export async function getConnection(provider: ProviderKey) {
  return db.fhirConnection.findUnique({ where: { provider } });
}

// Mask secrets/tokens for safe display in the admin UI.
export function maskConnection(c: any) {
  if (!c) return null;
  const mask = (v?: string | null) => (v ? `••••${String(v).slice(-4)}` : null);
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return {
    provider: c.provider,
    label: c.label || FHIR_PROVIDERS[c.provider as ProviderKey]?.label || c.provider,
    authMode: c.authMode || "user",
    fhirVersion: c.fhirVersion || "r4",
    fhirSoftware: c.fhirSoftware || null,
    fhirSupported: Array.isArray(c.fhirSupported) ? c.fhirSupported : null,
    baseUrl: c.baseUrl || null,
    authUrl: c.authUrl || null,
    tokenUrl: c.tokenUrl || null,
    clientId: c.clientId || null,
    clientSecretSet: !!c.clientSecret,
    clientSecretMasked: mask(c.clientSecret),
    scopes: c.scopes || FHIR_PROVIDERS[c.provider as ProviderKey]?.defaultScopes || null,
    status: c.status,
    connected: c.status === "connected" && !!c.accessToken,
    tokenExpiresAt: c.expiresAt || null,
    grantedScope: c.grantedScope || null,
    lastError: c.lastError || null,
    lastImportAt: c.lastImportAt || null,
    redirectUri: redirectUriFor(c.provider as ProviderKey),
    // Backend Services signing key (public only — private JWK is NEVER exposed)
    keySet: !!c.privateJwk,
    keyId: c.keyId || null,
    jwkAlg: c.jwkAlg || "RS384",
    jwkThumbprint: c.keyId ? `••••${String(c.keyId).slice(-8)}` : null,
    jwksUrl: `${base}/api/fhir/jwks/${c.provider}`,
  };
}

// ---- OAuth (authorization_code + PKCE) ----

export function buildAuthUrl(conn: any): { url: string; verifier: string; state: string } {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(24).toString("hex");
  const u = new URL(conn.authUrl);
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: conn.clientId,
    redirect_uri: redirectUriFor(conn.provider),
    scope: conn.scopes || FHIR_PROVIDERS[conn.provider as ProviderKey].defaultScopes,
    aud: conn.baseUrl || "",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url: u.toString(), verifier, state };
}

export async function exchangeCode(conn: any, code: string): Promise<any> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUriFor(conn.provider),
    client_id: conn.clientId,
    code_verifier: conn.pkceVerifier || "",
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (conn.clientSecret) headers.authorization = "Basic " + Buffer.from(`${conn.clientId}:${conn.clientSecret}`).toString("base64");
  const r = await fetch(conn.tokenUrl, { method: "POST", headers, body: form });
  const text = await r.text();
  if (!r.ok) throw new Error(`Token exchange failed (${r.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function refreshToken(conn: any): Promise<any> {
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: conn.clientId });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (conn.clientSecret) headers.authorization = "Basic " + Buffer.from(`${conn.clientId}:${conn.clientSecret}`).toString("base64");
  const r = await fetch(conn.tokenUrl, { method: "POST", headers, body: form });
  const text = await r.text();
  if (!r.ok) throw new Error(`Token refresh failed (${r.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** Return a valid bearer token, refreshing if needed. Throws if not connected. */
export async function ensureAccessToken(conn: any): Promise<string> {
  if (!conn?.accessToken) throw new Error("Not connected — complete the Connect flow first.");
  const soon = Date.now() + 60_000;
  if (conn.expiresAt && new Date(conn.expiresAt).getTime() > soon) return conn.accessToken;
  if (!conn.refreshToken) {
    if (conn.expiresAt && new Date(conn.expiresAt).getTime() <= soon) throw new Error("Access token expired — reconnect required.");
    return conn.accessToken;
  }
  const t = await refreshToken(conn);
  await db.fhirConnection.update({
    where: { provider: conn.provider },
    data: {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || conn.refreshToken,
      expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000),
      grantedScope: t.scope || conn.grantedScope,
      status: "connected",
    },
  });
  return t.access_token;
}

// ---- FHIR reads ----

async function fhirGet(url: string, token: string, version: FhirVersion = "r4"): Promise<any> {
  const accept = `${fhirAccept(version)}, application/fhir+json, application/json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept } });
    if (r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, 1000 * (attempt + 1))); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`FHIR ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }
  throw new Error("FHIR request failed after retries (rate limited or server error).");
}

async function pageAll(startUrl: string, token: string, cap = 20, version: FhirVersion = "r4"): Promise<any[]> {
  const out: any[] = [];
  let next: string | undefined = startUrl;
  let pages = 0;
  while (next && pages < cap) {
    const bundle = await fhirGet(next, token, version);
    for (const e of (bundle.entry || [])) if (e?.resource) out.push(e.resource);
    next = (bundle.link || []).find((l: any) => l.relation === "next")?.url;
    pages++;
  }
  return out;
}

export async function searchPatients(conn: any, token: string, q: { mrn?: string; family?: string; given?: string; birthdate?: string }): Promise<any[]> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const version: FhirVersion = (conn.fhirVersion as FhirVersion) || "r4";
  const params = new URLSearchParams();
  if (q.mrn) params.set("identifier", q.mrn);
  if (q.family) params.set("family", q.family);
  if (q.given) params.set("given", q.given);
  if (q.birthdate) params.set("birthdate", q.birthdate);
  params.set("_count", "20");
  return pageAll(`${base}/Patient?${params.toString()}`, token, 3, version);
}

/** Best-effort total patient count via _summary=count. Returns null if the
 * server doesn't report bundle.total (some servers omit it). */
export async function countPatients(conn: any, token: string): Promise<number | null> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const version: FhirVersion = (conn.fhirVersion as FhirVersion) || "r4";
  try {
    const b = await fhirGet(`${base}/Patient?_summary=count`, token, version);
    return typeof b?.total === "number" ? b.total : null;
  } catch {
    return null;
  }
}

/** Async generator that yields EVERY Patient resource, paging through the whole
 * server by following Bundle `next` links. Used by the bulk migration worker.
 * A high page cap guards against a runaway loop on a misbehaving server. */
export async function* iteratePatients(conn: any, token: string, pageSize = 50, maxPages = 5000): AsyncGenerator<any> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const version: FhirVersion = (conn.fhirVersion as FhirVersion) || "r4";
  let next: string | undefined = `${base}/Patient?_count=${pageSize}`;
  let pages = 0;
  while (next && pages < maxPages) {
    const bundle: any = await fhirGet(next, token, version);
    for (const e of (bundle.entry || [])) {
      if (e?.resource?.resourceType === "Patient") yield e.resource;
    }
    next = (bundle.link || []).find((l: any) => l.relation === "next")?.url;
    pages++;
  }
}

/** Fetch a patient + all supported clinical resources for that patient. */
export async function fetchPatientEverything(conn: any, token: string, patientId: string): Promise<any[]> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const version: FhirVersion = (conn.fhirVersion as FhirVersion) || "r4";
  const importTypes: { type: string; extra?: string }[] = [
    { type: "Condition" },
    { type: medicationResource(version) },      // R4: MedicationRequest · DSTU2: MedicationOrder
    { type: "MedicationStatement" },
    { type: "AllergyIntolerance" },
    { type: "Observation", extra: "category=vital-signs" },
    { type: "Immunization" },
    { type: "Encounter" },
    { type: "DocumentReference" },
  ];
  const resources: any[] = [];
  const pt = await fhirGet(`${base}/Patient/${encodeURIComponent(patientId)}`, token, version).catch(() => null);
  if (pt) resources.push(pt);
  for (const t of importTypes) {
    const q = new URLSearchParams({ patient: patientId, _count: "100" });
    if (t.extra) { const [k, v] = t.extra.split("="); q.set(k, v); }
    try {
      let got = await pageAll(`${base}/${t.type}?${q.toString()}`, token, 20, version);
      // DSTU2 vitals fallback: some DSTU2 servers don't support the
      // category=vital-signs search param and return nothing. Re-query without
      // the category filter so vitals are still captured (the importer filters
      // to vital-signs by Observation.category/code downstream).
      if (t.type === "Observation" && version === "dstu2" && got.length === 0) {
        got = await pageAll(`${base}/Observation?patient=${encodeURIComponent(patientId)}&_count=100`, token, 20, version);
      }
      resources.push(...got);
    } catch {
      // A resource type the practice hasn't enabled shouldn't abort the whole import.
    }
  }
  return resources;
}
