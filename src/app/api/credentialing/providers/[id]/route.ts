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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await db.credentialingProvider.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const jobs = await db.automationJob.findMany({ where: { providerId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ provider: publicProvider(p), jobs: jobs.map((j) => ({ ...j, package: undefined })) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["firstName", "lastName", "credential", "email", "phone", "addressLine1", "city", "state", "postalCode", "portalUsername"] as const) {
    if (b[k] !== undefined) data[k] = b[k] || null;
  }
  if (b.portalPassword) data.portalPasswordEnc = encryptSecret(String(b.portalPassword));
  const p = await db.credentialingProvider.update({ where: { id }, data }).catch(() => null);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, provider: publicProvider(p) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.credentialingProvider.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
