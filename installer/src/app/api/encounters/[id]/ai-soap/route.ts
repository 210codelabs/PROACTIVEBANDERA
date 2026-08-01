import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createChat, UserMessage, validateApiKey } from "emergentintegrations";

export const runtime = "nodejs";

function ageFrom(dob: Date): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function fmtDate(d?: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const instructions: string = String(body?.instructions || "").trim();
    const draft = body?.draft || {};

    const encounter = await db.encounter.findUnique({
      where: { id },
      include: { patient: true, diagnoses: true },
    });
    if (!encounter) return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    if (encounter.status === "signed") {
      return NextResponse.json({ error: "This encounter is signed and locked." }, { status: 400 });
    }

    const patientId = encounter.patientId;
    const p = encounter.patient;

    // Pull the chart in parallel.
    const [allergies, problems, meds, vitals, immunizations, pastEncounters] = await Promise.all([
      db.allergy.findMany({ where: { patientId, status: "active" }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.problem.findMany({ where: { patientId, status: { in: ["active", "chronic"] } }, orderBy: { createdAt: "desc" }, take: 40 }),
      db.medication.findMany({ where: { patientId, status: "active" }, orderBy: { createdAt: "desc" }, take: 40 }),
      db.vital.findMany({ where: { patientId }, orderBy: { takenAt: "desc" }, take: 5 }),
      db.immunization.findMany({ where: { patientId }, orderBy: { givenAt: "desc" }, take: 15 }),
      db.encounter.findMany({
        where: { patientId, id: { not: id } },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { diagnoses: true },
      }),
    ]);

    const lines: string[] = [];
    lines.push(`PATIENT: ${p.firstName} ${p.lastName} — ${p.sex}, age ${ageFrom(p.dob)} (DOB ${fmtDate(p.dob)})`);
    lines.push(`Preferred language: ${p.preferredLang || "English"}. Insurer: ${p.insurerName || "N/A"} ${p.insurerPlan || ""}`.trim());

    lines.push("\nALLERGIES (active):");
    lines.push(allergies.length ? allergies.map((a) => `- ${a.substance}${a.reaction ? ` → ${a.reaction}` : ""}${a.severity ? ` (${a.severity})` : ""}`).join("\n") : "- No known allergies on file.");

    lines.push("\nACTIVE / CHRONIC PROBLEMS:");
    lines.push(problems.length ? problems.map((pr) => `- ${pr.icd10 ? `[${pr.icd10}] ` : ""}${pr.description} (${pr.status})`).join("\n") : "- None on file.");

    lines.push("\nCURRENT MEDICATIONS:");
    lines.push(meds.length ? meds.map((m) => `- ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.form ? ` ${m.form}` : ""}${m.sig ? ` — ${m.sig}` : ""}${m.frequency ? ` (${m.frequency})` : ""}`).join("\n") : "- None on file.");

    lines.push("\nRECENT VITALS (most recent first):");
    lines.push(vitals.length ? vitals.map((v) => `- ${fmtDate(v.takenAt)}: BP ${v.systolic ?? "?"}/${v.diastolic ?? "?"}, HR ${v.pulse ?? "?"}, Temp ${v.temperatureC ?? "?"}°C, SpO2 ${v.spo2 ?? "?"}%, RR ${v.respRate ?? "?"}, Wt ${v.weightKg ?? "?"}kg, Ht ${v.heightCm ?? "?"}cm, BMI ${v.bmi ?? "?"}, Pain ${v.painScore ?? "?"}/10`).join("\n") : "- None recorded.");

    lines.push("\nIMMUNIZATIONS:");
    lines.push(immunizations.length ? immunizations.map((im) => `- ${fmtDate(im.givenAt)}: ${im.vaccine}${im.cvxCode ? ` (CVX ${im.cvxCode})` : ""}`).join("\n") : "- None on file.");

    lines.push("\nPRIOR ENCOUNTERS (chronological, most recent first):");
    if (pastEncounters.length) {
      for (const e of pastEncounters) {
        const dx = e.diagnoses.map((d) => `${d.icd10}${d.primary ? "*" : ""}`).join(", ");
        lines.push(`- ${fmtDate(e.startedAt)} [${e.status}] ${e.visitType || ""}${e.chiefComplaint ? ` — CC: ${e.chiefComplaint}` : ""}${dx ? ` — Dx: ${dx}` : ""}`);
        if (e.assessment) lines.push(`    A: ${e.assessment.slice(0, 300)}`);
        if (e.plan) lines.push(`    P: ${e.plan.slice(0, 300)}`);
      }
    } else {
      lines.push("- No prior encounters.");
    }

    lines.push("\nCURRENT ENCOUNTER DRAFT (provider entries so far):");
    lines.push(`- Chief complaint: ${draft.chiefComplaint || encounter.chiefComplaint || "(none)"}`);
    for (const [k, label] of [["subjective", "S"], ["ros", "ROS"], ["objective", "O"], ["examFindings", "Exam"], ["assessment", "A"], ["plan", "P"]] as const) {
      const val = draft[k] || (encounter as any)[k];
      if (val) lines.push(`- ${label}: ${String(val).slice(0, 500)}`);
    }

    lines.push("\nPROVIDER'S BRIEF INPUT / DICTATION FOR THIS VISIT:");
    lines.push(instructions || "(none provided — infer a reasonable focused visit from the chart and chief complaint)");

    const chart = lines.join("\n");

    const systemMessage = [
      "You are a clinical documentation assistant for Proactive Clinic (San Antonio, TX). You help a licensed provider draft a COMPLIANT SOAP note for the current visit using the patient's chart and the provider's brief input.",
      "Write the clinical note in ENGLISH (required for the superbill and insurers), regardless of the patient's preferred language.",
      "Be clinically sound, specific, and concise. Use the chart data (problems, medications, allergies, vitals, prior visits) and keep everything internally consistent and in logical/chronological order.",
      "SAFETY: Respect the patient's allergies (never suggest a medication that conflicts with a listed allergy; flag interactions). You produce a DRAFT for the provider to review, edit, and sign — you are not making final medical decisions.",
      "For billing: suggest the most appropriate E/M CPT code (e.g., 99202-99205 new, 99211-99215 established) plus any procedure/lab CPT/HCPCS codes supported by the documentation. Provide ICD-10 diagnoses that justify medical necessity, marking exactly one as primary.",
      "FEES: We do NOT have a licensed fee schedule. Provide ESTIMATED US cash-pay fee ranges (whole US dollars) as feeMin, feeSuggested, feeMax for each code. These are estimates the provider MUST verify — never present them as official rates.",
      "Return ONLY a single valid JSON object (no prose, no markdown) with EXACTLY this shape:",
      `{
  "chiefComplaint": "string",
  "subjective": "string (HPI: onset, location, duration, character, aggravating/relieving, timing, severity, associated symptoms)",
  "ros": "string (pertinent positives/negatives by system)",
  "objective": "string (vitals summary + relevant findings)",
  "examFindings": "string (focused physical exam)",
  "assessment": "string (clinical reasoning + problem list for this visit)",
  "plan": "string (per-problem plan: tests, treatments, referrals, patient education, follow-up)",
  "diagnoses": [{"icd10":"string","description":"string","primary":true}],
  "prescriptions": [{"name":"string","strength":"string","form":"string","route":"string","frequency":"string","sig":"string","notes":"string"}],
  "charges": [{"cpt":"string","description":"string","emLevel":"string or empty","feeMin":0,"feeSuggested":0,"feeMax":0,"rationale":"short justification"}],
  "safetyNotes": "string (allergy/interaction cautions or missing info the provider should confirm)"
}`,
      "If a field is not applicable, use an empty string or empty array. Do not invent vitals or exam findings that contradict the chart; if not documented, state 'not documented' rather than fabricating specific numbers.",
    ].join("\n");

    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const chat = createChat({
      apiKey,
      sessionId: `soap-${id}`,
      systemMessage,
      provider: (process.env.PORTAL_MODEL_PROVIDER as "openai" | "anthropic" | "gemini") || "openai",
      model: process.env.PORTAL_MODEL_ID || "gpt-4o",
      params: { temperature: 0.2, max_tokens: 1800 },
    });

    const raw = await chat.sendMessage(new UserMessage({ text: `PATIENT CHART & VISIT CONTEXT:\n\n${chart}\n\nGenerate the SOAP note JSON now.` }));
    let parsed: any;
    try {
      parsed = extractJson(String(raw || ""));
    } catch (e) {
      console.error("AI SOAP parse error:", e, "raw:", String(raw).slice(0, 500));
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 });
    }

    // Normalize charges to include cents for the editor.
    const charges = Array.isArray(parsed.charges) ? parsed.charges.map((c: any) => ({
      cpt: String(c.cpt || "").trim(),
      description: String(c.description || "").trim(),
      emLevel: String(c.emLevel || "").trim(),
      rationale: String(c.rationale || "").trim(),
      feeMinCents: Math.round(Number(c.feeMin || 0) * 100),
      feeSuggestedCents: Math.round(Number(c.feeSuggested || c.feeMin || 0) * 100),
      feeMaxCents: Math.round(Number(c.feeMax || c.feeSuggested || 0) * 100),
    })).filter((c: any) => c.cpt) : [];

    const diagnoses = Array.isArray(parsed.diagnoses) ? parsed.diagnoses.map((d: any) => ({
      icd10: String(d.icd10 || "").trim(),
      description: String(d.description || "").trim(),
      primary: !!d.primary,
    })).filter((d: any) => d.icd10 || d.description) : [];

    const prescriptions = Array.isArray(parsed.prescriptions) ? parsed.prescriptions.map((m: any) => ({
      name: String(m.name || "").trim(),
      strength: String(m.strength || "").trim(),
      form: String(m.form || "").trim(),
      route: String(m.route || "").trim(),
      frequency: String(m.frequency || "").trim(),
      sig: String(m.sig || "").trim(),
      notes: String(m.notes || "").trim(),
    })).filter((m: any) => m.name) : [];

    return NextResponse.json({
      ok: true,
      soap: {
        chiefComplaint: String(parsed.chiefComplaint || ""),
        subjective: String(parsed.subjective || ""),
        ros: String(parsed.ros || ""),
        objective: String(parsed.objective || ""),
        examFindings: String(parsed.examFindings || ""),
        assessment: String(parsed.assessment || ""),
        plan: String(parsed.plan || ""),
      },
      diagnoses,
      prescriptions,
      charges,
      safetyNotes: String(parsed.safetyNotes || ""),
    });
  } catch (err) {
    console.error("POST /api/encounters/[id]/ai-soap error", err);
    return NextResponse.json({ error: "Failed to generate SOAP note" }, { status: 500 });
  }
}
