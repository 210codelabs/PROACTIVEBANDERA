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

export function redirectUriFor(provider: ProviderKey): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/api/admin/fhir/${provider}/callback`;
}

export async function getConnection(provider: ProviderKey) {
  return db.fhirConnection.findUnique({ where: { provider } });
}

// Mask secrets/tokens for safe display in the admin UI.
export function maskConnection(c: any) {
  if (!c) return null;
  const mask = (v?: string | null) => (v ? `••••${String(v).slice(-4)}` : null);
  return {
    provider: c.provider,
    label: c.label || FHIR_PROVIDERS[c.provider as ProviderKey]?.label || c.provider,
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

async function fhirGet(url: string, token: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/fhir+json" } });
    if (r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, 1000 * (attempt + 1))); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`FHIR ${r.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }
  throw new Error("FHIR request failed after retries (rate limited or server error).");
}

async function pageAll(startUrl: string, token: string, cap = 20): Promise<any[]> {
  const out: any[] = [];
  let next: string | undefined = startUrl;
  let pages = 0;
  while (next && pages < cap) {
    const bundle = await fhirGet(next, token);
    for (const e of (bundle.entry || [])) if (e?.resource) out.push(e.resource);
    next = (bundle.link || []).find((l: any) => l.relation === "next")?.url;
    pages++;
  }
  return out;
}

export async function searchPatients(conn: any, token: string, q: { mrn?: string; family?: string; given?: string; birthdate?: string }): Promise<any[]> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const params = new URLSearchParams();
  if (q.mrn) params.set("identifier", q.mrn);
  if (q.family) params.set("family", q.family);
  if (q.given) params.set("given", q.given);
  if (q.birthdate) params.set("birthdate", q.birthdate);
  params.set("_count", "20");
  return pageAll(`${base}/Patient?${params.toString()}`, token, 3);
}

const IMPORT_TYPES: { type: string; extra?: string }[] = [
  { type: "Condition" },
  { type: "MedicationRequest" },
  { type: "MedicationStatement" },
  { type: "AllergyIntolerance" },
  { type: "Observation", extra: "category=vital-signs" },
  { type: "Immunization" },
  { type: "Encounter" },
  { type: "DocumentReference" },
];

/** Fetch a patient + all supported clinical resources for that patient. */
export async function fetchPatientEverything(conn: any, token: string, patientId: string): Promise<any[]> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const resources: any[] = [];
  const pt = await fhirGet(`${base}/Patient/${encodeURIComponent(patientId)}`, token).catch(() => null);
  if (pt) resources.push(pt);
  for (const t of IMPORT_TYPES) {
    const q = new URLSearchParams({ patient: patientId, _count: "100" });
    if (t.extra) { const [k, v] = t.extra.split("="); q.set(k, v); }
    try {
      const got = await pageAll(`${base}/${t.type}?${q.toString()}`, token);
      resources.push(...got);
    } catch {
      // A resource type the practice hasn't enabled shouldn't abort the whole import.
    }
  }
  return resources;
}
