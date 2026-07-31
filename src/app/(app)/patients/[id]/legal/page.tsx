import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import PatientHeader, { PatientTabs } from "@/components/PatientHeader";
import LegalCaseWorkspace from "@/components/LegalCaseWorkspace";

export const dynamic = "force-dynamic";

export default async function LegalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const [allergies, problems, legalCase] = await Promise.all([
    db.allergy.findMany({ where: { patientId: id, status: "active" }, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.problem.findMany({ where: { patientId: id, status: { in: ["active", "chronic"] } }, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.legalCase.findFirst({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      include: {
        attorney: { select: { id: true, name: true, firm: true, email: true } },
        documents: { select: { id: true, name: true, category: true, mimeType: true, size: true, uploadedBy: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "desc" } },
        offers: { orderBy: { createdAt: "desc" } },
        deliverables: { orderBy: { createdAt: "asc" } },
      },
    }).catch(() => null),
  ]);

  const initial = JSON.parse(JSON.stringify(legalCase));

  return (
    <Shell user={user} patientHeader={
      <>
        <PatientHeader patient={patient} allergies={allergies} problems={problems} />
        <PatientTabs patientId={id} active="summary" />
      </>
    }>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="chip bg-amber-200 text-amber-900 ring-amber-300 font-semibold">Legal / Rehabilitation Case</span>
          <h1 className="text-lg font-semibold text-slate-900">Case workspace</h1>
        </div>
        {!legalCase ? (
          <div className="card card-pad text-slate-500">This patient has no legal case on file.</div>
        ) : (
          <LegalCaseWorkspace caseId={legalCase.id} initial={initial} />
        )}
      </div>
    </Shell>
  );
}
