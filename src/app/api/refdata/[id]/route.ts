import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// PATCH /api/refdata/:id  { display?, code?, active?, sortOrder? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.display === "string" && body.display.trim()) data.display = body.display.trim();
  if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  try {
    const item = await db.refData.update({
      where: { id },
      data,
      select: { id: true, type: true, code: true, display: true, system: true, data: true, active: true },
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
  }
}

// DELETE /api/refdata/:id  -> soft deactivate (active=false)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await db.refData.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
