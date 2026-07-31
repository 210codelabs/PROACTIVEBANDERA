import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof b?.active === "boolean") data.active = b.active;
  if (typeof b?.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b?.firm !== undefined) data.firm = b.firm ? String(b.firm).trim() : null;
  if (b?.resetCode === true) data.accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  else if (typeof b?.accessCode === "string" && b.accessCode.trim()) data.accessCode = b.accessCode.trim();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const a = await db.attorney.update({ where: { id }, data });
    return NextResponse.json({ ok: true, attorney: a });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
