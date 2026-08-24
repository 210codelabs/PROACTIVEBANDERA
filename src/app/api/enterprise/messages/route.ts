import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestId = new URL(req.url).searchParams.get("requestId") || undefined;
  const where: any = { enterpriseId: s.enterpriseId };
  if (requestId) where.requestId = requestId;
  const messages = await db.enterpriseMessage.findMany({ where, orderBy: { createdAt: "asc" }, take: 300 });
  return NextResponse.json({ messages });
}

const Body = z.object({ body: z.string().min(1), requestId: z.string().optional().nullable() });

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Message required" }, { status: 400 });
  const msg = await db.enterpriseMessage.create({
    data: { enterpriseId: s.enterpriseId, requestId: parse.data.requestId || null, senderType: "employer", senderName: s.name, body: parse.data.body },
  });
  return NextResponse.json({ ok: true, message: msg });
}
