import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Internal prior-authorization request tracker.
 *
 * IMPORTANT: This does NOT electronically submit a 278 authorization request to
 * the payer through Stedi (Stedi's integrated path does not expose self-service
 * 278 submission). Staff obtain the authorization through the payer portal/phone
 * and record the request + outcome here so it is linked to the patient chart.
 */

// GET /api/prior-auth?patientId=... -> list PA requests (optionally by patient)
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || undefined;
  const requests = await db.priorAuthRequest.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ requests });
}

// POST /api/prior-auth -> create or update a PA request
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (!b.id && !b.patientId) return NextResponse.json({ error: "patientId is required." }, { status: 400 });

  const data: Record<string, unknown> = {
    patientId: b.patientId ? String(b.patientId) : undefined,
    patientName: b.patientName ?? undefined,
    payerId: b.payerId ?? undefined,
    payerName: b.payerName ?? undefined,
    memberId: b.memberId ?? undefined,
    serviceType: b.serviceType ?? undefined,
    cptCodes: b.cptCodes ?? undefined,
    diagnosisCodes: b.diagnosisCodes ?? undefined,
    units: b.units != null && b.units !== "" ? Number(b.units) : undefined,
    startDate: b.startDate ? new Date(b.startDate) : undefined,
    endDate: b.endDate ? new Date(b.endDate) : undefined,
    status: b.status ?? undefined,
    authNumber: b.authNumber ?? undefined,
    notes: b.notes ?? undefined,
  };
  // strip undefined so update() doesn't overwrite with nulls
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  let request;
  if (b.id) {
    request = await db.priorAuthRequest.update({ where: { id: String(b.id) }, data });
  } else {
    request = await db.priorAuthRequest.create({
      data: {
        patientId: String(b.patientId),
        patientName: b.patientName ?? null,
        payerId: b.payerId ?? null,
        payerName: b.payerName ?? null,
        memberId: b.memberId ?? null,
        serviceType: b.serviceType ?? null,
        cptCodes: b.cptCodes ?? null,
        diagnosisCodes: b.diagnosisCodes ?? null,
        units: b.units != null && b.units !== "" ? Number(b.units) : null,
        startDate: b.startDate ? new Date(b.startDate) : null,
        endDate: b.endDate ? new Date(b.endDate) : null,
        status: b.status || "draft",
        authNumber: b.authNumber ?? null,
        notes: b.notes ?? null,
        createdById: user.id,
        createdByName: `${user.firstName} ${user.lastName}`,
      },
    });
  }
  return NextResponse.json({ ok: true, request });
}

// DELETE /api/prior-auth?id=...
export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.priorAuthRequest.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
