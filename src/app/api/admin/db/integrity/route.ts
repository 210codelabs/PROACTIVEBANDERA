import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbIntegrityScan, dbIntegrityRepair } from "@/lib/dbAdmin";

// GET  -> read-only scan (report orphaned references, changes nothing)
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const result = await dbIntegrityScan();
  return NextResponse.json(result);
}

// POST -> repair (delete orphaned rows so pages stop throwing). Audited.
export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const result = await dbIntegrityRepair();
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "db.integrity.repair",
        resource: "Database",
        resourceId: null,
        meta: JSON.stringify({ totalDeleted: result.totalDeleted, summary: result.summary }).slice(0, 4000),
      },
    });
  } catch (e) {
    console.error("[integrity] audit write failed:", e);
  }
  return NextResponse.json(result);
}
