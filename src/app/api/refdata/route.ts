import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/refdata?type=diagnosis&q=diab&limit=50
// Returns active reference values for a given catalog type (optionally filtered by search).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type")?.trim();
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
    const includeInactive = searchParams.get("all") === "1";
    if (!type) {
      return NextResponse.json({ error: "Missing 'type' parameter" }, { status: 400 });
    }

    const where: Record<string, unknown> = { type };
    if (!includeInactive) where.active = true;
    if (q) {
      where.OR = [
        { display: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ];
    }

    const items = await db.refData.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { display: "asc" }],
      take: limit,
      select: { id: true, type: true, code: true, display: true, system: true, data: true, active: true },
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/refdata error", err);
    return NextResponse.json({ error: "Failed to load reference data" }, { status: 500 });
  }
}

// POST /api/refdata  { type, display, code?, system?, data? }
// Creates (or reactivates) a catalog value so it becomes available for future entries.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const type = (body?.type ?? "").toString().trim();
    const display = (body?.display ?? "").toString().trim();
    if (!type || !display) {
      return NextResponse.json({ error: "type and display are required" }, { status: 400 });
    }

    const code = body?.code ? body.code.toString().trim() : null;
    const system = body?.system ? body.system.toString().trim() : "local";
    const data = body?.data && typeof body.data === "object" ? body.data : undefined;

    const item = await db.refData.upsert({
      where: { type_display: { type, display } },
      update: { active: true, ...(code ? { code } : {}), ...(data ? { data } : {}) },
      create: { type, display, code, system, data, sortOrder: 9999 },
      select: { id: true, type: true, code: true, display: true, system: true, data: true },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("POST /api/refdata error", err);
    return NextResponse.json({ error: "Failed to create reference value" }, { status: 500 });
  }
}
