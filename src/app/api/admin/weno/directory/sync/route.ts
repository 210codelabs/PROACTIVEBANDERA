import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncWenoDirectory } from "@/lib/weno/directory";
import { WenoOnlineError } from "@/lib/wenoOnline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/admin/weno/directory/sync  { daily?: boolean }
// Downloads Weno's EZ LITE pharmacy directory and refreshes WenoPharmacy
// (real NCPDP IDs). Admin only.
export async function POST(req: Request) {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const daily = Boolean(body?.daily);

  try {
    const result = await syncWenoDirectory({ daily });
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "erx.wenoEz.directorySync",
        resource: "WenoPharmacy",
        resourceId: null,
        meta: JSON.stringify({ mode: result.mode, total: result.total, upserted: result.upserted, removed: result.removed }),
      },
    }).catch(() => {});
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof WenoOnlineError ? e.status : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
