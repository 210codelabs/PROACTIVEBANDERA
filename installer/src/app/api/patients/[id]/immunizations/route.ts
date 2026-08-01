import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const body = await req.json();
  if (!body.vaccine) return NextResponse.json({ error: "vaccine required" }, { status: 400 });
  const givenAt = body.givenAt ? new Date(body.givenAt) : new Date();
  const created = await db.immunization.create({
    data: {
      patientId: id,
      vaccine: body.vaccine,
      cvxCode: body.cvxCode || null,
      givenAt,
      lot: body.lot || null,
      site: body.site || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ ok: true, immunization: created });
}
