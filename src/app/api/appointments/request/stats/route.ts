import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET (STAFF): aggregate stats for the booking analytics dashboard.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.appointmentRequest.findMany({
    select: {
      status: true, patientType: true, serviceInterest: true, priorityCheckin: true,
      appointmentId: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const total = rows.length;
  const byStatus = { pending: 0, confirmed: 0, declined: 0 };
  const byType = { new: 0, existing: 0 };
  const serviceMap = new Map<string, number>();
  let scheduled = 0;
  let priority = 0;

  for (const r of rows) {
    if (r.status === "pending" || r.status === "confirmed" || r.status === "declined") byStatus[r.status]++;
    if (r.patientType === "existing") byType.existing++; else byType.new++;
    if (r.appointmentId) scheduled++;
    if (r.priorityCheckin) priority++;
    const svc = (r.serviceInterest || "Unspecified").trim() || "Unspecified";
    serviceMap.set(svc, (serviceMap.get(svc) || 0) + 1);
  }

  const byService = Array.from(serviceMap.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);

  // last 30 days count
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30 = rows.filter((r) => new Date(r.createdAt).getTime() >= since).length;

  const conversionRate = total > 0 ? Math.round((scheduled / total) * 100) : 0;

  return NextResponse.json({
    total, byStatus, byType, byService, scheduled, priority, last30, conversionRate,
  });
}
