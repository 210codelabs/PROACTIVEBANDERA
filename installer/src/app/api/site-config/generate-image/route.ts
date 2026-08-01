import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OpenAIImageGeneration } from "emergentintegrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site-config/generate-image (admin) — generate a branding image with
// AI and persist it as a BrandAsset. Uses OpenAI gpt-image-1 through the
// Emergent Universal Key (EMERGENT_LLM_KEY) so no extra provider key is needed.
// Body: { key, prompt }. Returns { ok, key, url }.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI image generation is not configured (missing EMERGENT_LLM_KEY)." }, { status: 501 });

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60);
  const prompt = String(body?.prompt || "").trim();
  if (!key || !prompt) return NextResponse.json({ error: "key and prompt are required" }, { status: 400 });

  try {
    const gen = new OpenAIImageGeneration(apiKey);
    const images: Buffer[] = await gen.generateImages(
      `Premium, photorealistic healthcare marketing image. ${prompt}. Clean, bright, professional, no text or watermark.`,
      "gpt-image-1",
      1,
    );
    const buf = images?.[0];
    if (!buf) return NextResponse.json({ error: "No image returned" }, { status: 502 });
    const dataBase64 = Buffer.from(buf).toString("base64");
    await db.brandAsset.upsert({
      where: { key },
      update: { mimeType: "image/png", dataBase64, size: buf.length },
      create: { key, mimeType: "image/png", dataBase64, size: buf.length },
    });
    return NextResponse.json({ ok: true, key, url: `/api/branding/${key}?v=${Date.now()}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Image generation failed: ${msg}` }, { status: 502 });
  }
}
