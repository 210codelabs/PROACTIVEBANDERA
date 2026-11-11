import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookingIntakeText } from "@/lib/bookingIntakeText";

const bodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  signature: z.string().trim().min(2).max(120),
  privacyAcknowledged: z.literal(true),
  treatmentConsent: z.literal(true),
  insuranceConsent: z.literal(true),
  reviewAcknowledged: z.literal(true),
  lang: z.enum(["en", "es"]).default("en"),
  insurance: z.string().trim().max(500).default(""),
  medicalHistory: z.string().trim().max(4000).default(""),
  medications: z.string().trim().max(2000).default(""),
  allergies: z.string().trim().max(2000).default(""),
});

const tokenSchema = z.object({ patientId: z.string(), requestId: z.string(), expiresAt: z.number(), used: z.boolean() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete the required acknowledgments and signature." }, { status: 400 });
  const { token, ...values } = parsed.data;
  const key = `booking-intake:${createHash("sha256").update(token).digest("hex")}`;
  try {
    const saved = await db.$transaction(async (tx) => {
      const setting = await tx.appSetting.findUnique({ where: { key } });
      const capability = tokenSchema.safeParse(setting?.value);
      if (!capability.success || capability.data.used || capability.data.expiresAt <= Date.now()) return false;
      const request = await tx.appointmentRequest.findUnique({ where: { id: capability.data.requestId }, select: { matchedPatientId: true, patientType: true, status: true } });
      if (!request || request.patientType !== "new" || request.status === "declined" || request.matchedPatientId !== capability.data.patientId) return false;
      await tx.appSetting.update({ where: { key }, data: { value: { ...capability.data, used: true } } });
      await tx.document.create({ data: {
        patientId: capability.data.patientId,
        title: "New patient booking intake — pending review",
        category: "intake",
        body: JSON.stringify({ source: "booking-intake", version: 1, reviewStatus: "pending", submittedAt: new Date().toISOString(), acknowledgments: bookingIntakeText[values.lang], values }),
      } });
      return true;
    });
    if (!saved) return NextResponse.json({ error: "This form link is invalid or expired. Please contact the clinic." }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to submit the form. Please contact the clinic." }, { status: 503 });
  }
}