import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pt/notes?patientId=&q=
// Lists Personal Injury / PT encounter notes (kept separate from clinical notes).
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId") || undefined;
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const notes = await db.ptNote.findMany({
    where: { ...(patientId ? { patientId } : {}) },
    orderBy: { visitDate: "desc" },
    take: 300,
  });

  const pids = [...new Set(notes.map((n) => n.patientId))];
  const patients = pids.length ? await db.patient.findMany({ where: { id: { in: pids } } }) : [];
  const pMap = new Map(patients.map((p) => [p.id, p]));

  let out = notes.map((n) => {
    const p: any = pMap.get(n.patientId);
    return {
      ...n,
      patientName: p ? `${p.lastName}, ${p.firstName}` : "Unknown",
      patientMrn: p?.mrn || "",
    };
  });

  if (q) {
    out = out.filter(
      (n) =>
        n.patientName.toLowerCase().includes(q) ||
        (n.patientMrn || "").toLowerCase().includes(q) ||
        (n.assessment || "").toLowerCase().includes(q) ||
        (n.subjective || "").toLowerCase().includes(q) ||
        (n.mechanism || "").toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ notes: out });
}

// POST /api/pt/notes  -> create a PI/PT note. Patient MUST be registered under
// Physical Rehabilitation / Personal Injury (patientType === "legal").
export async function POST(req: Request) {
  const user = await requireSession();
  const b = await req.json().catch(() => ({}));
  if (!b.patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  const patient = await db.patient.findUnique({ where: { id: b.patientId } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (patient.patientType !== "legal") {
    return NextResponse.json(
      { error: "This patient is not registered under Physical Rehabilitation / Personal Injury. Register them as a legal/PI patient first." },
      { status: 400 }
    );
  }

  const author = await db.user.findUnique({ where: { id: user.id } }).catch(() => null);

  const note = await db.ptNote.create({
    data: {
      patientId: b.patientId,
      legalCaseId: b.legalCaseId || null,
      authorId: user.id,
      authorName: `${author?.firstName || user.firstName} ${author?.lastName || user.lastName}`,
      authorNpi: author?.npi || null,
      authorCredential: author?.credential || user.credential || null,
      authorLicense: (author as any)?.licenseNo || null,
      visitDate: b.visitDate ? new Date(b.visitDate) : new Date(),
      dateOfInjury: b.dateOfInjury ? new Date(b.dateOfInjury) : null,
      mechanism: b.mechanism || null,
      subjective: b.subjective || null,
      objective: b.objective || null,
      assessment: b.assessment || null,
      plan: b.plan || null,
      goals: b.goals || null,
      causation: b.causation || null,
      cptCodes: Array.isArray(b.cptCodes) ? b.cptCodes : [],
      icdCodes: Array.isArray(b.icdCodes) ? b.icdCodes : [],
      status: "draft",
    },
  });

  return NextResponse.json({ ok: true, note });
}
