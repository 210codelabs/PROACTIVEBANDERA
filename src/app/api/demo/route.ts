import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendDemoRequest } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("A valid email is required").max(160),
  phone: z.string().max(40).optional().nullable(),
  organization: z.string().max(160).optional().nullable(),
  role: z.string().max(120).optional().nullable(),
  practiceSize: z.string().max(60).optional().nullable(),
  interests: z.array(z.string().max(60)).max(20).optional(),
  preferredTime: z.string().max(120).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  source: z.string().max(40).optional().nullable(),
  // simple honeypot — bots fill hidden fields
  company_website: z.string().optional().nullable(),
});

// POST /api/demo — public. Saves the lead and sends an URGENT internal email.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parse = Body.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message || "Invalid submission." }, { status: 400 });
  }
  const b = parse.data;

  // Honeypot: silently accept but drop obvious bots.
  if (b.company_website && b.company_website.trim()) {
    return NextResponse.json({ ok: true });
  }

  let referenceId: string | null = null;
  let record: any = null;
  try {
    record = await db.demoRequest.create({
      data: {
        name: b.name.trim(),
        email: b.email.trim(),
        phone: b.phone || null,
        organization: b.organization || null,
        role: b.role || null,
        practiceSize: b.practiceSize || null,
        interests: (b.interests || []) as object,
        preferredTime: b.preferredTime || null,
        message: b.message || null,
        source: b.source || "landing",
        emailStatus: "pending",
      },
    });
    referenceId = record.id;
  } catch (e) {
    console.error("[demo] persist failed:", e instanceof Error ? e.message : e);
  }

  const status = await sendDemoRequest({
    name: b.name,
    email: b.email,
    phone: b.phone,
    organization: b.organization,
    role: b.role,
    practiceSize: b.practiceSize,
    interests: b.interests,
    preferredTime: b.preferredTime,
    message: b.message,
    referenceId,
  }).catch(() => "failed" as const);

  if (record) {
    await db.demoRequest.update({ where: { id: record.id }, data: { emailStatus: status } }).catch(() => {});
  }

  // The prospect experience succeeds as long as the lead is captured; email
  // delivery is best-effort (skipped when Resend is not yet configured).
  return NextResponse.json({ ok: true, emailStatus: status, referenceId });
}
