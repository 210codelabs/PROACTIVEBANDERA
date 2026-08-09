import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbBackup } from "@/lib/dbAdmin";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const backup = await dbBackup();
  try {
    await db.auditLog.create({ data: { userId: user.id, action: "db.backup", resource: "database", resourceId: "-", meta: JSON.stringify(backup.meta) } });
  } catch {}
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new NextResponse(JSON.stringify(backup), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=\"proactive-backup-${stamp}.json\"`,
    },
  });
}
