/**
 * SMART Backend Services (system-to-system) support for live EHR imports.
 *
 * This implements the "System Access" mode Practice Fusion (Veradigm) documents
 * for unattended, practice-level migration + Bulk Data $export:
 *   client_credentials grant + a signed JWT client assertion (asymmetric key).
 * No interactive user login, no clinician password. The practice registers our
 * PUBLIC key (served at the JWKS endpoint) with the vendor; we sign assertions
 * with the matching PRIVATE key (server-only, never returned to the client).
 *
 * All calls are server-side. No mock/fake patient data is produced.
 */

import crypto from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair, importJWK, calculateJwkThumbprint } from "jose";
import { db } from "@/lib/db";
import { ensureAccessToken } from "@/lib/fhir/client";

export const SYSTEM_DEFAULT_SCOPES = "system/*.read";

// US Core resource types we import (also used to constrain $export).
export const EXPORT_TYPES = [
  "Patient", "Condition", "MedicationRequest", "MedicationStatement",
  "AllergyIntolerance", "Observation", "Immunization", "Encounter", "DocumentReference",
];

/** Generate an RSA signing key pair for Backend Services. Returns JWKs (public
 * + private) as JSON strings plus the kid/alg. The private key is stored
 * server-side only; the public key is published at the JWKS endpoint. */
export async function generateSigningKey(alg = "RS384"): Promise<{ privateJwk: string; publicJwk: string; kid: string; alg: string }> {
  const { publicKey, privateKey } = await generateKeyPair(alg, { modulusLength: 2048, extractable: true });
  const pub: any = await exportJWK(publicKey);
  const priv: any = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint(pub);
  pub.kid = kid; pub.alg = alg; pub.use = "sig";
  priv.kid = kid; priv.alg = alg;
  return { privateJwk: JSON.stringify(priv), publicJwk: JSON.stringify(pub), kid, alg };
}

/** Mint a signed JWT client assertion and exchange it for a system access token
 * (client_credentials). Persists the token on the connection and returns it. */
export async function getSystemToken(conn: any): Promise<string> {
  if (!conn?.tokenUrl) throw new Error("Token URL is not set — configure the connection first.");
  if (!conn?.clientId) throw new Error("Client ID is not set — enter the vendor-issued client ID.");
  if (!conn?.privateJwk) throw new Error("No signing key — generate a signing key and register the JWKS URL with the vendor.");

  // Reuse a still-valid token (60s safety window).
  if (conn.accessToken && conn.expiresAt && new Date(conn.expiresAt).getTime() > Date.now() + 60_000) {
    return conn.accessToken;
  }

  const alg = conn.jwkAlg || "RS384";
  const key = await importJWK(JSON.parse(conn.privateJwk), alg);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ jti: crypto.randomUUID() })
    .setProtectedHeader({ alg, kid: conn.keyId, typ: "JWT" })
    .setIssuer(conn.clientId)
    .setSubject(conn.clientId)
    .setAudience(conn.tokenUrl)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: conn.scopes || SYSTEM_DEFAULT_SCOPES,
  });

  const r = await fetch(conn.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) {
    await db.fhirConnection.update({ where: { provider: conn.provider }, data: { status: "error", lastError: `System token failed (${r.status}): ${text.slice(0, 200)}` } }).catch(() => {});
    throw new Error(`System token request failed (${r.status}): ${text.slice(0, 200)}`);
  }
  let t: any;
  try { t = JSON.parse(text); } catch { throw new Error("Token endpoint did not return JSON."); }
  if (!t.access_token) throw new Error("Token endpoint did not return an access_token.");

  await db.fhirConnection.update({
    where: { provider: conn.provider },
    data: {
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + (Number(t.expires_in) || 300) * 1000),
      grantedScope: t.scope || conn.scopes || SYSTEM_DEFAULT_SCOPES,
      status: "connected",
      lastError: null,
    },
  }).catch(() => {});
  return t.access_token;
}

/** Return a valid bearer token for either auth mode (dispatches by authMode). */
export async function getValidToken(conn: any): Promise<string> {
  if ((conn?.authMode || "user") === "system") return getSystemToken(conn);
  return ensureAccessToken(conn);
}

// ---- Bulk Data $export ----

/** Kick off a system-level (or Patient-level) $export. Returns the polling URL
 * from the Content-Location header (202 Accepted). If the server rejects the
 * _type filter, retries once without it (full export). */
export async function kickoffExport(conn: any, token: string, opts: { types?: string[]; patientLevel?: boolean } = {}): Promise<string> {
  const base = String(conn.baseUrl).replace(/\/$/, "");
  const path = opts.patientLevel ? "/Patient/$export" : "/$export";
  const types = (opts.types && opts.types.length ? opts.types : EXPORT_TYPES).join(",");

  const attempt = async (withType: boolean) => {
    const url = withType ? `${base}${path}?_type=${encodeURIComponent(types)}` : `${base}${path}`;
    return fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/fhir+json", prefer: "respond-async" }, cache: "no-store" });
  };

  let r = await attempt(true);
  if (r.status !== 202) {
    const firstText = await r.text().catch(() => "");
    // Some servers reject an unsupported _type; retry as a full export.
    const retry = await attempt(false);
    if (retry.status !== 202) {
      throw new Error(`$export kickoff failed (${r.status}): ${firstText.slice(0, 200)}`);
    }
    r = retry;
  }
  const loc = r.headers.get("content-location");
  if (!loc) throw new Error("$export accepted but no Content-Location (status URL) was returned.");
  return loc;
}

/** Poll the export status URL until the manifest is ready (200) or it fails. */
export async function pollExport(statusUrl: string, token: string, opts: { maxMs?: number; onProgress?: (p: string) => void } = {}): Promise<any> {
  const maxMs = opts.maxMs ?? 120_000;
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const r = await fetch(statusUrl, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" });
    if (r.status === 202) { opts.onProgress?.(r.headers.get("x-progress") || "in progress"); await new Promise((x) => setTimeout(x, 2000)); continue; }
    if (r.status === 200) return r.json();
    const t = await r.text();
    throw new Error(`$export status failed (${r.status}): ${t.slice(0, 200)}`);
  }
  throw new Error("$export timed out waiting for the manifest.");
}

/** Download every NDJSON output file in a manifest and return a flat resource array. */
export async function downloadManifest(manifest: any, token: string): Promise<any[]> {
  const out: any[] = [];
  for (const file of (manifest.output || [])) {
    if (!file?.url) continue;
    const r = await fetch(file.url, { headers: { authorization: `Bearer ${token}`, accept: "application/fhir+ndjson" }, cache: "no-store" });
    if (!r.ok) continue; // skip a file that fails rather than aborting the whole import
    const text = await r.text();
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s)); } catch { /* skip malformed line */ }
    }
  }
  return out;
}

/** Group a flat resource array into per-patient buckets keyed by Patient.id.
 * Only patients that have a Patient resource are returned. */
export function groupByPatient(resources: any[]): Map<string, any[]> {
  const byId = new Map<string, any[]>();
  for (const r of resources) if (r?.resourceType === "Patient" && r.id) byId.set(r.id, [r]);
  const refId = (r: any): string | null => {
    const ref = r?.subject?.reference || r?.patient?.reference || "";
    const m = String(ref).match(/Patient\/([^/?]+)/);
    return m ? m[1] : null;
  };
  for (const r of resources) {
    if (!r || r.resourceType === "Patient") continue;
    const pid = refId(r);
    if (pid && byId.has(pid)) byId.get(pid)!.push(r);
  }
  return byId;
}
