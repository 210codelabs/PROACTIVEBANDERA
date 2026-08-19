import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig } from "@/lib/stedi";
import { daysSince } from "@/lib/coverage";

/**
 * POST /api/appointments/[id]/checkin
 * Marks an appointment as "checked-in" and surfaces the patient's most recent
 * saved eligibility (270/271) result so the front desk sees current coverage.
 *
 * IMPORTANT: eligibility is NO LONGER auto-verified on every check-in. Real-time
 * verification is now on demand only (and rate-limited to once per 30 days) to
 * control clearinghouse cost. Staff can click "Verify eligibility" when needed.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const appt = await db.appointment.findUnique({ where: { id } }).catch(() => null);
  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  const appointment = await db.appointment
    .update({ where: { id }, data: { status: "checked-in" } })
    .catch(() => null);
  if (!appointment) return NextResponse.json({ error: "Check-in is temporarily unavailable" }, { status: 503 });

  // Surface the latest saved coverage (no live Stedi call — on demand only).
  let coverage: any = null;
  let coverageNote: string | null = null;
  try {
    const cfg = await getStediConfig();
    const last = await db.eligibilityCheck
      .findFirst({ where: { patientId: appt.patientId }, orderBy: { createdAt: "desc" } })
      .catch(() => null);
    if (last) {
      coverage = last;
      const age = daysSince(last.createdAt);
      coverageNote =
        last.status === "active" && age < 30
          ? `Coverage verified ${age}d ago (still current).`
          : `Last verified ${age}d ago — verify eligibility if needed.`;
    } else if (!cfg.enabled || !cfg.apiKey) {
      coverageNote = "Stedi not configured — verify coverage manually.";
    } else {
      coverageNote = "No coverage on file — click Verify eligibility to run a check.";
    }
  } catch (e: any) {
    coverageNote = `Coverage lookup failed: ${String(e?.message || e).slice(0, 120)}`;
  }

  return NextResponse.json({ ok: true, appointment, coverage, coverageNote });
}
