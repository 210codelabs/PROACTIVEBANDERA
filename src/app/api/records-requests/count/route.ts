import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET() {
  await requireSession();
  const pending = await db.recordRequest.count({ where: { status: "pending" } });
  return NextResponse.json({ pending });
}
