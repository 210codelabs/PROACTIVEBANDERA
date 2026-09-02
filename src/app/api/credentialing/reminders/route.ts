import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/credentialing/reminders?days=90
// Upcoming / overdue CAQH attestation + license expirations.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Math.max(1, Math.min(365, parseInt(new URL(req.url).searchParams.get("days") || "90", 10) || 90));
  const now = Date.now();
  const horizon = now + days * 24 * 3600 * 1000;

  const providers = await db.credentialingProvider.findMany({
    where: { OR: [{ caqhAttestationDate: { not: null } }, { licenseExpDate: { not: null } }] },
    take: 1000,
  });

  const items: any[] = [];
  for (const p of providers) {
    const name = `${p.lastName}, ${p.firstName}${p.credential ? `, ${p.credential}` : ""}`;
    for (const [type, date] of [["CAQH attestation", p.caqhAttestationDate], ["License expiration", p.licenseExpDate]] as const) {
      if (!date) continue;
      const t = new Date(date).getTime();
      if (t <= horizon) {
        const dueInDays = Math.round((t - now) / (24 * 3600 * 1000));
        items.push({ providerId: p.id, name, npi: p.npi, type, date, dueInDays, overdue: t < now, licenseState: p.licenseState || null });
      }
    }
  }
  items.sort((a, b) => a.dueInDays - b.dueInDays);
  return NextResponse.json({ days, count: items.length, items });
}
