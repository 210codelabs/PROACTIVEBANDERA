import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createChat, UserMessage, validateApiKey } from "emergentintegrations";

export const runtime = "nodejs";

function ageFrom(dob?: Date | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

// Extract the first JSON object from an LLM reply (handles ```json fences / stray prose).
function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fenceMatch = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI reply");
  return JSON.parse(candidate.slice(start, end + 1));
}

// POST /api/pt/ai-note
// Body: { dictation: string, draft?: {...pi note fields}, patientId?: string }
// Turns a physical therapist's free dictation + the current draft into a
// normalized Texas personal-injury encounter note (returns structured JSON).
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const dictation: string = String(body?.dictation || "").trim();
    const draft = body?.draft || {};
    const patientId: string | undefined = body?.patientId;

    if (!dictation && !Object.values(draft).some((v) => String(v || "").trim())) {
      return NextResponse.json({ error: "Provide some dictation or draft text first." }, { status: 400 });
    }

    // Optional patient / accident context (kept separate from clinical charts).
    const lines: string[] = [];
    if (patientId) {
      const p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
      if (p) {
        const age = ageFrom(p.dob);
        lines.push(`PATIENT: ${p.firstName} ${p.lastName} — ${p.sex || "?"}${age != null ? `, age ${age}` : ""}`);
      }
      const intake = await db.piIntake
        .findFirst({ where: { patientId }, orderBy: { createdAt: "desc" } })
        .catch(() => null);
      if (intake) {
        lines.push("\nPI ACCIDENT INTAKE ON FILE:");
        lines.push(`- Accident: ${(intake as any).accidentType || "?"}${(intake as any).accidentDate ? ` on ${String((intake as any).accidentDate).slice(0, 10)}` : ""}`);
        if ((intake as any).description) lines.push(`- How it happened: ${(intake as any).description}`);
        if ((intake as any).role) lines.push(`- Patient role: ${(intake as any).role}`);
        const bp = (intake as any).bodyParts;
        if (Array.isArray(bp) && bp.length) lines.push(`- Injured areas: ${bp.join(", ")}`);
        if ((intake as any).painLevel != null) lines.push(`- Pain: ${(intake as any).painLevel}/10`);
        if ((intake as any).priorInjuries) lines.push(`- Prior injuries: ${(intake as any).priorInjuries}`);
        if ((intake as any).autoInsurer) lines.push(`- Auto insurer: ${(intake as any).autoInsurer}`);
      }
    }

    lines.push("\nCURRENT PI NOTE DRAFT (therapist entries so far):");
    for (const [k, label] of [
      ["mechanism", "Mechanism"],
      ["subjective", "Subjective"],
      ["objective", "Objective"],
      ["assessment", "Assessment"],
      ["plan", "Plan"],
      ["goals", "Goals"],
      ["causation", "Causation"],
    ] as const) {
      const val = draft[k];
      if (val) lines.push(`- ${label}: ${String(val).slice(0, 600)}`);
    }

    lines.push("\nTHERAPIST DICTATION FOR THIS VISIT:");
    lines.push(dictation || "(none — infer a reasonable focused PT visit from the draft and intake)");

    const context = lines.join("\n");

    const systemMessage = [
      "You are a documentation assistant for a licensed Physical Therapist at a Texas physical-rehabilitation / personal-injury clinic.",
      "You convert brief dictation and rough draft entries into a clean, well-organized PERSONAL INJURY physical-therapy encounter note. Write in professional clinical ENGLISH.",
      "Keep it specific, internally consistent and appropriate for a PIP / auto-injury (casualty) claim. Do NOT invent measurements, findings, or dates that were not provided; if something is not documented, write 'not documented' rather than fabricating specifics.",
      "This is a DRAFT for the therapist to review, edit and sign — you are not making final clinical decisions.",
      "Suggest appropriate PT CPT codes (e.g. 97110, 97112, 97140, 97530, 97164) supported by the documentation, and ICD-10 codes that justify medical necessity. Only include codes the documentation reasonably supports.",
      "The causation statement should relate the injuries to the reported accident when the intake/dictation supports it.",
      "Return ONLY a single valid JSON object (no prose, no markdown) with EXACTLY this shape:",
      `{
  "mechanism": "string (how the accident/injury occurred)",
  "subjective": "string (patient-reported symptoms, pain scale, functional limits)",
  "objective": "string (ROM, MMT, palpation, special tests, observations)",
  "assessment": "string (clinical impression / PT diagnosis)",
  "plan": "string (treatment plan, frequency, duration, modalities)",
  "goals": "string (short- and long-term functional goals)",
  "causation": "string (relationship of the injuries to the accident)",
  "cptCodes": ["string"],
  "icdCodes": ["string"]
}`,
      "If a field is not applicable, use an empty string or empty array.",
    ].join("\n");

    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const chat = createChat({
      apiKey,
      sessionId: `pt-note-${patientId || Math.random().toString(36).slice(2)}`,
      systemMessage,
      provider: (process.env.PORTAL_MODEL_PROVIDER as "openai" | "anthropic" | "gemini") || "openai",
      model: process.env.PORTAL_MODEL_ID || "gpt-4o",
      params: { temperature: 0.2, max_tokens: 1600 },
    });

    const raw = await chat.sendMessage(
      new UserMessage({ text: `PI ENCOUNTER CONTEXT:\n\n${context}\n\nGenerate the normalized PI note JSON now.` })
    );

    let parsed: any;
    try {
      parsed = extractJson(String(raw || ""));
    } catch (e) {
      console.error("AI PI note parse error:", e, "raw:", String(raw).slice(0, 500));
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    const asArr = (v: any) =>
      Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : [];

    return NextResponse.json({
      ok: true,
      note: {
        mechanism: String(parsed.mechanism || ""),
        subjective: String(parsed.subjective || ""),
        objective: String(parsed.objective || ""),
        assessment: String(parsed.assessment || ""),
        plan: String(parsed.plan || ""),
        goals: String(parsed.goals || ""),
        causation: String(parsed.causation || ""),
        cptCodes: asArr(parsed.cptCodes),
        icdCodes: asArr(parsed.icdCodes),
      },
    });
  } catch (err) {
    console.error("POST /api/pt/ai-note error", err);
    return NextResponse.json({ error: "Failed to generate PI note" }, { status: 500 });
  }
}
