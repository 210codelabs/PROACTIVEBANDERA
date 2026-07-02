import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate } from "@/lib/utils";
import AddAllergyForm from "./AddAllergyForm";

export default async function AllergyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let all: Array<{ id: string; substance: string; reaction: string | null; severity: string | null; onsetDate: Date | null; status: string }> = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    all = await db.allergy.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="allergies">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Allergy data is temporarily unavailable.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card lg:col-span-2">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Allergy List ({all.length})</header>
          {all.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">NKDA — No known drug allergies on file.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Substance</th><th>Reaction</th><th>Severity</th><th>Onset</th><th>Status</th></tr></thead>
              <tbody>
                {all.map(a => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.substance}</td>
                    <td>{a.reaction || "—"}</td>
                    <td>{a.severity ? <span className={`chip ${a.severity === "severe" || a.severity === "life-threatening" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{a.severity}</span> : "—"}</td>
                    <td>{fmtDate(a.onsetDate)}</td>
                    <td><span className={`chip ${a.status === "active" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Add Allergy</header>
          <div className="p-4"><AddAllergyForm patientId={id} /></div>
        </section>
      </div>
    </PatientChart>
  );
}
