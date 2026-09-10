import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

// GET — list all saved Weno-registered prescribers (admin).
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const list = await db.wenoPrescriber.findMany({ orderBy: [{ isDefault: "desc" }, { lastName: "asc" }] }).catch(() => []);
  // Never return the stored Weno password; expose only whether one is set.
  const safe = list.map((p: any) => {
    const { wenoPassword, ...rest } = p;
    return { ...rest, hasWenoPassword: Boolean(wenoPassword) };
  });
  return NextResponse.json({ prescribers: safe });
}

// POST — create a prescriber (admin). If isDefault, clear the flag on others.
export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const firstName = String(b.firstName || "").trim();
  const lastName = String(b.lastName || "").trim();
  const npi = String(b.npi || "").replace(/\D/g, "");
  if (!firstName || !lastName) return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  if (npi.length !== 10) return NextResponse.json({ error: "NPI must be 10 digits." }, { status: 400 });

  const isDefault = Boolean(b.isDefault);
  if (isDefault) await db.wenoPrescriber.updateMany({ where: { isDefault: true }, data: { isDefault: false } }).catch(() => {});

  const created = await db.wenoPrescriber.create({
    data: {
      firstName,
      lastName,
      npi,
      dea: String(b.dea || "").trim() || null,
      wenoEmail: String(b.wenoEmail || "").trim() || null,
      wenoPassword: String(b.wenoPassword || "").trim() || null,
      wenoLocationId: String(b.wenoLocationId || "").trim() || null,
      userId: String(b.userId || "").trim() || null,
      isDefault,
      active: true,
    },
  });
  return NextResponse.json({ ok: true, prescriber: created });
}

// PATCH — update flags (isDefault/active) or fields by id (admin).
export async function PATCH(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (b.isDefault === true) await db.wenoPrescriber.updateMany({ where: { isDefault: true }, data: { isDefault: false } }).catch(() => {});
  const data: any = {};
  for (const k of ["firstName", "lastName", "dea", "wenoEmail", "wenoLocationId", "userId"]) if (typeof b[k] === "string") data[k] = b[k].trim() || null;
  // Only update the Weno password when a non-empty value is supplied (blank = keep existing).
  if (typeof b.wenoPassword === "string" && b.wenoPassword.trim()) data.wenoPassword = b.wenoPassword.trim();
  if (typeof b.npi === "string") { const n = b.npi.replace(/\D/g, ""); if (n.length === 10) data.npi = n; }
  if (typeof b.isDefault === "boolean") data.isDefault = b.isDefault;
  if (typeof b.active === "boolean") data.active = b.active;
  const updated = await db.wenoPrescriber.update({ where: { id }, data }).catch(() => null);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, prescriber: updated });
}

// DELETE ?id= — remove a prescriber (admin).
export async function DELETE(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.wenoPrescriber.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
