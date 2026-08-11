import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getConnection, isProvider, maskConnection } from "@/lib/fhir/client";

// POST /api/admin/fhir/[provider]/disconnect
// Clears issued tokens (keeps the saved OAuth config) and marks the connection
// back to "configured".
export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const conn = await getConnection(provider);
  if (!conn) return NextResponse.json({ error: "Nothing to disconnect." }, { status: 400 });

  const saved = await db.fhirConnection.update({
    where: { provider },
    data: { accessToken: null, refreshToken: null, grantedScope: null, expiresAt: null, pkceVerifier: null, oauthState: null, status: "configured", lastError: null },
  });
  return NextResponse.json({ ok: true, connection: maskConnection(saved) });
}
