import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/credentialing/access { password } -> { ok: true } when correct.
// Password is checked server-side (kept out of the client bundle). Defaults to the
// agreed placeholder unless CREDENTIALING_ACCESS_PASSWORD is set in the environment.
export async function POST(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const expected = process.env.CREDENTIALING_ACCESS_PASSWORD || "P@$$w0rd01@";
  const ok = typeof b.password === "string" && b.password === expected;
  return NextResponse.json({ ok }, { status: ok ? 200 : 403 });
}
