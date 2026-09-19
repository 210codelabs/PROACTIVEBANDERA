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
  race: z.string().optional(),
  ethnicity: z.string().optional(),
  maritalStatus: z.string().optional(),
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
  // preferred pharmacy (e-prescribing)
  primaryPharmacyNcpdp: z.string().optional(),
  alternativePharmacyNcpdp: z.string().optional(),
  // registration type
  patientType: z.enum(["clinical", "legal"]).optional(),
  // legal case (only when patientType === "legal")
  attorneyId: z.string().optional(),
  caseNumber: z.string().optional(),
  caseType: z.string().optional(),
  court: z.string().optional(),
  dateOfInjury: z.string().optional(),
  lawFirm: z.string().optional(),
  claimNumber: z.string().optional(),
  adjuster: z.string().optional(),
  defendantInsurer: z.string().optional(),
  pipInsurerName: z.string().optional(),
  pipInsurerPayerId: z.string().optional(),
  pipPolicyNumber: z.string().optional(),
  pipClaimNumber: z.string().optional(),
  pipMedLimit: z.string().optional(),
  pipInsuredName: z.string().optional(),
  pipRelation: z.string().optional(),
});

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

export async function POST(req: Request) {
  const user = await requireSession();
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const {
    dob,
    patientType = "clinical",
    attorneyId, caseNumber, caseType, court, dateOfInjury, lawFirm, claimNumber, adjuster, defendantInsurer,
    pipInsurerName, pipInsurerPayerId, pipPolicyNumber, pipClaimNumber, pipMedLimit, pipInsuredName, pipRelation,
    ...rest
  } = parsed.data;

  const patient = await db.patient.create({
    data: {
      ...rest,
      dob: new Date(dob),
      mrn: nextMrn(),
      patientType,
    },
  });

  let legalCase = null;
  if (patientType === "legal") {
    legalCase = await db.legalCase.create({
      data: {
        patientId: patient.id,
        attorneyId: attorneyId || null,
        caseNumber: caseNumber || null,
        caseType: caseType || "personal_injury",
        court: court || null,
        dateOfInjury: dateOfInjury ? new Date(dateOfInjury) : null,
        lawFirm: lawFirm || null,
        claimNumber: claimNumber || null,
        adjuster: adjuster || null,
        defendantInsurer: defendantInsurer || null,
        pipInsurerName: pipInsurerName || null,
        pipInsurerPayerId: pipInsurerPayerId || null,
        pipPolicyNumber: pipPolicyNumber || null,
        pipClaimNumber: pipClaimNumber || null,
        pipMedLimit: pipMedLimit || null,
        pipInsuredName: pipInsuredName || null,
        pipRelation: pipRelation || null,
      },
    });
  }

  await db.auditLog.create({ data: { userId: user.id, action: "create", resource: "Patient", resourceId: patient.id } });
  return NextResponse.json({ ok: true, patient, legalCase });
}
