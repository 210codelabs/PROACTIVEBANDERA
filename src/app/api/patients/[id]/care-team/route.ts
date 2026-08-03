import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["Referring", "PCP", "Specialist", "Consultant", "Other"];

// GET (STAFF): list care-team members for a patient.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const members = await db.careTeamMember.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ members });
}

// POST (STAFF): attach a (verified) provider to the patient's care team.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Provider name is required." }, { status: 400 });

  const patient = await db.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const role = ROLES.includes(String(b.role)) ? String(b.role) : "Referring";
  const npi = String(b.npi || "").replace(/\D/g, "") || null;

  // Avoid duplicate NPI on the same patient.
  if (npi) {
    const dup = await db.careTeamMember.findFirst({ where: { patientId: id, npi } });
    if (dup) return NextResponse.json({ error: "That provider is already on this patient's care team." }, { status: 409 });
  }

  const member = await db.careTeamMember.create({
    data: {
      patientId: id,
      npi,
      name,
      credential: String(b.credential || "") || null,
      specialty: String(b.specialty || "") || null,
      role,
      phone: String(b.phone || "") || null,
      address: String(b.address || "") || null,
      source: String(b.source || "nppes"),
      addedById: s.id,
    },
  });
  return NextResponse.json({ ok: true, member });
}

// DELETE (STAFF): remove a member. ?memberId=
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const memberId = new URL(req.url).searchParams.get("memberId") || "";
  if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  try {
    await db.careTeamMember.delete({ where: { id: memberId } });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
