import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

export const OFFER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

function randToken() {
  return `wlo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function prettySlot(day: string, time: string) {
  try {
    const d = new Date(`${day}T${time}:00`);
    return d.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return `${day} ${time}`; }
}

/**
 * Create/refresh an auto-offer on a waitlist entry for a freed slot and notify
 * the patient by SMS + email with a self-confirm link (both channels are
 * env-gated and skip silently when unconfigured). Returns the token, link and
 * per-channel delivery status. Does NOT book the appointment — the patient
 * self-confirms via /waitlist/confirm/[token].
 */
export async function createAndSendOffer(entryId: string, slot: {
  day: string; time: string; providerId: string | null; serviceTypeId: string | null;
}): Promise<{ token: string; link: string; sms: string; email: string } | null> {
  const entry = await db.waitlist.findUnique({ where: { id: entryId } }).catch(() => null);
  if (!entry) return null;
  const patient = await db.patient.findUnique({ where: { id: entry.patientId }, select: { firstName: true, lastName: true, email: true, phone: true } }).catch(() => null);

  const token = randToken();
  const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
  const link = `${baseUrl()}/waitlist/confirm/${token}`;
  const when = prettySlot(slot.day, slot.time);

  const smsBody = `Proactive Clinic: an appointment opened on ${when}. Tap to claim it (expires in 2h): ${link}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#1e4fd8;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><h2 style="margin:0;font-size:20px">A slot just opened</h2></div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:22px;color:#334155">
      <p>Hi ${patient?.firstName || "there"}, an appointment time became available:</p>
      <p style="font-size:18px;font-weight:700;color:#0f172a">${when}</p>
      <p><a href="${link}" style="display:inline-block;background:#1e4fd8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Claim this appointment</a></p>
      <p style="color:#64748b;font-size:13px">This offer expires in 2 hours. If you no longer need it, you can ignore this message.</p>
    </div></div>`;

  const [sms, email] = await Promise.all([
    patient?.phone ? sendSms(patient.phone, smsBody) : Promise.resolve("skipped" as const),
    patient?.email ? sendEmail({ to: patient.email, subject: `An appointment opened on ${when}`, html, text: smsBody }) : Promise.resolve("skipped" as const),
  ]);

  await db.waitlist.update({
    where: { id: entryId },
    data: {
      status: "offered", offerToken: token, offerExpiresAt: expiresAt,
      offerDay: slot.day, offerTime: slot.time, offerProviderId: slot.providerId, offerServiceTypeId: slot.serviceTypeId,
      offerSmsStatus: sms, offerEmailStatus: email,
    },
  });

  return { token, link, sms, email };
}
