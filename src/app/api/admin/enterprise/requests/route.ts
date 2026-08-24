import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

export async function GET(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const enterpriseId = new URL(req.url).searchParams.get("enterpriseId") || undefined;
  const where: any = {}; if (enterpriseId) where.enterpriseId = enterpriseId;
  const requests = await db.enterpriseServiceRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  const accts = await db.enterpriseAccount.findMany({ select: { id: true, companyName: true } });
  const nameMap: Record<string, string> = {}; for (const a of accts) nameMap[a.id] = a.companyName;
  return NextResponse.json({ requests: requests.map((r) => ({ ...r, companyName: nameMap[r.enterpriseId] || "" })) });
}
