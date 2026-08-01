import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Svc = { code: string; name: string; category: string; durationMin?: number; defaultCpt?: string };
type Dx = { code: string; display: string };
type Rx = { display: string };
type Pack = { label: string; services: Svc[]; diagnoses: Dx[]; medications: Rx[] };

// Curated sample catalogs per clinic specialty: services + typical diagnoses
// (ICD-10) + common medications (RxNorm names). All seeding is idempotent
// (upsert by unique keys) so admins can safely pick/re-run a set.
const PACKS: Record<string, Pack> = {
  multispecialty: {
    label: "Multi-specialty (default)",
    services: [
      { code: "PT-EVAL", name: "Physical Therapy Evaluation", category: "physical-therapy", defaultCpt: "97161" },
      { code: "PT-TX", name: "Physical Therapy Treatment", category: "physical-therapy", defaultCpt: "97110" },
      { code: "PAIN-CONSULT", name: "Pain Management Consult", category: "other-services", defaultCpt: "99204" },
      { code: "PRIMARY-OV", name: "Primary Care Office Visit", category: "primary-care", defaultCpt: "99213" },
      { code: "TELEHEALTH", name: "Telehealth Visit", category: "other-services", defaultCpt: "99421" },
    ],
    diagnoses: [
      { code: "M54.5", display: "Low back pain" },
      { code: "M25.561", display: "Pain in right knee" },
      { code: "I10", display: "Essential (primary) hypertension" },
      { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
    ],
    medications: [{ display: "Ibuprofen 600 mg Tablet" }, { display: "Acetaminophen 500 mg Tablet" }, { display: "Lisinopril 10 mg Tablet" }],
  },
  rehab: {
    label: "Physical Rehabilitation",
    services: [
      { code: "PT-EVAL", name: "Physical Therapy Evaluation", category: "physical-therapy", defaultCpt: "97161" },
      { code: "PT-TX", name: "Therapeutic Exercise", category: "physical-therapy", defaultCpt: "97110" },
      { code: "MANUAL", name: "Manual Therapy", category: "physical-therapy", defaultCpt: "97140" },
      { code: "CHIRO", name: "Chiropractic Adjustment", category: "physical-therapy", defaultCpt: "98941" },
    ],
    diagnoses: [
      { code: "M54.5", display: "Low back pain" },
      { code: "M54.2", display: "Cervicalgia" },
      { code: "S13.4XXA", display: "Sprain of ligaments of cervical spine, initial encounter" },
      { code: "M25.551", display: "Pain in left hip" },
      { code: "M62.830", display: "Muscle spasm of back" },
    ],
    medications: [{ display: "Cyclobenzaprine 10 mg Tablet" }, { display: "Naproxen 500 mg Tablet" }, { display: "Ibuprofen 600 mg Tablet" }, { display: "Diclofenac Sodium 1% Gel" }],
  },
  primary: {
    label: "Primary Care",
    services: [
      { code: "PRIMARY-NEW", name: "New Patient Visit", category: "primary-care", defaultCpt: "99204" },
      { code: "PRIMARY-OV", name: "Established Visit", category: "primary-care", defaultCpt: "99213" },
      { code: "WELLNESS", name: "Annual Wellness Visit", category: "primary-care", defaultCpt: "G0439" },
      { code: "TELEHEALTH", name: "Telehealth Visit", category: "other-services", defaultCpt: "99421" },
    ],
    diagnoses: [
      { code: "I10", display: "Essential (primary) hypertension" },
      { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
      { code: "E78.5", display: "Hyperlipidemia, unspecified" },
      { code: "J06.9", display: "Acute upper respiratory infection, unspecified" },
      { code: "Z00.00", display: "General adult medical examination without abnormal findings" },
    ],
    medications: [{ display: "Lisinopril 10 mg Tablet" }, { display: "Metformin 500 mg Tablet" }, { display: "Atorvastatin 20 mg Tablet" }, { display: "Amoxicillin 500 mg Capsule" }],
  },
  aesthetic: {
    label: "Aesthetic Medicine & Wellness",
    services: [
      { code: "IV-THERAPY", name: "IV Vitamin Therapy", category: "aesthetic-medicine" },
      { code: "BOTOX", name: "Neuromodulator Treatment", category: "aesthetic-medicine" },
      { code: "WEIGHT", name: "Medical Weight Management", category: "aesthetic-medicine" },
      { code: "WELLNESS-CONSULT", name: "Wellness Consultation", category: "other-services" },
    ],
    diagnoses: [
      { code: "E66.9", display: "Obesity, unspecified" },
      { code: "L70.0", display: "Acne vulgaris" },
      { code: "E55.9", display: "Vitamin D deficiency, unspecified" },
      { code: "R53.83", display: "Other fatigue" },
    ],
    medications: [{ display: "Semaglutide 0.25 mg/0.5 mL Injection" }, { display: "Vitamin B12 (Cyanocobalamin) 1000 mcg/mL Injection" }, { display: "Ascorbic Acid (Vitamin C) 500 mg Tablet" }],
  },
};

export async function GET() {
  return NextResponse.json({
    packs: Object.entries(PACKS).map(([id, p]) => ({
      id,
      label: p.label,
      services: p.services.map((s) => s.name),
      diagnoses: p.diagnoses.map((d) => `${d.code} — ${d.display}`),
      medications: p.medications.map((m) => m.display),
    })),
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pack = PACKS[String(body?.specialty || "")];
  if (!pack) return NextResponse.json({ error: "Unknown specialty" }, { status: 400 });

  let services = 0, diagnoses = 0, medications = 0;
  for (const svc of pack.services) {
    await db.serviceType.upsert({
      where: { code: svc.code },
      update: { name: svc.name, category: svc.category, active: true, durationMin: svc.durationMin ?? 45, defaultCpt: svc.defaultCpt ?? null },
      create: { code: svc.code, name: svc.name, category: svc.category, active: true, durationMin: svc.durationMin ?? 45, defaultCpt: svc.defaultCpt ?? null },
    });
    services++;
  }
  for (const dx of pack.diagnoses) {
    await db.refData.upsert({
      where: { type_display: { type: "diagnosis", display: dx.display } },
      update: { code: dx.code, system: "ICD-10-CM", active: true },
      create: { type: "diagnosis", display: dx.display, code: dx.code, system: "ICD-10-CM", active: true },
    });
    diagnoses++;
  }
  for (const rx of pack.medications) {
    await db.refData.upsert({
      where: { type_display: { type: "medication", display: rx.display } },
      update: { system: "RxNorm", active: true },
      create: { type: "medication", display: rx.display, system: "RxNorm", active: true },
    });
    medications++;
  }
  return NextResponse.json({ ok: true, specialty: body.specialty, services, diagnoses, medications });
}
