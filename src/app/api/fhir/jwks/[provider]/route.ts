import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isProvider } from "@/lib/fhir/client";

// GET /api/fhir/jwks/[provider]  (PUBLIC — no auth)
// Publishes the PUBLIC signing key for this provider's SMART Backend Services
// connection so the EHR vendor (e.g. Practice Fusion/Veradigm) can fetch it and
// verify our signed client assertions. The PRIVATE key is never exposed here.
// This route is intentionally public (public keys are meant to be shared) and is
// allow-listed in middleware.
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ keys: [] }, { status: 404 });

  const conn = await db.fhirConnection.findUnique({ where: { provider } }).catch(() => null);
  const keys: any[] = [];
  if (conn?.publicJwk) {
    try { keys.push(JSON.parse(conn.publicJwk)); } catch { /* ignore malformed */ }
  }
  return NextResponse.json({ keys }, { headers: { "cache-control": "public, max-age=300", "content-type": "application/json" } });
}
