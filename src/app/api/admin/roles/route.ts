import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { patchAdminConfig, readAdminConfig } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

const PermissionSet = z.object({
  dashboard: z.boolean(),
  scheduling: z.boolean(),
  patientsRead: z.boolean(),
  patientsWrite: z.boolean(),
  encountersWrite: z.boolean(),
  ordersWrite: z.boolean(),
  billingRead: z.boolean(),
  billingWrite: z.boolean(),
  messaging: z.boolean(),
  adminAccess: z.boolean(),
});

const Body = z.object({
  roles: z.object({
    provider: PermissionSet,
    nurse: PermissionSet,
    frontdesk: PermissionSet,
    billing: PermissionSet,
    admin: PermissionSet,
  }),
});

export async function GET() {
  await requireAdminSession();
  const config = await readAdminConfig();
  return NextResponse.json({ roles: config.roles });
}

export async function PUT(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Merge with existing config so roles not editable in this UI (e.g. physical_therapist) are preserved.
  const current = await readAdminConfig();
  const merged = { ...current.roles, ...parse.data.roles };
  const config = await patchAdminConfig("roles", merged);
  return NextResponse.json({ ok: true, roles: config.roles });
}
