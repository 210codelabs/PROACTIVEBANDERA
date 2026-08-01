import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/site-config/generate-image (admin) — generate a branding image with
// AI and persist it as a BrandAsset. Uses the Emergent Universal Key
// (EMERGENT_LLM_KEY) against the OpenAI-compatible image endpoint of the Emergent
// integrations proxy (gpt-image-1). We call the proxy directly (instead of the
// emergentintegrations image helper) because that helper forces a
// `response_format` param that gpt-image-1 rejects. Body: { key, prompt }.
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

  const proxy = process.env.INTEGRATION_PROXY_URL || "https://integrations.emergentagent.com";

  try {
    const resp = await fetch(`${proxy}/llm/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `Premium, photorealistic healthcare marketing image. ${prompt}. Clean, bright, professional, no text or watermark.`,
        n: 1,
        size: "1536x1024",
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return NextResponse.json({ error: `Image generation failed (${resp.status}): ${txt.slice(0, 200)}` }, { status: 502 });
    }
    const json = await resp.json();
    const item = json?.data?.[0];
    let dataBase64: string | null = item?.b64_json || null;
    if (!dataBase64 && item?.url) {
      const img = await fetch(item.url);
      dataBase64 = Buffer.from(await img.arrayBuffer()).toString("base64");
    }
    if (!dataBase64) return NextResponse.json({ error: "No image returned" }, { status: 502 });

    const size = Buffer.from(dataBase64, "base64").length;
    await db.brandAsset.upsert({
      where: { key },
      update: { mimeType: "image/png", dataBase64, size },
      create: { key, mimeType: "image/png", dataBase64, size },
    });
    return NextResponse.json({ ok: true, key, url: `/api/branding/${key}?v=${Date.now()}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Image generation failed: ${msg}` }, { status: 502 });
  }
}
