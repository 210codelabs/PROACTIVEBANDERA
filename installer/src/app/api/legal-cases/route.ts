import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/legal-cases  — staff list of all legal cases
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cases = await db.legalCase.findMany({
    orderBy: { updatedAt: "desc" },
    include: { patient: { select: { id: true, firstName: true, lastName: true, mrn: true } }, attorney: { select: { name: true, firm: true } } },
  });
  return NextResponse.json({ cases });
}
