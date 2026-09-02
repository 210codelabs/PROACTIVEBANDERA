import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { encryptSecret, hasSecret } from "@/lib/credentialing/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicProvider(p: any) {
  const { portalPasswordEnc, ...rest } = p;
  return { ...rest, hasPortalPassword: hasSecret(portalPasswordEnc) };
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const providers = await db.credentialingProvider.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ providers: providers.map(publicProvider) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const npi = String(b.npi || "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(npi)) return NextResponse.json({ error: "A valid 10-digit NPI is required." }, { status: 400 });
  if (!b.firstName || !b.lastName) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  const exists = await db.credentialingProvider.findUnique({ where: { npi } }).catch(() => null);
  if (exists) return NextResponse.json({ error: "A provider with this NPI already exists." }, { status: 409 });
  const p = await db.credentialingProvider.create({
    data: {
      npi, firstName: String(b.firstName), lastName: String(b.lastName),
      credential: b.credential || null, email: b.email || null, phone: b.phone || null,
      state: b.state || null, city: b.city || null, postalCode: b.postalCode || null, addressLine1: b.addressLine1 || null,
      portalUsername: b.portalUsername || null,
      portalPasswordEnc: b.portalPassword ? encryptSecret(String(b.portalPassword)) : null,
      caqhAttestationDate: b.caqhAttestationDate ? new Date(b.caqhAttestationDate) : null,
      licenseExpDate: b.licenseExpDate ? new Date(b.licenseExpDate) : null,
      licenseState: b.licenseState || null,
      createdByName: `${s.firstName} ${s.lastName}`,
    },
  });
  return NextResponse.json({ ok: true, provider: publicProvider(p) });
}
