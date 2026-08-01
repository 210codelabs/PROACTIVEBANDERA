import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSiteConfig, saveSiteConfig, type SiteConfig } from "@/lib/site/config";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const s = await getSession();
  if (!s) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (s.role !== "admin") return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { session: s };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const config = await getSiteConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<SiteConfig>;
  const config = await saveSiteConfig(body);
  return NextResponse.json({ ok: true, config });
}
