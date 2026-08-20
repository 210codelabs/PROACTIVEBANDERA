import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/me/prescriber -> current user's saved NPI/DEA
export async function GET() {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const u = await db.user.findUnique({ where: { id: user.id }, select: { npi: true, dea: true, credential: true } }).catch(() => null);
  return NextResponse.json({ npi: u?.npi || "", dea: u?.dea || "", credential: u?.credential || "" });
}

const Body = z.object({ npi: z.string().max(20).optional().nullable(), dea: z.string().max(20).optional().nullable() });

// PUT /api/me/prescriber -> save NPI/DEA to the current user's profile
export async function PUT(req: Request) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const parse = Body.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const u = await db.user.update({ where: { id: user.id }, data: { npi: parse.data.npi || null, dea: parse.data.dea || null }, select: { npi: true, dea: true } });
    return NextResponse.json({ ok: true, ...u });
  } catch {
    // Demo/non-DB session — nothing to persist.
    return NextResponse.json({ ok: false, error: "Could not save to your profile (no user record)." }, { status: 200 });
  }
}
