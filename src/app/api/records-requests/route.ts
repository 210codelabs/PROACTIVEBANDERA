import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// Staff: list all attorney record requests
export async function GET() {
  await requireSession();
  const requests = await db.recordRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { attorney: { select: { name: true, firm: true, email: true } } },
  });
  return NextResponse.json({ requests });
}
