import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate } from "@/lib/utils";
import AddProblemForm from "./AddProblemForm";

export default async function ProblemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let list: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    list = await db.problem.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="problems">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Problem data is temporarily unavailable.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card lg:col-span-2">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Problem List ({list.length})</header>
          {list.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No problems on file.</div>
          ) : (
            <table className="data">
              <thead><tr><th>ICD-10</th><th>Description</th><th>Status</th><th>Onset</th></tr></thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.icd10 || "—"}</td>
                    <td>{p.description}</td>
                    <td><span className={`chip ${p.status === "active" || p.status === "chronic" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{p.status}</span></td>
                    <td className="text-xs text-slate-500">{fmtDate(p.onsetDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Add Problem</header>
          <div className="p-4"><AddProblemForm patientId={id} /></div>
        </section>
      </div>
    </PatientChart>
  );
}
