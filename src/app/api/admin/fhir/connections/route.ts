import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { FHIR_PROVIDERS, isProvider, maskConnection, redirectUriFor, type ProviderKey } from "@/lib/fhir/client";
import { generateSigningKey, SYSTEM_DEFAULT_SCOPES } from "@/lib/fhir/backend";

// GET /api/admin/fhir/connections
// Returns provider metadata + the (masked) saved connection/status for each.
export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const rows = await db.fhirConnection.findMany();
  const byProvider: Record<string, any> = {};
  for (const r of rows) byProvider[r.provider] = maskConnection(r);

  const roster = await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, firstName: true, lastName: true, npi: true, credential: true }, orderBy: { lastName: "asc" } }).catch(() => []);

  const providers = (Object.keys(FHIR_PROVIDERS) as ProviderKey[]).map((p) => ({
    provider: p,
    label: FHIR_PROVIDERS[p].label,
    defaultScopes: FHIR_PROVIDERS[p].defaultScopes,
    docs: FHIR_PROVIDERS[p].docs,
    redirectUri: redirectUriFor(p),
    connection: byProvider[p] || null,
  }));
  return NextResponse.json({
    ok: true,
    providers,
    staff: roster.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}${u.credential ? ", " + u.credential : ""}`, npi: u.npi || null })),
  });
}

// POST /api/admin/fhir/connections
// Saves/updates OAuth + FHIR endpoint config for a provider. Two auth modes:
//  - "user":   authorization_code + PKCE (interactive provider login)
//  - "system": SMART Backend Services (client_credentials + signed JWT). For
//              system mode we auto-generate an RSA signing key (kept across
//              reconfigures unless regenerateKey=true); the PUBLIC key is served
//              at the JWKS endpoint to register with the vendor.
// Saving config clears any previously-issued access tokens (short-lived).
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const provider = String(b.provider || "");
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const authMode = b.authMode === "system" ? "system" : "user";
  const baseUrl = String(b.baseUrl || "").trim();
  const authUrl = String(b.authUrl || "").trim();
  const tokenUrl = String(b.tokenUrl || "").trim();
  const clientId = String(b.clientId || "").trim();

  if (authMode === "system") {
    if (!baseUrl || !tokenUrl) {
      return NextResponse.json({ error: "FHIR base URL and token URL are required for System access. (Save to generate your signing key, register the JWKS URL with the vendor, then add the Client ID.)" }, { status: 400 });
    }
  } else {
    if (!baseUrl || !authUrl || !tokenUrl || !clientId) {
      return NextResponse.json({ error: "FHIR base URL, authorization URL, token URL and client ID are all required." }, { status: 400 });
    }
  }
  const urlChecks: [string, string][] = authMode === "system"
    ? [["FHIR base URL", baseUrl], ["token URL", tokenUrl]]
    : [["FHIR base URL", baseUrl], ["authorization URL", authUrl], ["token URL", tokenUrl]];
  for (const [name, val] of urlChecks) {
    try { new URL(val); } catch { return NextResponse.json({ error: `The ${name} is not a valid URL.` }, { status: 400 }); }
  }

  const defaultScopes = authMode === "system" ? SYSTEM_DEFAULT_SCOPES : FHIR_PROVIDERS[provider].defaultScopes;
  const scopes = String(b.scopes || defaultScopes).trim();
  const label = b.label ? String(b.label) : FHIR_PROVIDERS[provider].label;
  const secretProvided = typeof b.clientSecret === "string" && b.clientSecret.trim().length > 0;

  const existing = await db.fhirConnection.findUnique({ where: { provider } });

  const data: any = {
    label, authMode, baseUrl, authUrl: authMode === "system" ? (authUrl || null) : authUrl, tokenUrl, clientId, scopes,
    fhirVersion: (b.fhirVersion === "dstu2" ? "dstu2" : "r4"),
    status: "configured",
    // clear prior tokens/state on reconfigure (tokens are short-lived / re-minted)
    accessToken: null, refreshToken: null, grantedScope: null, expiresAt: null, pkceVerifier: null, oauthState: null, lastError: null,
  };
  if (secretProvided) data.clientSecret = String(b.clientSecret).trim();

  // System mode signing key: generate once, preserve across reconfigures unless
  // the admin explicitly asks to rotate it (regenerateKey=true).
  if (authMode === "system") {
    if (b.regenerateKey || !existing?.privateJwk) {
      const key = await generateSigningKey("RS384");
      data.privateJwk = key.privateJwk; data.publicJwk = key.publicJwk; data.keyId = key.kid; data.jwkAlg = key.alg;
    }
  }

  const saved = await db.fhirConnection.upsert({
    where: { provider },
    create: { provider, ...data, clientSecret: secretProvided ? String(b.clientSecret).trim() : null, createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}` },
    update: data,
  });

  return NextResponse.json({ ok: true, connection: maskConnection(saved) });
}
