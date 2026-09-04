import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate } from "@/lib/utils";
import AddImmunizationForm from "./AddImmunizationForm";
import ImmtracPanel from "./ImmtracPanel";

export default async function ImmunizationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let list: any[] = [];
  let consent = false;
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    list = await db.immunization.findMany({ where: { patientId: id }, orderBy: { givenAt: "desc" } });
    const p = await db.patient.findUnique({ where: { id }, select: { immtracConsent: true } });
    consent = Boolean(p?.immtracConsent);
  } catch {
    dataUnavailable = true;
  }
  const canEdit = ["admin", "provider", "nurse"].includes(user.role);

  return (
    <PatientChart user={user} {...ctx} active="immunizations">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Immunization data is temporarily unavailable.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card lg:col-span-2">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Immunization Record ({list.length})</header>
          {list.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No immunizations on file.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Vaccine</th><th>CVX</th><th>Date</th><th>Lot</th><th>Site</th><th>Source</th></tr></thead>
              <tbody>
                {list.map(v => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.vaccine}</td>
                    <td className="font-mono text-xs">{v.cvxCode || "—"}</td>
                    <td className="text-xs text-slate-500">{fmtDate(v.givenAt)}</td>
                    <td className="text-xs">{v.lot || "—"}</td>
                    <td className="text-xs">{v.site || "—"}</td>
                    <td className="text-xs">
                      {v.source === "iis-import" ? (
                        <span className="chip bg-teal-100 text-teal-800 ring-teal-200">ImmTrac2</span>
                      ) : v.source === "fhir-import" ? (
                        <span className="chip bg-indigo-100 text-indigo-800 ring-indigo-200">FHIR</span>
                      ) : (
                        <span className="chip bg-slate-100 text-slate-600 ring-slate-200">Manual</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <div className="space-y-4">
          <ImmtracPanel patientId={id} initialConsent={consent} canEdit={canEdit} />
          <section className="card">
            <header className="px-4 py-3 border-b border-slate-200 font-semibold">Add Immunization</header>
            <div className="p-4"><AddImmunizationForm patientId={id} /></div>
          </section>
        </div>
      </div>
    </PatientChart>
  );
}
