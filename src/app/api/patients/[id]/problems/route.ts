import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const body = await req.json();
  if (!body.description) return NextResponse.json({ error: "description required" }, { status: 400 });
  const created = await db.problem.create({
    data: {
      patientId: id,
      icd10: body.icd10 || null,
      description: body.description,
      status: body.status || "active",
    },
  });
  return NextResponse.json({ ok: true, problem: created });
}
