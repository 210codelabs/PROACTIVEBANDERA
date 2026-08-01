import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const items = await db.caseDeliverable.findMany({ where: { legalCaseId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ deliverables: items });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const item = await db.caseDeliverable.create({
    data: { legalCaseId: id, title, dueDate: body?.dueDate ? new Date(body.dueDate) : null },
  });
  return NextResponse.json({ ok: true, deliverable: item });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;
  const body = await req.json().catch(() => ({}));
  if (!body?.deliverableId) return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
  const item = await db.caseDeliverable.update({ where: { id: body.deliverableId }, data: { done: !!body.done } });
  return NextResponse.json({ ok: true, deliverable: item });
}
