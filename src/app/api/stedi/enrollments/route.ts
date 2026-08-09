import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, createStediProvider, createStediEnrollment, StediError } from "@/lib/stedi";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const enrollments = await db.stediEnrollment.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ enrollments });
}

// POST create a provider (if needed) + enrollment for one payer.
// body: { payerIdOrAlias, payerName?, transactions:{eligibility?,claims?,claimPayment?}, submit?:boolean }
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: "Stedi is not configured." }, { status: 400 });
  if (!cfg.billingNpi || !cfg.taxId || !cfg.orgName) return NextResponse.json({ error: "Set Billing NPI, Tax ID and Org name in Settings first." }, { status: 400 });

  const b = await req.json().catch(() => null);
  if (!b || !b.payerIdOrAlias) return NextResponse.json({ error: "payerIdOrAlias is required." }, { status: 400 });

  const tx = b.transactions || {};
  const transactions: Record<string, { enroll: boolean }> = {};
  if (tx.eligibility) transactions.eligibility = { enroll: true };
  if (tx.claims) transactions.claims = { enroll: true };
  if (tx.claimPayment) transactions.claimPayment = { enroll: true };
  if (Object.keys(transactions).length === 0) transactions.claimPayment = { enroll: true };

  try {
    const provider = await createStediProvider({
      name: cfg.orgName, npi: cfg.billingNpi, taxId: cfg.taxId, taxIdType: cfg.taxIdType,
      contact: {
        email: cfg.enrollmentContact.email, phone: cfg.enrollmentContact.phone,
        streetAddress1: cfg.address.streetAddress1, city: cfg.address.city, state: cfg.address.state, zipCode: cfg.address.zipCode,
      },
    });
    const primaryContact = cfg.enrollmentContact.email
      ? { firstName: "Revenue", lastName: "Cycle", email: cfg.enrollmentContact.email, phone: cfg.enrollmentContact.phone, streetAddress1: cfg.address.streetAddress1, city: cfg.address.city, state: cfg.address.state, zipCode: cfg.address.zipCode }
      : undefined;
    const enrollment = await createStediEnrollment({
      payerIdOrAlias: String(b.payerIdOrAlias), providerId: provider.id,
      transactions, aggregationTaxId: cfg.taxId,
      status: b.submit ? "STEDI_ACTION_REQUIRED" : "DRAFT",
      userEmail: cfg.enrollmentContact.email || undefined,
      primaryContact,
    });
    const rec = await db.stediEnrollment.create({
      data: {
        stediProviderId: provider.id, stediEnrollmentId: enrollment.id || enrollment.enrollmentId || null,
        providerName: cfg.orgName, npi: cfg.billingNpi, taxId: cfg.taxId,
        payerId: String(b.payerIdOrAlias), payerName: b.payerName || null,
        transactions: transactions as object, status: enrollment.status || (b.submit ? "STEDI_ACTION_REQUIRED" : "DRAFT"),
        raw: enrollment as object, createdById: user.id,
      },
    });
    return NextResponse.json({ ok: true, enrollment: rec });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Enrollment failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
