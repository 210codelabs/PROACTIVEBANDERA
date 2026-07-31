import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate } from "@/lib/utils";

export default async function MedsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let meds: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    meds = await db.medication.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="medications">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Medication data is temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold">Medication List ({meds.length})</div>
          <Link href={`/patients/${id}/orders/new?type=rx`} className="btn-primary">+ Prescribe</Link>
        </header>
        {meds.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No medications on file.</div>
        ) : (
          <table className="data">
            <thead><tr><th>Medication</th><th>Sig</th><th>Route</th><th>Status</th><th>Started</th></tr></thead>
            <tbody>
              {meds.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="font-medium">{m.name}</div>
                    {m.strength && <div className="text-xs text-slate-500">{m.strength}{m.form ? ` · ${m.form}` : ""}</div>}
                  </td>
                  <td>{m.sig || "—"}</td>
                  <td>{m.route || "—"}</td>
                  <td><span className={`chip ${m.status === "active" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{m.status}</span></td>
                  <td className="text-xs text-slate-500">{fmtDate(m.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PatientChart>
  );
}
