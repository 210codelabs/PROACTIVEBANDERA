import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbRestore } from "@/lib/dbAdmin";
import { db } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid or missing backup file." }, { status: 400 });
  const res = await dbRestore(payload);
  try {
    await db.auditLog.create({ data: { userId: user.id, action: "db.restore", resource: "database", resourceId: "-", meta: JSON.stringify((res as any).summary || res) } });
  } catch {}
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
