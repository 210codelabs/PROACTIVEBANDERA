import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStediConfig } from "@/lib/stedi";
import { ingestEra835 } from "@/lib/era";

/**
 * Stedi webhook receiver (public route — authenticated by a shared secret, not a
 * user session). Configure in Stedi → Developer settings → Webhooks with a
 * "Transaction processed" binding filtered to 835 (Health Care Claim
 * Payment/Advice), using a custom header credential set:
 *
 *   Header:  x-stedi-webhook-secret
 *   Value:   <WEBHOOK_SECRET from Settings → External Integrations → Stedi>
 *
 * URL: {NEXT_PUBLIC_BASE_URL}/api/stedi/webhook
 *
 * On an 835 event we acknowledge fast (< 5s), record the event idempotently,
 * then fetch + auto-post the ERA to the patient ledger.
 */
export async function POST(req: Request) {
  // Read the raw body once (needed for any future signature verification).
  const rawBody = await req.text();
  let payload: any = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch { payload = {}; }

  // Authenticate via the shared secret header (credential-set model).
  const cfg = await getStediConfig().catch(() => null);
  const expected = cfg?.webhookSecret || "";
  const supplied =
    req.headers.get("x-stedi-webhook-secret") ||
    req.headers.get("x-webhook-secret") ||
    req.headers.get("authorization") ||
    "";
  if (!expected || supplied.replace(/^Bearer\s+/i, "") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const eventId =
    payload.eventId || payload.id || req.headers.get("event-id") || req.headers.get("webhook-id") ||
    `${payload.transactionId || "evt"}-${Date.now()}`;
  const transactionSet = String(payload?.x12?.transactionSetIdentifier || payload?.transactionSetIdentifier || payload?.transactionSet || "");
  const transactionId = payload?.transactionId || payload?.transaction?.id || payload?.x12?.transactionId || null;

  // Idempotent event record — duplicate deliveries are acknowledged, not reprocessed.
  let isNew = true;
  try {
    await db.stediEvent.create({
      data: {
        eventId: String(eventId),
        webhookId: req.headers.get("webhook-id") || null,
        transactionId: transactionId ? String(transactionId) : null,
        transactionSet: transactionSet || null,
        payload: payload as object,
      },
    });
  } catch {
    isNew = false; // duplicate eventId
  }

  // Only process 835/ERA transactions. Everything else is just acknowledged.
  if (isNew && /835/.test(transactionSet) && transactionId) {
    try {
      const result = await ingestEra835(String(transactionId));
      await db.stediEvent
        .updateMany({ where: { eventId: String(eventId) }, data: { processed: true } })
        .catch(() => {});
      return NextResponse.json({ ok: true, processed: true, matched: result.matched.length, totalPaidCents: result.totalPaidCents });
    } catch (e: any) {
      await db.stediEvent
        .updateMany({ where: { eventId: String(eventId) }, data: { processError: String(e?.message || e).slice(0, 300) } })
        .catch(() => {});
      // Return 200 so Stedi does not hammer retries for a persistent parse issue;
      // the event is stored and can be reprocessed manually via polling.
      return NextResponse.json({ ok: true, processed: false, note: "stored; will reconcile via polling" });
    }
  }

  return NextResponse.json({ ok: true, processed: false, duplicate: !isNew });
}

// Simple GET for a health/verification ping from the Stedi console.
export async function GET() {
  return NextResponse.json({ ok: true, service: "stedi-webhook" });
}
