import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

function splitList(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(none|n\/a|na|no|no known allergies|nka|nkda|no known drug allergies|none known|no medications|no known medications)$/i.test(s));
}

// Copy approved intake answers into the patient's Problems / Allergies / Medications.
async function attachToChart(patientId: string, values: Record<string, any>) {
  const summary = { problems: 0, allergies: 0, medications: 0 };

  const [existingProblems, existingAllergies, existingMeds] = await Promise.all([
    db.problem.findMany({ where: { patientId }, select: { description: true } }),
    db.allergy.findMany({ where: { patientId }, select: { substance: true } }),
    db.medication.findMany({ where: { patientId }, select: { name: true } }),
  ]);
  const hasP = new Set(existingProblems.map((p) => p.description.toLowerCase()));
  const hasA = new Set(existingAllergies.map((a) => a.substance.toLowerCase()));
  const hasM = new Set(existingMeds.map((m) => m.name.toLowerCase()));

  const problems = [...splitList(values.conditions), ...splitList(values.otherConditions)];
  for (const desc of problems) {
    if (hasP.has(desc.toLowerCase())) continue;
    hasP.add(desc.toLowerCase());
    await db.problem.create({ data: { patientId, description: desc, status: "active", notes: "Added from approved patient intake." } });
    summary.problems++;
  }

  for (const substance of splitList(values.allergies)) {
    if (hasA.has(substance.toLowerCase())) continue;
    hasA.add(substance.toLowerCase());
    await db.allergy.create({ data: { patientId, substance, status: "active", notes: "Reported on patient intake." } });
    summary.allergies++;
  }

  for (const name of splitList(values.currentMedications)) {
    if (hasM.has(name.toLowerCase())) continue;
    hasM.add(name.toLowerCase());
    await db.medication.create({ data: { patientId, name, status: "active", notes: "Reported on patient intake." } });
    summary.medications++;
  }

  return summary;
}

// Staff: approve or reopen an intake submission (status stored in the doc body).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "approve" && action !== "reopen") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = parse(doc.body);
  let attached: { problems: number; allergies: number; medications: number } | null = null;

  if (action === "approve") {
    b.reviewStatus = "approved";
    b.reviewedByName = `${user.firstName} ${user.lastName}`;
    b.reviewedAt = new Date().toISOString();
    if (typeof body.note === "string" && body.note.trim()) b.reviewNote = body.note.trim();
    // Auto-attach answers to chart once (online submissions only).
    if (b.source === "online-intake" && b.values && !b.attachedToChart) {
      try {
        attached = await attachToChart(doc.patientId, b.values);
        b.attachedToChart = true;
        b.attachedSummary = attached;
      } catch (e) {
        console.error("attachToChart failed", e);
      }
    }
  } else {
    b.reviewStatus = "pending";
    b.reviewedByName = "";
    b.reviewedAt = "";
  }
  await db.document.update({ where: { id }, data: { body: JSON.stringify(b) } });
  return NextResponse.json({ ok: true, reviewStatus: b.reviewStatus, attached });
}
