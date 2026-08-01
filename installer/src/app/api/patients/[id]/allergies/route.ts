import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const body = await req.json();
  if (!body.substance) return NextResponse.json({ error: "substance required" }, { status: 400 });
  const created = await db.allergy.create({
    data: {
      patientId: id,
      substance: body.substance,
      reaction: body.reaction || null,
      severity: body.severity || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ ok: true, allergy: created });
}
