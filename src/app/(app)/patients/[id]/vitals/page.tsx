import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDateTime } from "@/lib/utils";
import AddVitalsForm from "./AddVitalsForm";

export default async function VitalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let vitals: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    vitals = await db.vital.findMany({ where: { patientId: id }, orderBy: { takenAt: "desc" }, take: 50 });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="vitals">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Vitals data is temporarily unavailable.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card lg:col-span-2">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Vitals History</header>
          {vitals.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No vitals recorded.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Taken</th><th>BP</th><th>HR</th><th>Temp °C</th><th>SpO₂</th><th>RR</th><th>Wt kg</th><th>BMI</th><th>Pain</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map(v => (
                  <tr key={v.id}>
                    <td className="text-xs">{fmtDateTime(v.takenAt)}</td>
                    <td>{v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                    <td>{v.pulse ?? "—"}</td>
                    <td>{v.temperatureC ?? "—"}</td>
                    <td>{v.spo2 ?? "—"}</td>
                    <td>{v.respRate ?? "—"}</td>
                    <td>{v.weightKg ?? "—"}</td>
                    <td>{v.bmi ?? "—"}</td>
                    <td>{v.painScore ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Record Vitals</header>
          <div className="p-4"><AddVitalsForm patientId={id} /></div>
        </section>
      </div>
    </PatientChart>
  );
}
