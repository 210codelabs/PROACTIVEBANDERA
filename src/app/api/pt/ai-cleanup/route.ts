import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createChat, UserMessage, validateApiKey } from "emergentintegrations";

export const runtime = "nodejs";

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fence = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fence ? fence[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

// POST /api/pt/ai-cleanup
// Body: { note: {mechanism,subjective,objective,assessment,plan,goals,causation} }
// Proofreads / tightens an EXISTING PI note WITHOUT inventing new clinical facts.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const note = body?.note || {};
    const fields = ["mechanism", "subjective", "objective", "assessment", "plan", "goals", "causation"] as const;
    const hasContent = fields.some((f) => String(note[f] || "").trim());
    if (!hasContent) return NextResponse.json({ error: "There is no note content to proofread yet." }, { status: 400 });

    const current = fields
      .map((f) => `${f.toUpperCase()}: ${String(note[f] || "").trim() || "(empty)"}`)
      .join("\n\n");

    const systemMessage = [
      "You are a medical editor for a licensed Physical Therapist's PERSONAL INJURY physical-therapy note.",
      "Your ONLY job is to proofread and tighten the existing text: fix grammar, spelling, punctuation, clarity, professional clinical tone, and consistent formatting.",
      "STRICT RULES: Do NOT add, remove, or change any clinical facts, findings, measurements, dates, body regions, codes, or conclusions. Do NOT invent anything. Do NOT expand empty sections. If a section is empty, keep it empty.",
      "Preserve meaning exactly; only improve wording and readability.",
      "Return ONLY a single valid JSON object (no prose, no markdown) with exactly these keys: mechanism, subjective, objective, assessment, plan, goals, causation. Each value is the cleaned string for that section (empty string if it was empty).",
    ].join("\n");

    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const provider = (process.env.PT_MODEL_PROVIDER || process.env.PORTAL_MODEL_PROVIDER || "openai") as "openai" | "anthropic" | "gemini";
    const model = process.env.PT_MODEL_ID || process.env.PORTAL_MODEL_ID || "gpt-5";
    const params: Record<string, unknown> = { max_tokens: 4000 };
    if (!/^gpt-5/i.test(model)) params.temperature = 0.1;

    const chat = createChat({ apiKey, sessionId: `pt-cleanup-${Math.random().toString(36).slice(2)}`, systemMessage, provider, model, params });
    const raw = await chat.sendMessage(new UserMessage({ text: `Proofread and tighten this PI note. Return the cleaned JSON only.\n\n${current}` }));

    let parsed: any;
    try { parsed = extractJson(String(raw || "")); }
    catch (e) {
      console.error("AI cleanup parse error", e, String(raw).slice(0, 400));
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    const cleaned: Record<string, string> = {};
    for (const f of fields) cleaned[f] = String(parsed[f] ?? note[f] ?? "");
    return NextResponse.json({ ok: true, note: cleaned });
  } catch (err) {
    console.error("POST /api/pt/ai-cleanup error", err);
    return NextResponse.json({ error: "Failed to proofread note" }, { status: 500 });
  }
}
