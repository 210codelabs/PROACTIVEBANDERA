import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/branding/[key] — public serve of an uploaded branding asset (logos,
// slides) stored in MongoDB. Whitelisted in middleware so the landing/kiosk can
// render it without a session.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const asset = await db.brandAsset.findUnique({ where: { key } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = Buffer.from(asset.dataBase64, "base64");
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType || "image/png",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=60",
    },
  });
}
