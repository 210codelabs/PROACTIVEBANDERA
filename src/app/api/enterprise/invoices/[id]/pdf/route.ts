import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { buildInvoicePdf } from "@/lib/enterprise/invoicePdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const inv = await db.enterpriseInvoice.findUnique({ where: { id } });
  if (!inv || inv.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const acct = await db.enterpriseAccount.findUnique({ where: { id: inv.enterpriseId } });
  const bytes = await buildInvoicePdf(inv, acct);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${inv.number}.pdf"`, "Cache-Control": "no-store" } });
}
