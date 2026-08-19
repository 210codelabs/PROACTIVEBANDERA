import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/providers?q=  -> active clinical staff (providers/nurses) for linking
 * to specialties, care teams, etc. Read-only, any authenticated session.
 */
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  const where: any = { active: true };
  if (q) where.OR = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { specialty: { contains: q, mode: "insensitive" } },
  ];
  const users = await db.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, credential: true, specialty: true, role: true, npi: true },
    orderBy: [{ lastName: "asc" }],
    take: 200,
  }).catch(() => []);
  return NextResponse.json({
    providers: users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      credential: u.credential,
      specialty: u.specialty,
      role: u.role,
      npi: u.npi,
    })),
  });
}
