import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BASE64 = 8 * 1024 * 1024; // ~6MB binary per asset

function sanitizeKey(k: string): string {
  return String(k || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60);
}

// POST /api/site-config/assets  (admin) — upload/replace a branding asset.
// Body: { key, dataBase64, mimeType, size }. Returns a public URL under /api/branding/{key}.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const key = sanitizeKey(body?.key);
  const dataBase64 = String(body?.dataBase64 || "");
  if (!key || !dataBase64) return NextResponse.json({ error: "key and file are required" }, { status: 400 });
  if (dataBase64.length > MAX_BASE64) return NextResponse.json({ error: "File too large (max ~6MB)." }, { status: 413 });
  const mimeType = String(body?.mimeType || "image/png");
  const size = Number(body?.size || 0);
  await db.brandAsset.upsert({
    where: { key },
    update: { mimeType, dataBase64, size },
    create: { key, mimeType, dataBase64, size },
  });
  // Cache-busting version param so <img> refreshes after replacement.
  const url = `/api/branding/${key}?v=${Date.now()}`;
  return NextResponse.json({ ok: true, key, url });
}
