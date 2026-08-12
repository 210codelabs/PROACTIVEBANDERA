import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, checkEligibility, extractAuthRequired, StediError } from "@/lib/stedi";

/**
 * Determine whether a payer requires prior authorization for a service, using
 * the 270/271 eligibility response (benefitsInformation[].authOrCertIndicator).
 *
 * Stedi has NO 278 prior-authorization REST endpoint, so we cannot submit a 278
 * electronically. This endpoint only DETECTS the requirement so staff know when
 * to obtain the auth via the payer portal/phone and record it here.
 *
 * body: { id?, patientId?, payerId?, memberId?, firstName?, lastName?, dateOfBirth?, serviceTypeCodes? }
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: "Stedi is not configured." }, { status: 400 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Load PA record if an id is provided, to hydrate + persist the result.
  let pa = b.id ? await db.priorAuthRequest.findUnique({ where: { id: String(b.id) } }).catch(() => null) : null;

  let patientId = b.patientId || pa?.patientId || null;
  let firstName = b.firstName;
  let lastName = b.lastName;
  let dateOfBirth = b.dateOfBirth;
  let memberId = b.memberId || pa?.memberId || undefined;
  let payerId = (b.payerId || pa?.payerId || cfg.defaultPayerId || "").trim();

  if (patientId) {
    const p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
    if (p) {
      firstName = firstName || p.firstName;
      lastName = lastName || p.lastName;
      dateOfBirth = dateOfBirth || p.dob;
      memberId = memberId || (p as any).memberId || undefined;
      payerId = payerId || (p as any).payerId || "";
    }
  }

  if (!payerId) return NextResponse.json({ error: "No payer ID available for this authorization." }, { status: 400 });
  if (!firstName || !lastName) return NextResponse.json({ error: "Member first and last name are required." }, { status: 400 });

  const serviceTypeCodes = Array.isArray(b.serviceTypeCodes) && b.serviceTypeCodes.length ? b.serviceTypeCodes : undefined;

  try {
    const result = await checkEligibility({ payerId, memberId, firstName, lastName, dateOfBirth, serviceTypeCodes });
    const auth = extractAuthRequired(result.raw);
    if (pa) {
      pa = await db.priorAuthRequest.update({
        where: { id: pa.id },
        data: {
          authRequired: auth.required,
          authRequiredRaw: { detail: auth.detail, checkedAt: new Date().toISOString(), payerName: result.payerName } as object,
          lastCheckedAt: new Date(),
        },
      });
    }
    return NextResponse.json({ ok: true, auth, request: pa, payerName: result.payerName });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Auth check failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
