import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { buildAuthUrl, getConnection, isProvider } from "@/lib/fhir/client";

// GET /api/admin/fhir/[provider]/authorize
// Begins the SMART-on-FHIR authorization_code + PKCE flow: stores the PKCE
// verifier + state on the connection row and 302-redirects to the vendor's
// authorization endpoint. (Navigated to directly from the admin UI.)
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const conn = await getConnection(provider);
  if (!conn || !conn.authUrl || !conn.clientId || !conn.baseUrl) {
    return NextResponse.json({ error: "Configure the FHIR connection (base URL, auth URL, client ID) before connecting." }, { status: 400 });
  }

  const { url, verifier, state } = buildAuthUrl(conn);
  await db.fhirConnection.update({ where: { provider }, data: { pkceVerifier: verifier, oauthState: state } });
  return NextResponse.redirect(url);
}
