import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional Twilio request-signature validation (enabled when TWILIO_AUTH_TOKEN set).
function validTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // validation disabled if no token configured
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || "")); } catch { return false; }
}

// POST /api/credentialing/twilio/sms  (Twilio inbound-SMS webhook)
// Twilio forwards the CAQH OTP SMS here; we extract the code and resume the
// currently awaiting_mfa job. Configure this URL as the number's messaging webhook.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  if (form) for (const [k, v] of form.entries()) params[k] = String(v);

  const sig = req.headers.get("x-twilio-signature") || "";
  if (!validTwilioSignature(req.url, params, sig)) {
    return new Response("<Response></Response>", { status: 403, headers: { "Content-Type": "text/xml" } });
  }

  const body = String(params.Body || "");
  const from = String(params.From || "");
  // Extract the first 4-8 digit run as the OTP.
  const m = body.match(/\b(\d{4,8})\b/);
  const code = m ? m[1] : "";

  const twiml = (msg: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><!-- ${msg} --></Response>`, { headers: { "Content-Type": "text/xml" } });

  if (!code) return twiml("no OTP found in message");

  // Resume the most recently-requested job that is awaiting MFA.
  const job = await db.automationJob.findFirst({ where: { status: "awaiting_mfa" }, orderBy: { mfaRequestedAt: "desc" } }).catch(() => null);
  if (!job) return twiml("no job awaiting MFA");

  const logs = Array.isArray(job.logs) ? (job.logs as any[]) : [];
  logs.push({ at: new Date().toISOString(), level: "info", message: `MFA code received via Twilio SMS from ${from}; resuming (status -> processing).` });
  await db.automationJob.update({ where: { id: job.id }, data: { mfaCode: code, mfaReceivedAt: new Date(), status: "processing", logs } }).catch(() => {});
  return twiml(`resumed job ${job.id}`);
}
