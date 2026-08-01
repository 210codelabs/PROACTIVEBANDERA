import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureEncounterIndexHealed } from "@/lib/dbHeal";

export default async function NewEnc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();

  // Decide the destination inside try/catch, then redirect OUTSIDE of it.
  // next/navigation's redirect() works by throwing NEXT_REDIRECT; if it is
  // called inside the try, the catch swallows it and bounces the user back to
  // the encounters list (the reported "flicker returns to list" bug).
  let target: string;
  try {
    // Self-heal any legacy unique index on Encounter.appointmentId that would
    // otherwise block the 2nd walk-in (see src/lib/dbHeal.ts). Runs once per
    // server process; a no-op after the first successful drop.
    await ensureEncounterIndexHealed();
    // Quick-create an open encounter and redirect to it.
    const providerId = user.role === "provider" ? user.id : (await db.user.findFirst({ where: { role: "provider", active: true } }))?.id;
    if (!providerId) throw new Error("No provider available");
    const enc = await db.encounter.create({
      data: {
        patientId: id,
        providerId,
        visitType: "office",
        status: "open",
      },
    });
    target = `/encounters/${enc.id}`;
  } catch {
    target = `/patients/${id}/encounters?error=unavailable`;
  }
  redirect(target);
}
