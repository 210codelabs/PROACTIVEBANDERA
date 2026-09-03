import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import { db } from "@/lib/db";
import WenoEzFrame from "@/components/erx/WenoEzFrame";

export const dynamic = "force-dynamic";

export default async function WenoPrescribePage({ params }: { params: Promise<{ patientId: string }> }) {
  const user = await requireSession();
  const { patientId } = await params;
  const p = await db.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true, mrn: true } }).catch(() => null);
  return (
    <Shell user={user} pageTitle="Prescribe">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/patients/${patientId}`} className="text-sm text-brand-700 hover:underline">← Back to patient</Link>
        {p && <span className="text-sm text-slate-500">{p.lastName}, {p.firstName}{p.mrn ? ` · MRN ${p.mrn}` : ""}</span>}
      </div>
      <WenoEzFrame patientId={patientId} />
    </Shell>
  );
}
