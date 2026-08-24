import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEmployeeSession } from "@/lib/employeeAuth";
import { signConsentRecord } from "@/lib/enterprise/signConsent";

export const runtime = "nodejs";
const Body = z.object({ signatureText: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getEmployeeSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const consent = await db.enterpriseConsent.findUnique({ where: { id } });
  if (!consent || consent.employeeId !== s.employeeId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Signature is required" }, { status: 400 });
  const res = await signConsentRecord({ consentId: id, signatureText: parse.data.signatureText, signerName: s.name, actorName: `${s.name} (Employee)` });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, consent: res.consent, documentId: res.documentId });
}
