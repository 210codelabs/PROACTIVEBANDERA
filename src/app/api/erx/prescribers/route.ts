import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — active Weno-registered prescribers for the eRx "Prescribe as" picker,
// plus a suggestedId auto-matched to the logged-in user (by userId, then name).
export async function GET() {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const rows = await db.wenoPrescriber.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { lastName: "asc" }] }).catch(() => []);
  const prescribers = rows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    name: `${p.firstName} ${p.lastName}`.trim(),
    npi: p.npi,
    dea: p.dea || "",
    wenoEmail: p.wenoEmail || "",
    userId: p.userId || "",
    isDefault: p.isDefault,
  }));

  const uName = [(user as any).firstName, (user as any).lastName].filter(Boolean).join(" ").trim().toLowerCase();
  const byUser = prescribers.find((p) => p.userId && p.userId === user.id);
  const byName = prescribers.find((p) => p.name.toLowerCase() === uName && uName);
  const byDefault = prescribers.find((p) => p.isDefault);
  const suggestedId = (byUser || byName || byDefault || prescribers[0])?.id || null;

  return NextResponse.json({ prescribers, suggestedId });
}
