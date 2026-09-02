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

// POST /api/pt/ai-codes
// Body: { note:{...7 sections}, cptCodes:[], icdCodes:[] }
// Flags CPT/ICD codes the documentation does NOT clearly support (pre-sign check).
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const note = body?.note || {};
    const cptCodes: string[] = Array.isArray(body?.cptCodes) ? body.cptCodes.map((c: any) => String(c).trim()).filter(Boolean) : [];
    const icdCodes: string[] = Array.isArray(body?.icdCodes) ? body.icdCodes.map((c: any) => String(c).trim()).filter(Boolean) : [];

    if (!cptCodes.length && !icdCodes.length) {
      return NextResponse.json({ error: "Add at least one CPT or ICD-10 code to check." }, { status: 400 });
    }

    const fields = ["mechanism", "subjective", "objective", "assessment", "plan", "goals", "causation"] as const;
    const documentation = fields.map((f) => `${f.toUpperCase()}: ${String(note[f] || "").trim() || "(empty)"}`).join("\n\n");

    const systemMessage = [
      "You are a physical-therapy coding auditor reviewing a PERSONAL INJURY PT note BEFORE the therapist signs it.",
      "Given the note documentation and the CPT and ICD-10 codes the therapist entered, decide whether the documentation reasonably SUPPORTS each code.",
      "A CPT is UNSUPPORTED if the note does not describe the service/intervention it represents (e.g. 97140 manual therapy with no manual technique documented, 97110 with no therapeutic exercise).",
      "An ICD-10 is UNSUPPORTED if no symptom, finding, or assessment in the note relates to that diagnosis.",
      "Do NOT invent documentation. Judge only from what is written. Be practical, not pedantic — flag clear gaps, not stylistic issues. This is decision-support only; the therapist makes the final call.",
      "Return ONLY a single valid JSON object (no prose, no markdown) with this exact shape:",
      `{
  "ok": true,
  "flags": [ { "code": "97140", "type": "cpt", "severity": "warning", "issue": "short reason the documentation does not support this code" } ],
  "summary": "one short sentence overview"
}`,
      "type is 'cpt' or 'icd'. severity is 'warning' (likely unsupported) or 'info' (minor). If everything is supported, return an empty flags array and ok:true.",
    ].join("\n");

    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const provider = (process.env.PT_MODEL_PROVIDER || process.env.PORTAL_MODEL_PROVIDER || "openai") as "openai" | "anthropic" | "gemini";
    const model = process.env.PT_MODEL_ID || process.env.PORTAL_MODEL_ID || "gpt-5";
    const params: Record<string, unknown> = { max_tokens: 2000 };
    if (!/^gpt-5/i.test(model)) params.temperature = 0.1;

    const chat = createChat({ apiKey, sessionId: `pt-codes-${Math.random().toString(36).slice(2)}`, systemMessage, provider, model, params });
    const raw = await chat.sendMessage(new UserMessage({
      text: `DOCUMENTATION:\n\n${documentation}\n\nENTERED CPT CODES: ${cptCodes.join(", ") || "(none)"}\nENTERED ICD-10 CODES: ${icdCodes.join(", ") || "(none)"}\n\nReturn the audit JSON now.`,
    }));

    let parsed: any;
    try { parsed = extractJson(String(raw || "")); }
    catch (e) {
      console.error("AI codes parse error", e, String(raw).slice(0, 400));
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    const flags = Array.isArray(parsed.flags) ? parsed.flags.map((f: any) => ({
      code: String(f.code || ""), type: (f.type === "icd" ? "icd" : "cpt"),
      severity: (f.severity === "info" ? "info" : "warning"), issue: String(f.issue || ""),
    })).filter((f: any) => f.code) : [];

    return NextResponse.json({ ok: true, flags, summary: String(parsed.summary || (flags.length ? `${flags.length} code(s) may not be supported.` : "All entered codes appear supported.")) });
  } catch (err) {
    console.error("POST /api/pt/ai-codes error", err);
    return NextResponse.json({ error: "Failed to check codes" }, { status: 500 });
  }
}
