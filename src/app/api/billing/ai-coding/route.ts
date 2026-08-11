import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createChat, UserMessage, validateApiKey } from "emergentintegrations";

export const runtime = "nodejs";

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fence = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fence ? fence[1] : cleaned;
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON found");
  return JSON.parse(candidate.slice(s, e + 1));
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * POST /api/billing/ai-coding
 * Superbill / claim AI coding assistant. Reviews CPT/HCPCS + ICD-10 linkage
 * against the clinical note, suggests missing/likely codes, and flags medical-
 * necessity and modifier issues. DRAFT guidance for a certified coder to verify
 * — not a compliance guarantee.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const cpt = toList(b.cptCodes);
  const icd = toList(b.icd10Codes);
  const note = String(b.note || "").slice(0, 6000);
  const payerName = String(b.payerName || "").slice(0, 120);
  const specialty = String(b.specialty || "").slice(0, 60);

  if (cpt.length === 0 && icd.length === 0 && !note) {
    return NextResponse.json({ error: "Provide CPT/ICD codes and/or a clinical note." }, { status: 400 });
  }

  const systemMessage = [
    "You are a certified medical coding & billing assistant for Proactive Clinic (San Antonio, TX), a wellness & physical-rehabilitation practice.",
    "Review the provided CPT/HCPCS procedure codes and ICD-10 diagnosis codes against the clinical note for a professional (CMS-1500 / 837P) claim.",
    "Check: (1) each CPT is supported by documentation and linked to a justifying ICD-10 (medical necessity); (2) missing likely codes (e.g., PT eval/therapeutic exercise, E/M level); (3) modifier needs (e.g., 59/XU, GP for PT, 25 for E/M with procedure); (4) obvious NCCI edit conflicts or units problems; (5) diagnosis specificity (laterality/episode).",
    "Be concise and practical. This is DRAFT guidance a certified coder MUST verify; do not claim compliance certification.",
    "Return ONLY one JSON object with EXACTLY this shape:",
    `{
  "summary": "1-2 sentence overview",
  "cleanClaimReady": true,
  "medicalNecessity": "brief note on CPT<->ICD linkage adequacy",
  "suggestedCpt": [{"code":"","description":"","modifier":"","rationale":""}],
  "suggestedIcd10": [{"code":"","description":"","rationale":""}],
  "issues": [{"severity":"error|warning|info","message":""}]
}`,
    "cleanClaimReady = false if there are any 'error' issues. Empty arrays when nothing to add.",
  ].join("\n");

  const prompt = [
    payerName ? `Payer: ${payerName}` : "",
    specialty ? `Specialty/context: ${specialty}` : "",
    `CPT/HCPCS on claim: ${cpt.join(", ") || "(none)"}`,
    `ICD-10 on claim: ${icd.join(", ") || "(none)"}`,
    `\nClinical note / superbill context:\n${note || "(none provided)"}`,
    "\nReturn the coding review JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const chat = createChat({
      apiKey,
      sessionId: `ai-coding-${session.id}-${Date.now()}`,
      systemMessage,
      provider: (process.env.PORTAL_MODEL_PROVIDER as "openai" | "anthropic" | "gemini") || "openai",
      model: process.env.PORTAL_MODEL_ID || "gpt-4o",
      params: { temperature: 0.2, max_tokens: 1400 },
    });
    const raw = await chat.sendMessage(new UserMessage({ text: prompt }));
    let parsed: any;
    try { parsed = extractJson(String(raw || "")); }
    catch { return NextResponse.json({ error: "AI returned an unexpected format. Try again." }, { status: 502 }); }

    const norm = {
      summary: String(parsed.summary || ""),
      cleanClaimReady: Boolean(parsed.cleanClaimReady),
      medicalNecessity: String(parsed.medicalNecessity || ""),
      suggestedCpt: Array.isArray(parsed.suggestedCpt) ? parsed.suggestedCpt.map((c: any) => ({ code: String(c.code || ""), description: String(c.description || ""), modifier: String(c.modifier || ""), rationale: String(c.rationale || "") })).filter((c: any) => c.code || c.description) : [],
      suggestedIcd10: Array.isArray(parsed.suggestedIcd10) ? parsed.suggestedIcd10.map((c: any) => ({ code: String(c.code || ""), description: String(c.description || ""), rationale: String(c.rationale || "") })).filter((c: any) => c.code || c.description) : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((i: any) => ({ severity: ["error", "warning", "info"].includes(i.severity) ? i.severity : "info", message: String(i.message || "") })).filter((i: any) => i.message) : [],
    };
    return NextResponse.json({ ok: true, review: norm });
  } catch (err) {
    console.error("ai-coding error", err);
    return NextResponse.json({ error: "AI coding assistant failed." }, { status: 500 });
  }
}
