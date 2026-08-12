import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getConnection, isProvider, maskConnection } from "@/lib/fhir/client";
import { getSystemToken } from "@/lib/fhir/backend";

// POST /api/admin/fhir/[provider]/system/test  (admin only)
// For a SMART Backend Services (system) connection: mints a signed-JWT client
// assertion, exchanges it for a system access token, and (best-effort) reads the
// CapabilityStatement to confirm reachability. On success the connection is
// marked 'connected'. Returns the granted scope + FHIR server info; never any
// secret/token value.
export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const conn = await getConnection(provider);
  if (!conn) return NextResponse.json({ error: "This provider is not configured yet." }, { status: 400 });
  if ((conn as any).authMode !== "system") {
    return NextResponse.json({ error: "This connection is not in System access mode." }, { status: 400 });
  }
  if (!conn.baseUrl || !conn.tokenUrl || !conn.clientId || !(conn as any).privateJwk) {
    return NextResponse.json({ error: "System access is not fully configured — set the FHIR base URL, token URL and client ID, and generate a signing key." }, { status: 400 });
  }

  let token: string;
  try { token = await getSystemToken(conn); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 502 }); }

  // Best-effort capability read (some bulk-only servers may not expose /metadata).
  let fhirVersion: string | null = null;
  let serverName: string | null = null;
  try {
    const base = String(conn.baseUrl).replace(/\/$/, "");
    const r = await fetch(`${base}/metadata`, { headers: { authorization: `Bearer ${token}`, accept: "application/fhir+json" }, cache: "no-store" });
    if (r.ok) { const cs = await r.json(); fhirVersion = cs.fhirVersion || null; serverName = cs.software?.name || cs.publisher || null; }
  } catch { /* ignore */ }

  const fresh = await getConnection(provider);
  return NextResponse.json({
    ok: true,
    grantedScope: fresh?.grantedScope || conn.scopes || null,
    fhirVersion, serverName,
    connection: maskConnection(fresh),
  });
}
