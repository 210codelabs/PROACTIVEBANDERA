import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { matchesBookingIdentity } from "@/lib/bookingIdentity";

const schema = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), postalCode: z.string().regex(/^\d{5}$/) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your name, date of birth and ZIP code." }, { status: 400 });
  const { firstName, lastName, dob, postalCode } = parsed.data;
  const date = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob) return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const secret = process.env.AUTH_SECRET || "proactive-dev-secret-change-me-in-production-please-32chars+";
  const limitKey = `booking-lookup-limit:${createHmac("sha256", secret).update(ip).digest("hex")}`;
  try {
    await db.appSetting.upsert({ where: { key: limitKey }, create: { key: limitKey, value: { count: 0, expiresAt: 0 } }, update: {} });
    const allowed = await db.$transaction(async (tx) => {
      const current = await tx.appSetting.findUniqueOrThrow({ where: { key: limitKey } });
      const state = current.value as { count?: number; expiresAt?: number };
      const active = typeof state.expiresAt === "number" && state.expiresAt > Date.now();
      const count = active ? Number(state.count || 0) : 0;
      if (count >= 10) return false;
      await tx.appSetting.update({ where: { key: limitKey }, data: { value: { count: count + 1, expiresAt: active ? state.expiresAt! : Date.now() + 15 * 60 * 1000 } } });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: "Too many attempts. Please try again later or contact the clinic." }, { status: 429 });
    const patients = await db.patient.findMany({ where: { firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" }, dob: date, status: "active" }, select: { id: true, dob: true, postalCode: true }, take: 10 });
    const matches = patients.filter((patient) => matchesBookingIdentity(patient, dob, postalCode));
    if (matches.length !== 1) return NextResponse.json({ error: "We couldn't verify those details. Please contact the clinic." }, { status: 404 });
    const bookingId = randomBytes(32).toString("base64url");
    const key = `booking-lookup:${createHash("sha256").update(bookingId).digest("hex")}`;
    await db.appSetting.create({ data: { key, value: { patientId: matches[0].id, expiresAt: Date.now() + 15 * 60 * 1000, used: false } } });
    return NextResponse.json({ bookingId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Lookup is temporarily unavailable. Please contact the clinic." }, { status: 503 });
  }
}