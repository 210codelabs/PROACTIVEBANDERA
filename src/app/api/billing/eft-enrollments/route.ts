import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Per-payer EFT / ERA / claims enrollment tracking.
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const payerId = new URL(req.url).searchParams.get("payerId") || undefined;
  const enrollments = await db.payerEftEnrollment.findMany({
    where: payerId ? { payerId } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
  }).catch(() => []);
  return NextResponse.json({ enrollments });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id && !b.payerName) return NextResponse.json({ error: "Payer name is required." }, { status: 400 });

  const data: any = {
    payerId: b.payerId ?? undefined,
    payerName: b.payerName ?? undefined,
    enrollmentType: b.enrollmentType || undefined,
    bankAccountId: b.bankAccountId ?? undefined,
    status: b.status || undefined,
    effectiveDate: b.effectiveDate ? new Date(b.effectiveDate) : undefined,
    traceNumber: b.traceNumber ?? undefined,
    contactEmail: b.contactEmail ?? undefined,
    contactPhone: b.contactPhone ?? undefined,
    notes: b.notes ?? undefined,
  };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  let enrollment;
  if (b.id) enrollment = await db.payerEftEnrollment.update({ where: { id: String(b.id) }, data });
  else enrollment = await db.payerEftEnrollment.create({
    data: {
      payerId: b.payerId ?? null,
      payerName: String(b.payerName),
      enrollmentType: b.enrollmentType || "eft",
      bankAccountId: b.bankAccountId ?? null,
      status: b.status || "not_started",
      effectiveDate: b.effectiveDate ? new Date(b.effectiveDate) : null,
      traceNumber: b.traceNumber ?? null,
      contactEmail: b.contactEmail ?? null,
      contactPhone: b.contactPhone ?? null,
      notes: b.notes ?? null,
      createdById: user.id,
      createdByName: `${user.firstName} ${user.lastName}`,
    },
  });
  return NextResponse.json({ ok: true, enrollment });
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.payerEftEnrollment.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
