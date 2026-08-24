import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.enterpriseDocument.findUnique({ where: { id } });
  if (!doc || doc.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = Buffer.from(doc.dataBase64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
