import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createAndSendOffer } from "@/lib/waitlist/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/waitlist/[id]/offer
// Manually offer a specific freed/open slot to a waitlisted patient. Generates a
// self-confirm link and notifies the patient (SMS + email are env-gated and skip
// silently when unconfigured). Does NOT book the appointment — the patient
// self-confirms via /waitlist/confirm/[token]. Returns the link + delivery status.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!b.day || !b.time) return NextResponse.json({ error: "day and time are required" }, { status: 400 });
  try {
    const sent = await createAndSendOffer(id, {
      day: String(b.day),
      time: String(b.time),
      providerId: b.providerId ? String(b.providerId) : null,
      serviceTypeId: b.serviceTypeId ? String(b.serviceTypeId) : null,
    });
    if (!sent) return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
    return NextResponse.json({ ok: true, link: sent.link, sms: sent.sms, email: sent.email, day: b.day, time: b.time });
  } catch {
    return NextResponse.json({ error: "Could not send the offer" }, { status: 503 });
  }
}
