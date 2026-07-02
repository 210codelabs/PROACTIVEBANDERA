import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { patchAdminConfig, readAdminConfig } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  section: z.enum(["branding", "landing", "org", "security", "portal", "modules", "roles"]),
  data: z.any(),
});

export async function GET() {
  await requireAdminSession();
  const config = await readAdminConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { section, data } = parse.data;
  const config = await patchAdminConfig(section, data);
  return NextResponse.json({ ok: true, config });
}
