import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function GET() {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const acct = await db.enterpriseAccount.findUnique({ where: { id: s.enterpriseId } });
  const requests = await db.enterpriseServiceRequest.findMany({ where: { enterpriseId: s.enterpriseId }, orderBy: { createdAt: "desc" }, take: 200 });
  const openInvoices = await db.enterpriseInvoice.count({ where: { enterpriseId: s.enterpriseId, status: { in: ["sent", "draft"] } } });
  const stats = {
    total: requests.length,
    open: requests.filter((r) => r.status !== "completed" && r.status !== "cancelled").length,
    pendingConsent: requests.filter((r) => r.consentStatus !== "signed").length,
    completed: requests.filter((r) => r.status === "completed").length,
    openInvoices,
  };
  return NextResponse.json({ session: s, account: acct, stats });
}
