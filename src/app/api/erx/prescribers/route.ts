import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the "Prescribe as" picker list. Merges TWO sources so the correct
// prescriber is always available regardless of which staff account is logged in
// or what admin account is in Settings:
//   1) Weno-registered prescribers (WenoPrescriber) — can carry their own Weno
//      login (wenoEmail/password) so ComposeRx opens AS that provider.
//   2) Provider user accounts with an NPI that aren't already registered.
// Also returns suggestedId auto-matched to the logged-in user.
export async function GET() {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const [rows, users] = await Promise.all([
    db.wenoPrescriber.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { lastName: "asc" }] }).catch(() => []),
    db.user.findMany({
      where: { active: true, role: "provider", npi: { not: null } },
      select: { id: true, firstName: true, lastName: true, npi: true, dea: true, credential: true, email: true },
    }).catch(() => []),
  ]);

  const prescribers = rows.map((p: any) => ({
    id: p.id,
    source: "registered" as const,
    firstName: p.firstName,
    lastName: p.lastName,
    name: `${p.firstName} ${p.lastName}`.trim(),
    npi: p.npi,
    dea: p.dea || "",
    credential: "",
    wenoEmail: p.wenoEmail || "",
    hasWenoLogin: Boolean(p.wenoEmail),
    userId: p.userId || "",
    isDefault: p.isDefault,
  }));

  // Add provider users whose NPI isn't already represented.
  const knownNpis = new Set(prescribers.map((p) => p.npi).filter(Boolean));
  for (const u of users as any[]) {
    if (!u.npi || knownNpis.has(u.npi)) continue;
    knownNpis.add(u.npi);
    prescribers.push({
      id: `user:${u.id}`,
      source: "user" as const,
      firstName: u.firstName,
      lastName: u.lastName,
      name: `${u.firstName} ${u.lastName}`.trim(),
      npi: u.npi,
      dea: u.dea || "",
      credential: u.credential || "",
      wenoEmail: "",
      hasWenoLogin: false,
      userId: u.id,
      isDefault: false,
    });
  }

  const uName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim().toLowerCase();
  const byUser = prescribers.find((p) => p.userId && p.userId === user.id);
  const byNpi = user.npi ? prescribers.find((p) => p.npi === user.npi) : undefined;
  const byName = prescribers.find((p) => p.name.toLowerCase() === uName && uName);
  const byDefault = prescribers.find((p) => p.isDefault);
  const suggestedId = (byUser || byNpi || byName || byDefault || prescribers[0])?.id || null;

  return NextResponse.json({ prescribers, suggestedId });
}
