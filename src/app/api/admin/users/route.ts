import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateUserBody = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["provider", "nurse", "frontdesk", "billing", "admin"]),
  credential: z.string().optional(),
  specialty: z.string().optional(),
  npi: z.string().optional(),
  temporaryPassword: z.string().min(6),
});

const UpdateUserBody = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  role: z.enum(["provider", "nurse", "frontdesk", "billing", "admin"]).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  credential: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  npi: z.string().nullable().optional(),
  temporaryPassword: z.string().min(6).optional(),
});

export async function GET() {
  await requireAdminSession();
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      credential: true,
      specialty: true,
      npi: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = CreateUserBody.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const passwordHash = await bcrypt.hash(parse.data.temporaryPassword, 10);
  try {
    const created = await db.user.create({
      data: {
        email: parse.data.email.toLowerCase(),
        firstName: parse.data.firstName,
        lastName: parse.data.lastName,
        role: parse.data.role,
        credential: parse.data.credential ?? null,
        specialty: parse.data.specialty ?? null,
        npi: parse.data.npi ?? null,
        passwordHash,
        active: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        credential: true,
        specialty: true,
        npi: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, user: created });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    throw e;
  }
}

export async function PATCH(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = UpdateUserBody.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, temporaryPassword, email, ...rest } = parse.data;
  const data: Record<string, unknown> = { ...rest };
  if (email) data.email = email.toLowerCase();
  if (temporaryPassword) data.passwordHash = await bcrypt.hash(temporaryPassword, 10);

  try {
    const next = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        credential: true,
        specialty: true,
        npi: true,
        active: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, user: next });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    if ((e as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    throw e;
  }
}
