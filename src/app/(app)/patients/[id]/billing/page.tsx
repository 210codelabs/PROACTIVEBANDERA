import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDateTime, fmtMoney } from "@/lib/utils";

export default async function PtBilling({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let enc: Array<{
    id: string;
    startedAt: Date;
    chiefComplaint: string | null;
    provider: { firstName: string; lastName: string };
    diagnoses: Array<{ id: string; icd10: string; description: string; primary: boolean }>;
    charges: Array<{ id: string; cpt: string; description: string; units: number; modifier: string | null; feeCents: number }>;
  }> = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    enc = await db.encounter.findMany({
      where: { patientId: id },
      include: { charges: true, diagnoses: true, provider: true },
      orderBy: { startedAt: "desc" },
    });
  } catch {
    dataUnavailable = true;
  }

  const totalCents = enc.flatMap((e) => e.charges).reduce((s, c) => s + c.feeCents * c.units, 0);

  return (
    <PatientChart user={user} {...ctx} active="billing">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Billing details are temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold">Billing — Patient Total <span className="text-brand-700">{fmtMoney(totalCents)}</span></div>
        </header>
        {enc.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No charges on file.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {enc.map(e => {
              const eTotal = e.charges.reduce((s: number, c: { feeCents: number; units: number }) => s + c.feeCents * c.units, 0);
              return (
                <div key={e.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link href={`/encounters/${e.id}`} className="font-semibold text-brand-700 hover:underline">{e.chiefComplaint || "Office visit"}</Link>
                      <div className="text-xs text-slate-500">{fmtDateTime(e.startedAt)} · {e.provider.firstName} {e.provider.lastName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{fmtMoney(eTotal)}</div>
                      <div className="text-xs text-slate-500">{e.charges.length} charge{e.charges.length === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  {e.diagnoses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.diagnoses.map((d) => (
                        <span key={d.id} className={`chip ${d.primary ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                          <span className="font-mono">{d.icd10}</span> {d.description}{d.primary ? " (1°)" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.charges.length > 0 && (
                    <table className="data mt-2">
                      <thead><tr><th>CPT</th><th>Description</th><th>Units</th><th>Modifier</th><th>Fee</th></tr></thead>
                      <tbody>
                        {e.charges.map((c) => (
                          <tr key={c.id}>
                            <td className="font-mono">{c.cpt}</td>
                            <td>{c.description}</td>
                            <td>{c.units}</td>
                            <td>{c.modifier || "—"}</td>
                            <td>{fmtMoney(c.feeCents * c.units)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PatientChart>
  );
}
