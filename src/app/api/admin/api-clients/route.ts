import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateCredentials, hashSecret } from "@/lib/api/keys";
import { isValidScope, SCOPE_KEYS } from "@/lib/api/scopes";

async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== "admin") return null;
  return user;
}

// GET /api/admin/api-clients — list integration apps (no secrets).
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await db.apiClient.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);
  const data = clients.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    keyId: c.keyId,
    secretLast4: c.secretLast4,
    scopes: c.scopes,
    active: c.active,
    rateLimitPerMin: c.rateLimitPerMin,
    lastUsedAt: c.lastUsedAt,
    requestCount: c.requestCount,
    createdByName: c.createdByName,
    createdAt: c.createdAt,
  }));
  return NextResponse.json({ clients: data, scopes: SCOPE_KEYS });
}

// POST /api/admin/api-clients — create an integration app.
// Returns the plaintext secret exactly ONCE (never stored/retrievable again).
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const scopes: string[] = Array.isArray(body.scopes) ? body.scopes.filter((s: string) => isValidScope(s)) : [];
  if (scopes.length === 0) return NextResponse.json({ error: "Select at least one scope" }, { status: 400 });

  const rateLimitPerMin = Number.isFinite(body.rateLimitPerMin) ? Math.max(1, Math.min(6000, Math.round(body.rateLimitPerMin))) : 120;

  const { keyId, secret } = generateCredentials();
  const client = await db.apiClient.create({
    data: {
      name,
      description: (body.description || "").trim() || null,
      keyId,
      secretHash: hashSecret(secret),
      secretLast4: secret.slice(-4),
      scopes,
      rateLimitPerMin,
      createdByName: `${user.firstName} ${user.lastName}`.trim(),
    },
  });

  await db.auditLog.create({ data: { userId: user.id, action: "create", resource: "ApiClient", resourceId: client.id } }).catch(() => {});

  // token = keyId.secret — what the partner sends as the Bearer / X-API-Key value.
  return NextResponse.json({
    ok: true,
    client: { id: client.id, name: client.name, keyId: client.keyId, scopes: client.scopes, active: client.active },
    credentials: { keyId, secret, token: `${keyId}.${secret}` },
    notice: "Copy the secret now — it will not be shown again.",
  });
}
