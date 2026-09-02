import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me/profile -> current user's editable credentialing fields
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await db.user.findUnique({ where: { id: session.id } });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    profile: {
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      credential: u.credential || "",
      specialty: u.specialty || "",
      npi: u.npi || "",
      dea: u.dea || "",
      licenseNo: u.licenseNo || "",
    },
  });
}

function clean(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

// PATCH /api/me/profile -> update own NPI / DEA / state license / credential / specialty
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const npi = clean(b.npi);
  if (npi && !/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: "NPI must be exactly 10 digits." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.id },
    data: {
      npi,
      dea: clean(b.dea),
      licenseNo: clean(b.licenseNo),
      credential: clean(b.credential),
      specialty: clean(b.specialty),
    },
  });

  return NextResponse.json({
    ok: true,
    profile: {
      credential: updated.credential || "",
      specialty: updated.specialty || "",
      npi: updated.npi || "",
      dea: updated.dea || "",
      licenseNo: updated.licenseNo || "",
    },
  });
}
