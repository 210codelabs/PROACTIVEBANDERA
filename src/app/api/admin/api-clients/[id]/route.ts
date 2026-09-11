import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isValidScope } from "@/lib/api/scopes";

async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== "admin") return null;
  return user;
}

// PATCH /api/admin/api-clients/:id — rename, toggle active, update scopes / rate limit.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const existing = await db.apiClient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;
  if (Array.isArray(body.scopes)) {
    const scopes = body.scopes.filter((s: string) => isValidScope(s));
    if (scopes.length === 0) return NextResponse.json({ error: "Select at least one scope" }, { status: 400 });
    data.scopes = scopes;
  }
  if (Number.isFinite(body.rateLimitPerMin)) data.rateLimitPerMin = Math.max(1, Math.min(6000, Math.round(body.rateLimitPerMin)));

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await db.apiClient.update({ where: { id }, data });
  await db.auditLog.create({ data: { userId: user.id, action: "update", resource: "ApiClient", resourceId: id } }).catch(() => {});
  return NextResponse.json({
    ok: true,
    client: { id: updated.id, name: updated.name, active: updated.active, scopes: updated.scopes, rateLimitPerMin: updated.rateLimitPerMin },
  });
}

// DELETE /api/admin/api-clients/:id — permanently revoke an integration app.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const existing = await db.apiClient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.apiRequestLog.deleteMany({ where: { clientId: id } }).catch(() => {});
  await db.apiClient.delete({ where: { id } });
  await db.auditLog.create({ data: { userId: user.id, action: "delete", resource: "ApiClient", resourceId: id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
