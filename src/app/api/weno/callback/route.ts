import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseSwitchResponse } from "@/lib/weno";

export const runtime = "nodejs";

// Public server-to-server callback for Weno asynchronous STATUS / VERIFY / ERROR
// messages. Correlates by MessageID / RelatesToMessageID and updates the
// transmission state. Responds with a minimal SCRIPT STATUS acknowledgement.
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  try {
    const relatesTo = raw.match(/<RelatesToMessageID>([^<]+)<\/RelatesToMessageID>/i)?.[1]?.trim();
    const msgId = raw.match(/<MessageID>([^<]+)<\/MessageID>/i)?.[1]?.trim();
    const correlationId = relatesTo || msgId;
    const parsed = parseSwitchResponse(raw);
    // Map async result: an ERROR after acceptance = delivery failure; a
    // STATUS/VERIFY success = delivered.
    let state = parsed.state;
    if (state === "accepted") state = "delivered";
    if (correlationId) {
      await db.prescription.updateMany({
        where: { wenoMessageId: correlationId },
        data: { wenoState: state, wenoStatusText: parsed.statusText.slice(0, 300), wenoResponse: raw.slice(0, 4000), status: state === "rejected" || state === "error" ? "transmit_error" : "transmitted" },
      });
    }
  } catch {
    /* never fail the ack */
  }
  const ack = `<Message DatatypesVersion="20170715" TransportVersion="20170715" TransactionDomain="SCRIPT" TransactionVersion="20170715" StructuresVersion="20170715" ECLVersion="20170715"><Header><MessageID>0</MessageID><SentTime>${new Date().toISOString()}</SentTime></Header><Body><Status><Code>000</Code><Description>Transaction successful</Description></Status></Body></Message>`;
  return new NextResponse(ack, { status: 200, headers: { "Content-Type": "application/xml" } });
}
