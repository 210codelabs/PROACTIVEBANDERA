import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbReindex } from "@/lib/dbAdmin";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const res = await dbReindex();
  try {
    await db.auditLog.create({ data: { userId: user.id, action: "db.reindex", resource: "database", resourceId: "-", meta: JSON.stringify(res.results) } });
  } catch {}
  return NextResponse.json(res);
}
