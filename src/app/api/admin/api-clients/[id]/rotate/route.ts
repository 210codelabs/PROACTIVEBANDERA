import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateCredentials, hashSecret } from "@/lib/api/keys";

async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== "admin") return null;
  return user;
}

// POST /api/admin/api-clients/:id/rotate — issue a new secret (invalidates the old one).
// Returns the new plaintext secret exactly ONCE.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const existing = await db.apiClient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Keep the same public keyId; only the secret changes.
  const { secret } = generateCredentials();
  const updated = await db.apiClient.update({
    where: { id },
    data: { secretHash: hashSecret(secret), secretLast4: secret.slice(-4) },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "rotate", resource: "ApiClient", resourceId: id } }).catch(() => {});

  return NextResponse.json({
    ok: true,
    credentials: { keyId: updated.keyId, secret, token: `${updated.keyId}.${secret}` },
    notice: "Copy the new secret now — it will not be shown again. The previous secret no longer works.",
  });
}
