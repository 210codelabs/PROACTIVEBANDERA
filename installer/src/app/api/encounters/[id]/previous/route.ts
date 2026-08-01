import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const currentEncounter = await db.encounter.findUnique({
    where: { id },
    select: { patientId: true, startedAt: true }
  });

  if (!currentEncounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  const previousEncounter = await db.encounter.findFirst({
    where: {
      patientId: currentEncounter.patientId,
      startedAt: { lt: currentEncounter.startedAt },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!previousEncounter) {
    return NextResponse.json({ error: "No previous encounter found" }, { status: 404 });
  }

  return NextResponse.json(previousEncounter);
}
