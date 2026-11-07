import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, emailConfigured } from "@/lib/email";
import { buildMecReminderEmail } from "@/lib/dot/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/internal/dot-reminders  (guarded by the shared cron secret)
// Finds completed DOT exams whose MEC certificate is expiring in <=30 / <=7 days
// (or already expired) and emails the company + driver, once per window.
export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret || req.headers.get("x-weno-cron") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const in31d = new Date(now + 31 * 86400000);
  // Completed, qualified, with an expiry within the next 31 days or already past.
  const exams = await db.dotExam.findMany({
    where: {
      status: "completed",
      outcome: { in: ["qualified", "qualified_with_restrictions"] },
      expiresOn: { not: null, lte: in31d },
    },
    take: 500,
  });

  const companiesCache = new Map<string, any>();
  let sent = 0, skipped = 0, considered = 0;
  const configured = emailConfigured();

  for (const e of exams) {
    if (!e.expiresOn) continue;
    const daysUntil = Math.ceil((new Date(e.expiresOn).getTime() - now) / 86400000);
    let windowKey: "d30" | "d7" | "expired" | null = null;
    if (daysUntil < 0) windowKey = "expired";
    else if (daysUntil <= 7) windowKey = "d7";
    else if (daysUntil <= 30) windowKey = "d30";
    if (!windowKey) continue;

    const rs: any = e.remindersSent || {};
    if (rs[windowKey]) continue; // already reminded for this window
    considered++;

    if (!configured) { skipped++; continue; }

    if (e.enterpriseId && !companiesCache.has(e.enterpriseId)) {
      companiesCache.set(e.enterpriseId, await db.enterpriseAccount.findUnique({ where: { id: e.enterpriseId } }));
    }
    const company = e.enterpriseId ? companiesCache.get(e.enterpriseId) : null;
    const companyEmail = company?.contactEmail || company?.billingEmail || "";
    const driverEmail = (e.driverInfo as any)?.email || "";
    const companyName = company?.companyName || "your company";

    let anySent = false;
    if (companyEmail) {
      const m = buildMecReminderEmail({ driverName: e.driverName, companyName, expiresOn: new Date(e.expiresOn), daysUntil, audience: "company" });
      if ((await sendEmail({ to: companyEmail, subject: m.subject, html: m.html, text: m.text })) === "sent") anySent = true;
    }
    if (driverEmail) {
      const m = buildMecReminderEmail({ driverName: e.driverName, companyName, expiresOn: new Date(e.expiresOn), daysUntil, audience: "driver" });
      if ((await sendEmail({ to: driverEmail, subject: m.subject, html: m.html, text: m.text })) === "sent") anySent = true;
    }
    if (anySent) {
      rs[windowKey] = new Date().toISOString();
      await db.dotExam.update({ where: { id: e.id }, data: { remindersSent: rs } });
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, considered, sent, skipped, emailConfigured: configured });
}
