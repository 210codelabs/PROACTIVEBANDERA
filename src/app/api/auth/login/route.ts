import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { email, password } = parse.data;
  const result = await login(email, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  return NextResponse.json({ ok: true, user: result.user });
}
