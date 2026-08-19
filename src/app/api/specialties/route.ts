import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function slugify(s: string): string {
  return String(s || "").toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

const COMMON = [
  "Cardiology", "Pediatrics", "Dermatology", "Orthopedics", "Neurology", "Psychiatry",
  "Endocrinology", "Gastroenterology", "Family Medicine", "Internal Medicine",
  "Obstetrics & Gynecology", "Ophthalmology", "Pulmonology", "Rheumatology", "Urology",
  "Physical Therapy", "Pain Management", "Podiatry",
];

// GET /api/specialties -> list specialties with provider/patient counts (seeds common ones once)
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  let count = 0;
  try { count = await db.specialty.count(); } catch { /* ignore */ }
  if (count === 0) {
    for (let i = 0; i < COMMON.length; i++) {
      const name = COMMON[i];
      await db.specialty.create({ data: { slug: slugify(name), name, sortOrder: i } }).catch(() => {});
    }
  }

  const specialties = await db.specialty.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { providers: true, patients: true } } },
  }).catch(() => []);

  return NextResponse.json({
    specialties: specialties.map((s: any) => ({
      id: s.id, slug: s.slug, name: s.name, description: s.description,
      providerCount: s._count?.providers || 0, patientCount: s._count?.patients || 0,
    })),
  });
}

const CreateBody = z.object({ name: z.string().min(1), description: z.string().optional().nullable() });

// POST /api/specialties -> add a specialty
export async function POST(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const json = await req.json().catch(() => null);
  const parse = CreateBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "A specialty name is required." }, { status: 400 });
  const name = parse.data.name.trim();
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Invalid specialty name." }, { status: 400 });
  const dup = await db.specialty.findUnique({ where: { slug } }).catch(() => null);
  if (dup) return NextResponse.json({ error: "That specialty already exists." }, { status: 409 });
  const sp = await db.specialty.create({ data: { slug, name, description: parse.data.description || null, sortOrder: 999 } });
  return NextResponse.json({ ok: true, specialty: { id: sp.id, slug: sp.slug, name: sp.name, description: sp.description, providerCount: 0, patientCount: 0 } });
}
