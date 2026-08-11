import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { FHIR_PROVIDERS, isProvider, maskConnection, redirectUriFor, type ProviderKey } from "@/lib/fhir/client";

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
// Saves/updates OAuth + FHIR endpoint config for a provider. Saving config
// clears any previously-issued tokens (they belong to the old client/base URL).
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const provider = String(b.provider || "");
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const baseUrl = String(b.baseUrl || "").trim();
  const authUrl = String(b.authUrl || "").trim();
  const tokenUrl = String(b.tokenUrl || "").trim();
  const clientId = String(b.clientId || "").trim();
  if (!baseUrl || !authUrl || !tokenUrl || !clientId) {
    return NextResponse.json({ error: "FHIR base URL, authorization URL, token URL and client ID are all required." }, { status: 400 });
  }
  for (const [name, val] of [["FHIR base URL", baseUrl], ["authorization URL", authUrl], ["token URL", tokenUrl]] as const) {
    try { new URL(val); } catch { return NextResponse.json({ error: `The ${name} is not a valid URL.` }, { status: 400 }); }
  }

  const scopes = String(b.scopes || FHIR_PROVIDERS[provider].defaultScopes).trim();
  const label = b.label ? String(b.label) : FHIR_PROVIDERS[provider].label;
  // clientSecret: only overwrite when a non-empty value is supplied
  const secretProvided = typeof b.clientSecret === "string" && b.clientSecret.trim().length > 0;

  const data: any = {
    label, baseUrl, authUrl, tokenUrl, clientId, scopes,
    status: "configured",
    // clear prior tokens/state on reconfigure
    accessToken: null, refreshToken: null, grantedScope: null, expiresAt: null, pkceVerifier: null, oauthState: null, lastError: null,
  };
  if (secretProvided) data.clientSecret = String(b.clientSecret).trim();

  const saved = await db.fhirConnection.upsert({
    where: { provider },
    create: { provider, ...data, clientSecret: secretProvided ? String(b.clientSecret).trim() : null, createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}` },
    update: data,
  });

  return NextResponse.json({ ok: true, connection: maskConnection(saved) });
}
