import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function GET() {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoices = await db.enterpriseInvoice.findMany({ where: { enterpriseId: s.enterpriseId, status: { not: "draft" } }, orderBy: { issueDate: "desc" }, take: 100 });
  return NextResponse.json({ invoices });
}
