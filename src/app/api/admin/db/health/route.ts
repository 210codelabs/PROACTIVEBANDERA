import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbHealth } from "@/lib/dbAdmin";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const health = await dbHealth();
  return NextResponse.json(health);
}
