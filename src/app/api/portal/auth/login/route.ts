import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setPortalSessionCookie } from "@/lib/portalAuth";

const Body = z.object({
  mrn: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function sameDateOnly(left: Date, yyyymmdd: string): boolean {
  const normalized = new Date(`${yyyymmdd}T00:00:00.000Z`);
  return left.toISOString().slice(0, 10) === normalized.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let patient: Awaited<ReturnType<typeof db.patient.findUnique>> = null;
  try {
    patient = await db.patient.findUnique({ where: { mrn: parse.data.mrn.trim() } });
  } catch {
    return NextResponse.json({ error: "Portal is temporarily unavailable" }, { status: 503 });
  }
  if (!patient || !sameDateOnly(patient.dob, parse.data.dob)) {
    return NextResponse.json({ error: "Invalid MRN or DOB" }, { status: 401 });
  }

  await setPortalSessionCookie({
    patientId: patient.id,
    mrn: patient.mrn,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
  });

  return NextResponse.json({ ok: true });
}
