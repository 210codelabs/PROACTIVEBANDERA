import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { listOpenSlots, pickSuggestions } from "@/lib/scheduling";
import { clinicDayKey, clinicMinutesOfDay } from "@/lib/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/appointments/slots?providerId=&day=YYYY-MM-DD&duration=30&excludeId=
// Returns the provider's slot grid for that day plus a few next open times.
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const sp = new URL(req.url).searchParams;
  const providerId = sp.get("providerId") || "";
  const day = sp.get("day") || "";
  const excludeId = sp.get("excludeId") || undefined;
  const duration = Math.max(15, Math.min(240, Number(sp.get("duration")) || 30));
  if (!providerId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "providerId and day (YYYY-MM-DD) are required" }, { status: 400 });
  }
  try {
    const provider = await db.user.findUnique({ where: { id: providerId }, select: { workingHours: true } });
    const { hours, slots } = await listOpenSlots(providerId, day, duration, provider?.workingHours, excludeId);
    // Suggest starting from "now" if the requested day is today, else from day open.
    const todayStr = clinicDayKey(new Date());
    let fromMin = 0;
    if (day === todayStr) { fromMin = clinicMinutesOfDay(new Date()); }
    const suggestions = pickSuggestions(slots, 5, fromMin);
    // If nothing left later today, fall back to earliest free slots.
    const finalSuggestions = suggestions.length ? suggestions : pickSuggestions(slots, 5, 0);
    return NextResponse.json({ hours, slots, suggestions: finalSuggestions, duration });
  } catch {
    return NextResponse.json({ error: "Slot lookup is temporarily unavailable" }, { status: 503 });
  }
}
