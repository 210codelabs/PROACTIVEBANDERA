import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLINIC_OPEN_MIN, CLINIC_CLOSE_MIN } from "@/lib/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DayHours = { open: number; close: number; closed?: boolean };

function sanitize(raw: unknown): Record<string, DayHours> | null {
  if (raw === null) return null; // explicit "reset to clinic default"
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, DayHours> = {};
  for (const k of ["0", "1", "2", "3", "4", "5", "6"]) {
    const d = (raw as any)[k];
    if (!d) continue;
    const open = Math.max(0, Math.min(1439, Math.round(Number(d.open))));
    const close = Math.max(0, Math.min(1440, Math.round(Number(d.close))));
    const closed = Boolean(d.closed);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    if (!closed && close <= open) continue; // ignore invalid ranges
    out[k] = { open, close, closed };
  }
  return Object.keys(out).length ? out : null;
}

// GET /api/providers/hours[?providerId=]  -> hours for me (or a provider if admin) + provider list for admins
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.role === "admin";
  const wanted = new URL(req.url).searchParams.get("providerId") || "";
  const targetId = isAdmin && wanted ? wanted : session.id;

  const u = await db.user.findUnique({ where: { id: targetId }, select: { id: true, firstName: true, lastName: true, workingHours: true } });
  let providers: { id: string; name: string }[] = [];
  if (isAdmin) {
    const rows = await db.user.findMany({
      where: { active: true, role: { in: ["provider", "nurse", "admin"] } },
      select: { id: true, firstName: true, lastName: true, credential: true },
      orderBy: [{ lastName: "asc" }],
    }).catch(() => []);
    providers = rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}${r.credential ? `, ${r.credential}` : ""}` }));
  }
  return NextResponse.json({
    isAdmin,
    providerId: u?.id || session.id,
    providerName: u ? `${u.firstName} ${u.lastName}` : "",
    workingHours: (u?.workingHours as any) || null,
    clinicDefault: { open: CLINIC_OPEN_MIN, close: CLINIC_CLOSE_MIN },
    providers,
  });
}

// PUT /api/providers/hours  { providerId?, workingHours }  (admin can set for any provider; others only themselves)
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const isAdmin = session.role === "admin";
  const targetId = isAdmin && b.providerId ? String(b.providerId) : session.id;

  const hours = sanitize(b.workingHours);
  try {
    const updated = await db.user.update({ where: { id: targetId }, data: { workingHours: hours as any } });
    return NextResponse.json({ ok: true, providerId: updated.id, workingHours: (updated.workingHours as any) || null });
  } catch {
    return NextResponse.json({ error: "Could not save working hours." }, { status: 400 });
  }
}
