import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { exchangeCode, getConnection, isProvider } from "@/lib/fhir/client";

// GET /api/admin/fhir/[provider]/callback?code=..&state=..
// Vendor redirects here after the user authorizes. Validates state, exchanges
// the code for tokens, stores them, and redirects back to the admin UI.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const backTo = (msg: string) => NextResponse.redirect(`${base}/admin/data-tools?fhir=${provider}&msg=${encodeURIComponent(msg)}`);

  const conn = await getConnection(provider);
  if (!conn) return backTo("Connection not configured.");
  if (err) { await db.fhirConnection.update({ where: { provider }, data: { status: "error", lastError: err } }); return backTo(`Authorization was denied (${err}).`); }
  if (!code || !state) return backTo("Missing authorization code.");
  if (!conn.oauthState || state !== conn.oauthState) return backTo("State mismatch — please retry the connection.");

  try {
    const t = await exchangeCode(conn, code);
    await db.fhirConnection.update({
      where: { provider },
      data: {
        accessToken: t.access_token || null,
        refreshToken: t.refresh_token || null,
        grantedScope: t.scope || null,
        expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000),
        status: t.access_token ? "connected" : "error",
        lastError: t.access_token ? null : "No access token returned.",
        pkceVerifier: null, oauthState: null,
      },
    });
    return backTo(t.access_token ? "Connected successfully." : "Token exchange returned no access token.");
  } catch (e: any) {
    await db.fhirConnection.update({ where: { provider }, data: { status: "error", lastError: String(e?.message || e).slice(0, 300), pkceVerifier: null, oauthState: null } });
    return backTo("Token exchange failed — check the token URL, client credentials and scopes.");
  }
}
