import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ErxWenoHome from "./ErxWenoHome";

export const dynamic = "force-dynamic";

// E-Prescribe: Weno EZ Integration ONLY (production). Optional ?patientId= preselects.
export default async function ErxPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const pid = sp?.patientId?.trim();
  const p = pid
    ? await db.patient.findUnique({ where: { id: pid }, select: { id: true, firstName: true, lastName: true, mrn: true } }).catch(() => null)
    : null;
  return (
    <Shell user={user} pageTitle="E-Prescribe" jellyBeans={<JellyBeans />}>
      <ErxWenoHome initialPatient={p ? { id: p.id, firstName: p.firstName, lastName: p.lastName, mrn: p.mrn || undefined } : null} />
    </Shell>
  );
}
