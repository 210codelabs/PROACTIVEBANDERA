import { NextResponse } from "next/server";
import { readAdminConfig } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await readAdminConfig();
  return NextResponse.json({
    branding: config.branding,
    landing: config.landing,
    portal: config.portal,
  });
}
