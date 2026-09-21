import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findConflict } from "@/lib/appointments";
import { practiceWallClockToDate } from "@/lib/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC (token-guarded) waitlist self-confirm. No session required.
async function loadByToken(token: string) {
  return db.waitlist.findFirst({ where: { offerToken: token } }).catch(() => null);
}

// GET /api/waitlist/confirm/[token] -> offer details for the confirm page
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await loadByToken(token);
  if (!e) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const expired = !e.offerExpiresAt || e.offerExpiresAt < new Date();
  const patient = await db.patient.findUnique({ where: { id: e.patientId }, select: { firstName: true, lastName: true } }).catch(() => null);
  let providerName: string | null = null;
  if (e.offerProviderId) {
    const p = await db.user.findUnique({ where: { id: e.offerProviderId }, select: { firstName: true, lastName: true, credential: true } }).catch(() => null);
    if (p) providerName = `${p.firstName} ${p.lastName}${p.credential ? `, ${p.credential}` : ""}`;
  }
  return NextResponse.json({
    status: e.status,
    expired,
    filled: e.status === "filled",
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    providerName,
    day: e.offerDay,
    time: e.offerTime,
  });
}

// POST /api/waitlist/confirm/[token] -> patient claims the slot (auto-book)
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await loadByToken(token);
  if (!e) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (e.status === "filled") return NextResponse.json({ ok: true, alreadyFilled: true });
  if (!e.offerExpiresAt || e.offerExpiresAt < new Date()) {
    return NextResponse.json({ error: "expired", message: "This offer has expired." }, { status: 410 });
  }
  if (!e.offerProviderId || !e.offerDay || !e.offerTime) {
    return NextResponse.json({ error: "invalid-offer" }, { status: 400 });
  }
  try {
    const start = practiceWallClockToDate(e.offerDay, e.offerTime);
    let durationMin = 30;
    if (e.offerServiceTypeId) {
      const s = await db.serviceType.findUnique({ where: { id: e.offerServiceTypeId } });
      if (s) durationMin = s.durationMin;
    }
    const end = new Date(start.getTime() + durationMin * 60000);
    // If the freed slot was taken in the meantime, tell the patient it's gone.
    const clash = await findConflict(e.offerProviderId, start, end);
    if (clash) {
      await db.waitlist.update({ where: { id: e.id }, data: { status: "waiting", offerToken: null, offerExpiresAt: null } });
      return NextResponse.json({ error: "taken", message: "Sorry, that time was just filled. We'll offer you the next opening." }, { status: 409 });
    }
    const appt = await db.appointment.create({
      data: {
        patientId: e.patientId, providerId: e.offerProviderId,
        serviceTypeId: e.offerServiceTypeId || null,
        startsAt: start, endsAt: end, location: "in-office",
        reason: e.reason || "Waitlist fill", status: "scheduled",
      },
    });
    await db.waitlist.update({ where: { id: e.id }, data: { status: "filled", filledAt: new Date(), filledApptId: appt.id, offerToken: null } });
    return NextResponse.json({ ok: true, appointmentId: appt.id });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
