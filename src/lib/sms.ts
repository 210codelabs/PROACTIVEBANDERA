// Best-effort outbound SMS via Twilio's REST API (no SDK). Skips silently when
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER aren't configured,
// so scheduling never fails on SMS. Returns the delivery outcome.
export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export async function sendSms(to: string, body: string): Promise<"sent" | "failed" | "skipped"> {
  if (!smsConfigured()) return "skipped";
  const num = (to || "").trim();
  if (!num) return "skipped";
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM_NUMBER!;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: num, From: from, Body: body }).toString(),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
