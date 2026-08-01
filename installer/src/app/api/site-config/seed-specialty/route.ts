import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Curated sample service catalogs per clinic specialty. Seeding is idempotent
// (upsert by unique code) so admins can pick the set that fits the new clinic.
const PACKS: Record<string, { label: string; services: { code: string; name: string; category: string; durationMin?: number; defaultCpt?: string }[] }> = {
  multispecialty: { label: "Multi-specialty (default)", services: [
    { code: "PT-EVAL", name: "Physical Therapy Evaluation", category: "physical-therapy", defaultCpt: "97161" },
    { code: "PT-TX", name: "Physical Therapy Treatment", category: "physical-therapy", defaultCpt: "97110" },
    { code: "PAIN-CONSULT", name: "Pain Management Consult", category: "other-services", defaultCpt: "99204" },
    { code: "PRIMARY-OV", name: "Primary Care Office Visit", category: "primary-care", defaultCpt: "99213" },
    { code: "TELEHEALTH", name: "Telehealth Visit", category: "other-services", defaultCpt: "99421" },
  ] },
  rehab: { label: "Physical Rehabilitation", services: [
    { code: "PT-EVAL", name: "Physical Therapy Evaluation", category: "physical-therapy", defaultCpt: "97161" },
    { code: "PT-TX", name: "Therapeutic Exercise", category: "physical-therapy", defaultCpt: "97110" },
    { code: "MANUAL", name: "Manual Therapy", category: "physical-therapy", defaultCpt: "97140" },
    { code: "CHIRO", name: "Chiropractic Adjustment", category: "physical-therapy", defaultCpt: "98941" },
  ] },
  primary: { label: "Primary Care", services: [
    { code: "PRIMARY-NEW", name: "New Patient Visit", category: "primary-care", defaultCpt: "99204" },
    { code: "PRIMARY-OV", name: "Established Visit", category: "primary-care", defaultCpt: "99213" },
    { code: "WELLNESS", name: "Annual Wellness Visit", category: "primary-care", defaultCpt: "G0439" },
    { code: "TELEHEALTH", name: "Telehealth Visit", category: "other-services", defaultCpt: "99421" },
  ] },
  aesthetic: { label: "Aesthetic Medicine & Wellness", services: [
    { code: "IV-THERAPY", name: "IV Vitamin Therapy", category: "aesthetic-medicine" },
    { code: "BOTOX", name: "Neuromodulator Treatment", category: "aesthetic-medicine" },
    { code: "WEIGHT", name: "Medical Weight Management", category: "aesthetic-medicine" },
    { code: "WELLNESS-CONSULT", name: "Wellness Consultation", category: "other-services" },
  ] },
};

export async function GET() {
  return NextResponse.json({ packs: Object.entries(PACKS).map(([id, p]) => ({ id, label: p.label, count: p.services.length })) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pack = PACKS[String(body?.specialty || "")];
  if (!pack) return NextResponse.json({ error: "Unknown specialty" }, { status: 400 });
  let seeded = 0;
  for (const svc of pack.services) {
    await db.serviceType.upsert({
      where: { code: svc.code },
      update: { name: svc.name, category: svc.category, active: true, durationMin: svc.durationMin ?? 45, defaultCpt: svc.defaultCpt ?? null },
      create: { code: svc.code, name: svc.name, category: svc.category, active: true, durationMin: svc.durationMin ?? 45, defaultCpt: svc.defaultCpt ?? null },
    });
    seeded++;
  }
  return NextResponse.json({ ok: true, seeded, specialty: body.specialty });
}
