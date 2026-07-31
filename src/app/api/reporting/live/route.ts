import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Live operational snapshot for the dashboard reporting panel. Designed to be
// polled every few seconds; every metric degrades gracefully so a transient DB
// hiccup never blanks the panel.
export async function GET() {
  const user = await requireSession();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const providerScope = user.role === "provider" ? { providerId: user.id } : {};

  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch {
      return fallback;
    }
  };

  const [
    apptsToday,
    checkedIn,
    inRoom,
    completed,
    noShow,
    openEncounters,
    pendingRx,
    pendingLabs,
    sentRxToday,
    unreadMessages,
  ] = await Promise.all([
    safe(db.appointment.count({ where: { startsAt: { gte: dayStart, lte: dayEnd }, ...providerScope } }), 0),
    safe(db.appointment.count({ where: { startsAt: { gte: dayStart, lte: dayEnd }, status: "checked-in", ...providerScope } }), 0),
    safe(db.appointment.count({ where: { startsAt: { gte: dayStart, lte: dayEnd }, status: "in-room", ...providerScope } }), 0),
    safe(db.appointment.count({ where: { startsAt: { gte: dayStart, lte: dayEnd }, status: "completed", ...providerScope } }), 0),
    safe(db.appointment.count({ where: { startsAt: { gte: dayStart, lte: dayEnd }, status: "no-show", ...providerScope } }), 0),
    safe(db.encounter.count({ where: { status: "open", ...providerScope } }), 0),
    safe(db.order.count({ where: { type: "rx", status: "pending", ...providerScope } }), 0),
    safe(db.order.count({ where: { type: "lab", status: "pending", ...providerScope } }), 0),
    safe(db.order.count({ where: { type: "rx", status: "sent", routedAt: { gte: dayStart, lte: dayEnd }, ...providerScope } }), 0),
    safe(db.message.count({ where: { toUserId: user.id, read: false } }), 0),
  ]);

  const waiting = checkedIn + inRoom;
  const throughputPct = apptsToday > 0 ? Math.round((completed / apptsToday) * 100) : 0;

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    metrics: {
      apptsToday,
      checkedIn,
      inRoom,
      completed,
      noShow,
      waiting,
      throughputPct,
      openEncounters,
      pendingRx,
      pendingLabs,
      sentRxToday,
      unreadMessages,
    },
  });
}
