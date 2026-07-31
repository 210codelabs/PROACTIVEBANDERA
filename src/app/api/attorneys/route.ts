import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET() {
  await requireSession();
  const attorneys = await db.attorney.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, firm: true, email: true, accessCode: true, active: true, createdAt: true, _count: { select: { requests: true } } },
  });
  return NextResponse.json({ attorneys });
}

export async function POST(req: Request) {
  await requireSession();
  const b = await req.json().catch(() => null);
  const name = (b?.name || "").toString().trim();
  const email = (b?.email || "").toString().trim().toLowerCase();
  if (!name || !email) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  const accessCode = (b?.accessCode || "").toString().trim() || Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    const a = await db.attorney.create({
      data: { name, email, firm: b?.firm ? String(b.firm).trim() : null, accessCode },
    });
    return NextResponse.json({ ok: true, attorney: a }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An attorney with that email already exists." }, { status: 409 });
  }
}
