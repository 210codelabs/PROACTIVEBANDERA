import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await db.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { mrn: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, mrn: true, firstName: true, lastName: true, dob: true },
      take: 8,
      orderBy: { lastName: "asc" },
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], unavailable: true }, { status: 503 });
  }
}
