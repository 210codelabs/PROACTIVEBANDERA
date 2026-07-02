import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  sex: z.string().min(1),
  pronouns: z.string().optional(),
  preferredLang: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  insurerName: z.string().optional(),
  insurerPlan: z.string().optional(),
  memberId: z.string().optional(),
  groupNumber: z.string().optional(),
});

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `AC-${n}`;
}

export async function POST(req: Request) {
  const user = await requireSession();
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { dob, ...rest } = parsed.data;
  const patient = await db.patient.create({
    data: {
      ...rest,
      dob: new Date(dob),
      mrn: nextMrn(),
    },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "create", resource: "Patient", resourceId: patient.id } });
  return NextResponse.json({ ok: true, patient });
}
