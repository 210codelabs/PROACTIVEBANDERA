import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync, rmSync } from "fs";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/installer (admin only) — builds and streams a .zip of the
// separate white-label installer/cloner project (/app/installer), excluding
// node_modules/.next/.git. This does NOT touch the running application.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const out = "/tmp/clinic-installer.zip";
  try {
    if (existsSync(out)) rmSync(out);
    execSync(
      `cd /app && zip -rq ${out} installer -x 'installer/node_modules/*' 'installer/.next/*' 'installer/.git/*' 'installer/*.log' 'installer/.env'`,
      { stdio: "pipe", maxBuffer: 1024 * 1024 * 64 },
    );
    const buf = readFileSync(out);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="clinic-installer.zip"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Could not build installer package: ${msg}` }, { status: 500 });
  }
}
