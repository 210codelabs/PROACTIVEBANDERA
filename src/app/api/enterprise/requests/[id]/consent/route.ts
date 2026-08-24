import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";
const Body = z.object({ consentEmployee: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Signature required" }, { status: 400 });
  const existing = await db.enterpriseServiceRequest.findUnique({ where: { id } });
  if (!existing || existing.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const request = await db.enterpriseServiceRequest.update({
    where: { id },
    data: { consentStatus: "signed", consentEmployee: parse.data.consentEmployee, consentEmployer: s.name, consentSignedAt: new Date() },
  });
  return NextResponse.json({ ok: true, request });
}
