import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewEnc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  try {
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
    redirect(`/encounters/${enc.id}`);
  } catch {
    redirect(`/patients/${id}/encounters?error=unavailable`);
  }
}
