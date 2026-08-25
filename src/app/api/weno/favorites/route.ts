import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET -> the signed-in clinician's starred pharmacies.
export async function GET() {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const favorites = await db.favoritePharmacy.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return NextResponse.json({ favorites });
}

const Body = z.object({
  ncpdpId: z.string().min(1),
  name: z.string().min(1),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

// POST -> star a pharmacy (idempotent per user + ncpdpId).
export async function POST(req: Request) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "ncpdpId and name are required" }, { status: 400 });
  const b = parse.data;
  const fav = await db.favoritePharmacy.upsert({
    where: { userId_ncpdpId: { userId: user.id, ncpdpId: b.ncpdpId } },
    create: { userId: user.id, ncpdpId: b.ncpdpId, name: b.name, city: b.city || null, state: b.state || null, phone: b.phone || null },
    update: { name: b.name, city: b.city || null, state: b.state || null, phone: b.phone || null },
  });
  return NextResponse.json({ ok: true, favorite: fav });
}

// DELETE ?ncpdpId=... -> unstar.
export async function DELETE(req: Request) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const ncpdpId = new URL(req.url).searchParams.get("ncpdpId") || "";
  if (!ncpdpId) return NextResponse.json({ error: "ncpdpId required" }, { status: 400 });
  await db.favoritePharmacy.deleteMany({ where: { userId: user.id, ncpdpId } });
  return NextResponse.json({ ok: true });
}
