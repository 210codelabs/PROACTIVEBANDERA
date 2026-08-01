import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site/config";
import { createChat, UserMessage, validateApiKey } from "emergentintegrations";

export const runtime = "nodejs";

function ageFrom(dob: Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)));
}
function d(x?: Date | null): string {
  return x ? new Date(x).toISOString().slice(0, 10) : "";
}

async function buildChart(patientId: string): Promise<string> {
  const p = await db.patient.findUnique({ where: { id: patientId } });
  if (!p) return "";
  const [allergies, problems, meds, vitals, immun, encounters] = await Promise.all([
    db.allergy.findMany({ where: { patientId, status: "active" }, take: 30 }),
    db.problem.findMany({ where: { patientId, status: { in: ["active", "chronic"] } }, take: 40 }),
    db.medication.findMany({ where: { patientId, status: "active" }, take: 40 }),
    db.vital.findMany({ where: { patientId }, orderBy: { takenAt: "desc" }, take: 5 }),
    db.immunization.findMany({ where: { patientId }, orderBy: { givenAt: "desc" }, take: 15 }),
    db.encounter.findMany({ where: { patientId }, orderBy: { startedAt: "desc" }, take: 6, include: { diagnoses: true } }),
  ]);
  const L: string[] = [];
  L.push(`PATIENT: ${p.firstName} ${p.lastName} — ${p.sex}, age ${ageFrom(p.dob)} (DOB ${d(p.dob)}), MRN ${p.mrn}`);
  L.push(`Insurer: ${p.insurerName || "N/A"} ${p.insurerPlan || ""}. Preferred language: ${p.preferredLang || "English"}.`);
  L.push("\nALLERGIES: " + (allergies.length ? allergies.map((a) => `${a.substance}${a.reaction ? `→${a.reaction}` : ""}${a.severity ? ` (${a.severity})` : ""}`).join("; ") : "No known allergies."));
  L.push("ACTIVE/CHRONIC PROBLEMS: " + (problems.length ? problems.map((x) => `${x.icd10 ? `[${x.icd10}] ` : ""}${x.description} (${x.status})`).join("; ") : "None."));
  L.push("CURRENT MEDICATIONS: " + (meds.length ? meds.map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}${m.sig ? ` — ${m.sig}` : ""}`).join("; ") : "None."));
  L.push("RECENT VITALS: " + (vitals.length ? vitals.map((v) => `${d(v.takenAt)}: BP ${v.systolic ?? "?"}/${v.diastolic ?? "?"}, HR ${v.pulse ?? "?"}, Temp ${v.temperatureC ?? "?"}C, SpO2 ${v.spo2 ?? "?"}%, BMI ${v.bmi ?? "?"}`).join(" | ") : "None."));
  L.push("IMMUNIZATIONS: " + (immun.length ? immun.map((i) => `${i.vaccine} (${d(i.givenAt)})`).join("; ") : "None."));
  L.push("\nRECENT ENCOUNTERS (most recent first):");
  if (encounters.length) {
    for (const e of encounters) {
      const dx = e.diagnoses.map((x) => `${x.icd10}${x.primary ? "*" : ""}`).join(", ");
      L.push(`- ${d(e.startedAt)} [${e.status}]${e.chiefComplaint ? ` CC: ${e.chiefComplaint}` : ""}${dx ? ` Dx: ${dx}` : ""}`);
      if (e.assessment) L.push(`    A: ${e.assessment.slice(0, 250)}`);
      if (e.plan) L.push(`    P: ${e.plan.slice(0, 250)}`);
    }
  } else {
    L.push("- None.");
  }
  return L.join("\n");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const chart = await buildChart(id);
    if (!chart) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const site = await getSiteConfig();
    const systemMessage = [
      `You are the Clinical AI Assistant for ${site.identity.clinicName}${site.identity.city ? ` (${site.identity.city}, ${site.identity.state})` : ""}, used by AUTHORIZED CLINICAL STAFF (not the patient).`,
      "You have access to THIS patient's chart (provided below). Help staff by summarizing history, explaining findings, drafting notes/plans/patient instructions, listing differential considerations, flagging drug interactions or allergy conflicts, and answering questions grounded in the chart.",
      "Be concise, clinically sound, and specific. Reply in the same language the staff member uses (English or Spanish).",
      "You are a DECISION-SUPPORT tool: the licensed provider makes all final medical decisions. Never fabricate data — if something is not in the chart, say it is not documented. Always respect the patient's listed allergies.",
      "Do not reveal information about other patients.",
      "\n=== PATIENT CHART ===\n" + chart,
    ].join("\n");

    const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);
    const chat = createChat({
      apiKey,
      sessionId: `chart-${id}`,
      systemMessage,
      provider: (process.env.PORTAL_MODEL_PROVIDER as "openai" | "anthropic" | "gemini") || "openai",
      model: process.env.PORTAL_MODEL_ID || "gpt-4o",
      params: { temperature: 0.3, max_tokens: 700 },
    });
    const reply = await chat.sendMessage(new UserMessage({ text: message }));
    const text = String(reply || "").trim();
    if (!text) return NextResponse.json({ error: "Empty reply" }, { status: 502 });
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("POST /api/patients/[id]/assistant error", err);
    return NextResponse.json({ error: "Assistant is unavailable right now. Please try again." }, { status: 500 });
  }
}
