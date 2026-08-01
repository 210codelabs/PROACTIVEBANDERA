import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  intake: "bg-slate-100 text-slate-700 ring-slate-200",
  treating: "bg-blue-100 text-blue-700 ring-blue-200",
  negotiating: "bg-amber-100 text-amber-800 ring-amber-200",
  settled: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-200 text-slate-600 ring-slate-300",
};

export default async function LegalCasesPage() {
  const user = await requireSession();
  const cases = await db.legalCase.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      attorney: { select: { name: true, firm: true } },
    },
  }).catch(() => []);

  return (
    <Shell user={user} pageTitle="Legal Cases">
      <div className="mb-3 text-sm text-slate-500">Personal injury, auto accident and workers&apos; compensation cases linked to attorneys / law firms.</div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Patient</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Case / claim #</th>
              <th className="text-left px-4 py-2">Attorney / firm</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No legal cases yet. Register a patient as a Legal / Attorney case to create one.</td></tr>
            )}
            {cases.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{c.patient.firstName} {c.patient.lastName} <span className="text-xs text-slate-400">{c.patient.mrn}</span></td>
                <td className="px-4 py-2 capitalize">{String(c.caseType || "").replace(/_/g, " ")}</td>
                <td className="px-4 py-2">{c.caseNumber || "—"}</td>
                <td className="px-4 py-2">{c.attorney?.name || c.lawFirm || "—"}{c.attorney?.firm ? ` · ${c.attorney.firm}` : ""}</td>
                <td className="px-4 py-2"><span className={`chip capitalize ${STATUS_CHIP[c.status] || STATUS_CHIP.intake}`}>{c.status}</span></td>
                <td className="px-4 py-2 text-right"><Link href={`/patients/${c.patient.id}/legal`} className="text-brand-700 font-semibold hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
