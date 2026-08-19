import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/uploads/[id] -> serve the stored image bytes.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const up = await db.upload.findUnique({ where: { id } }).catch(() => null);
  if (!up) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = Buffer.from(up.data, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": up.mime || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
