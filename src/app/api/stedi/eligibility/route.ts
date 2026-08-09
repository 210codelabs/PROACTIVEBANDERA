import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEligibility, getStediConfig, StediError } from "@/lib/stedi";

// GET /api/stedi/eligibility?patientId=... -> recent eligibility checks
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || undefined;
  const checks = await db.eligibilityCheck.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return NextResponse.json({ checks });
}

// PATCH /api/stedi/eligibility -> attach a check saved during registration
// (patientId was null at check time) to the newly created patient.
export async function PATCH(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.checkId || !b?.patientId) {
    return NextResponse.json({ error: "checkId and patientId are required." }, { status: 400 });
  }
  const p = await db.patient.findUnique({ where: { id: String(b.patientId) } }).catch(() => null);
  const check = await db.eligibilityCheck
    .update({
      where: { id: String(b.checkId) },
      data: {
        patientId: String(b.patientId),
        patientName: p ? `${p.lastName}, ${p.firstName}` : undefined,
      },
    })
    .catch(() => null);
  if (!check) return NextResponse.json({ error: "Check not found." }, { status: 404 });
  return NextResponse.json({ ok: true, check });
}

// POST /api/stedi/eligibility -> run a real-time 270/271 check and save it
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return NextResponse.json(
      { error: "Stedi is not configured. Add your API key in Settings → External Integrations." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let {
    patientId,
    payerId,
    payerName,
    memberId,
    firstName,
    lastName,
    dateOfBirth,
    dateOfService,
  } = body as Record<string, any>;

  // Hydrate from the patient record when a patientId is provided.
  let patientName: string | undefined;
  if (patientId) {
    const p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
    if (p) {
      patientName = `${p.lastName}, ${p.firstName}`;
      firstName = firstName || p.firstName;
      lastName = lastName || p.lastName;
      dateOfBirth = dateOfBirth || p.dob;
      memberId = memberId || (p as any).memberId || undefined;
      payerName = payerName || (p as any).insurerName || undefined;
    }
  }

  payerId = (payerId || cfg.defaultPayerId || "").trim();
  if (!payerId) return NextResponse.json({ error: "A payer ID is required." }, { status: 400 });
  if (!lastName || !firstName) return NextResponse.json({ error: "Member first and last name are required." }, { status: 400 });

  try {
    const result = await checkEligibility({ payerId, memberId, firstName, lastName, dateOfBirth, dateOfService });
    const check = await db.eligibilityCheck.create({
      data: {
        patientId: patientId || null,
        patientName: patientName || `${lastName}, ${firstName}`,
        payerId,
        payerName: result.payerName || payerName || null,
        memberId: memberId || null,
        status: result.status,
        planName: result.planName || null,
        summary: result.summary as object,
        raw: result.raw as object,
        checkedById: user.id,
        checkedByName: `${user.firstName} ${user.lastName}`,
      },
    });
    return NextResponse.json({ ok: true, check });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    const message =
      status === 401 || status === 403
        ? "Stedi rejected the request (check your API key / payer enrollment)."
        : `Eligibility check failed: ${String(e?.message || e).slice(0, 300)}`;
    // Persist the failed attempt for audit/history.
    await db.eligibilityCheck
      .create({
        data: {
          patientId: patientId || null,
          patientName: patientName || `${lastName || ""}, ${firstName || ""}`,
          payerId,
          payerName: payerName || null,
          memberId: memberId || null,
          status: "error",
          summary: [{ label: "Error", value: message }] as object,
          raw: (e instanceof StediError ? e.body : String(e)) as object,
          checkedById: user.id,
          checkedByName: `${user.firstName} ${user.lastName}`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
