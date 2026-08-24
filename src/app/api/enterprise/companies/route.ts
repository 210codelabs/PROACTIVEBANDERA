import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

// Super admin (EMR staff admin) sees ALL companies; company admin sees only
// their own. Used by the portal to render the All-Mighty company switcher.
export async function GET() {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role === "super_admin") {
    const accounts = await db.enterpriseAccount.findMany({ orderBy: { companyName: "asc" } });
    const empCounts = await db.enterpriseEmployee.groupBy({ by: ["enterpriseId"], _count: { _all: true } }).catch(() => [] as any[]);
    const reqCounts = await db.enterpriseServiceRequest.groupBy({ by: ["enterpriseId"], _count: { _all: true } }).catch(() => [] as any[]);
    const em: Record<string, number> = {}; for (const c of empCounts as any[]) em[c.enterpriseId] = c._count._all;
    const rm: Record<string, number> = {}; for (const c of reqCounts as any[]) rm[c.enterpriseId] = c._count._all;
    return NextResponse.json({ role: "super_admin", companies: accounts.map((a) => ({ id: a.id, companyName: a.companyName, status: a.status, employeeCount: em[a.id] || 0, requestCount: rm[a.id] || 0 })) });
  }
  const acct = await db.enterpriseAccount.findUnique({ where: { id: s.enterpriseId } });
  return NextResponse.json({ role: "company_admin", companies: acct ? [{ id: acct.id, companyName: acct.companyName, status: acct.status }] : [] });
}
