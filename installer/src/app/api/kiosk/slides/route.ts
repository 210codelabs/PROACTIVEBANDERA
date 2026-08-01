import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readKioskConfig, writeKioskConfig } from "@/lib/kiosk/store";
import { KIOSK_SLIDE_CATALOG, normalizeConfig } from "@/lib/kiosk/config";

// GET /api/kiosk/slides  (public — the kiosk reads this to know which slides
// to show and in what order). Returns the normalized config + catalog labels.
export async function GET() {
  try {
    const config = await readKioskConfig();
    return NextResponse.json({ config, catalog: KIOSK_SLIDE_CATALOG });
  } catch (err) {
    console.error("GET /api/kiosk/slides error", err);
    return NextResponse.json({ error: "Failed to load kiosk slides" }, { status: 500 });
  }
}

// PUT /api/kiosk/slides  { config: [{ id, enabled }] }
// Staff-only. This path is public in middleware (kiosk needs GET without auth),
// so we enforce a staff session here explicitly.
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.config)) {
      return NextResponse.json({ error: "config array required" }, { status: 400 });
    }
    const saved = await writeKioskConfig(normalizeConfig(body.config));
    return NextResponse.json({ ok: true, config: saved });
  } catch (err) {
    console.error("PUT /api/kiosk/slides error", err);
    return NextResponse.json({ error: "Failed to save kiosk slides" }, { status: 500 });
  }
}
