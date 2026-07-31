import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import PatientHeader, { PatientTabs } from "@/components/PatientHeader";

export const dynamic = "force-dynamic";

export default async function LegalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const [allergies, problems, legalCase] = await Promise.all([
    db.allergy.findMany({ where: { patientId: id, status: "active" }, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.problem.findMany({ where: { patientId: id, status: { in: ["active", "chronic"] } }, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.legalCase.findFirst({ where: { patientId: id }, include: { attorney: true }, orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);

  const rows: [string, string][] = legalCase
    ? [
        ["Case type", String(legalCase.caseType || "").replace(/_/g, " ")],
        ["Status", legalCase.status],
        ["Case / claim number", legalCase.caseNumber || "—"],
        ["Responsible court", legalCase.court || "—"],
        ["Date of injury", legalCase.dateOfInjury ? new Date(legalCase.dateOfInjury).toLocaleDateString() : "—"],
        ["Attorney", legalCase.attorney?.name || "—"],
        ["Law firm", legalCase.attorney?.firm || legalCase.lawFirm || "—"],
        ["Insurer claim #", legalCase.claimNumber || "—"],
        ["Adjuster", legalCase.adjuster || "—"],
        ["Defendant / at-fault insurer", legalCase.defendantInsurer || "—"],
      ]
    : [];

  return (
    <Shell user={user} patientHeader={
      <>
        <PatientHeader patient={patient} allergies={allergies} problems={problems} />
        <PatientTabs patientId={id} active="summary" />
      </>
    }>
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <span className="chip bg-amber-200 text-amber-900 ring-amber-300 font-semibold">Legal / Rehabilitation Case</span>
          <h1 className="text-lg font-semibold text-slate-900">Case details</h1>
        </div>

        {!legalCase ? (
          <div className="card card-pad text-slate-500">This patient has no legal case on file.</div>
        ) : (
          <div className="card overflow-hidden">
            <dl className="divide-y divide-slate-100">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start gap-4 px-4 py-2.5">
                  <dt className="w-56 shrink-0 text-sm text-slate-500">{k}</dt>
                  <dd className="text-sm font-medium text-slate-800 capitalize">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="card card-pad bg-slate-50 text-sm text-slate-600">
          <div className="font-semibold text-slate-800 mb-1">Coming in Phase 2</div>
          Case-stage tracking, document uploads, billing, lien negotiation (offers / counter-offers), deliverables and notifications, plus the Attorney Portal view — will be added here next.
        </div>
      </div>
    </Shell>
  );
}
