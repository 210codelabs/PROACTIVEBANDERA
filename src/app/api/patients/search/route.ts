import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Build a DOB date-range condition from a free-text date query.
// Supports YYYY-MM-DD, YYYY, and MM/DD/YYYY.
function dobCondition(q: string): Prisma.PatientWhereInput | null {
  const iso = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const start = new Date(`${q}T00:00:00.000Z`);
    if (!isNaN(start.getTime())) {
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
      return { dob: { gte: start, lt: end } };
    }
  }
  const us = q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mm, dd, yyyy] = us;
    const start = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!isNaN(start.getTime())) {
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
      return { dob: { gte: start, lt: end } };
    }
  }
  const year = q.match(/^(\d{4})$/);
  if (year) {
    const y = Number(year[1]);
    if (y >= 1900 && y <= 2100) {
      return { dob: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } };
    }
  }
  return null;
}

const SORTS: Record<string, Prisma.PatientOrderByWithRelationInput> = {
  name_asc: { lastName: "asc" },
  name_desc: { lastName: "desc" },
  dob_asc: { dob: "asc" },
  dob_desc: { dob: "desc" },
  created_desc: { createdAt: "desc" },
  mrn_asc: { mrn: "asc" },
};

export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = (url.searchParams.get("status") || "").trim(); // active | inactive | deceased
  const sex = (url.searchParams.get("sex") || "").trim();        // M | F | X
  const sortKey = (url.searchParams.get("sort") || "name_asc").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 8) || 8, 50);

  // Require at least a query OR an explicit filter (avoid dumping the whole table on empty).
  if (!q && !status && !sex) return NextResponse.json({ results: [] });

  try {
    const and: Prisma.PatientWhereInput[] = [];

    if (q) {
      const or: Prisma.PatientWhereInput[] = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { mrn: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
      const dob = dobCondition(q);
      if (dob) or.push(dob);
      and.push({ OR: or });
    }
    if (status) and.push({ status });
    if (sex) and.push({ sex });

    const results = await db.patient.findMany({
      where: and.length ? { AND: and } : {},
      select: { id: true, mrn: true, firstName: true, lastName: true, dob: true, sex: true, status: true, phone: true },
      take: limit,
      orderBy: SORTS[sortKey] || SORTS.name_asc,
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], unavailable: true }, { status: 503 });
  }
}
