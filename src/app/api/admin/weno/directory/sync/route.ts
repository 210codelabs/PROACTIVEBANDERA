import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getWenoConfig, runDirectorySync, getWenoDirState, setWenoDirState, WenoError } from "@/lib/weno";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST -> download Weno pharmacy directory and upsert into the local cache.
export async function POST() {
  await requireAdminSession();
  const cfg = await getWenoConfig();
  if (!cfg.partnerId || !cfg.md5Password) {
    return NextResponse.json({ error: "Configure Weno credentials first (Admin → Integrations)." }, { status: 400 });
  }
  try {
    const res = await runDirectorySync();
    return NextResponse.json({ ok: true, imported: res.imported, total: res.total });
  } catch (e: any) {
    const status = e instanceof WenoError ? e.status : undefined;
    await setWenoDirState({ lastError: String(e?.message || e).slice(0, 300) });
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: status && status >= 400 && status < 500 ? 400 : 502 });
  }
}

// GET -> cached count + schedule state (autoSync, lastSyncAt, lastResult).
export async function GET() {
  await requireAdminSession();
  const [count, state] = await Promise.all([
    db.wenoPharmacy.count().catch(() => 0),
    getWenoDirState(),
  ]);
  return NextResponse.json({ count, ...state });
}

// PATCH { autoSync: boolean } -> toggle nightly auto-sync.
export async function PATCH(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const autoSync = Boolean(body?.autoSync);
  const state = await setWenoDirState({ autoSync });
  return NextResponse.json({ ok: true, ...state });
}
