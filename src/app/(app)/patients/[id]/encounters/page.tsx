import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDateTime } from "@/lib/utils";

export default async function EncList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let enc: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    enc = await db.encounter.findMany({
      where: { patientId: id },
      include: { provider: true, diagnoses: true, charges: true, _count: { select: { orders: true } } },
      orderBy: { startedAt: "desc" },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="encounters">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Encounter data is temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold">Encounters ({enc.length})</div>
          <Link href={`/patients/${id}/encounters/new`} className="btn-primary">+ New Encounter</Link>
        </header>
        {enc.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No encounters yet.</div>
        ) : (
          <table className="data">
            <thead><tr><th>Date</th><th>Provider</th><th>Chief complaint</th><th>Dx</th><th>Charges</th><th>Orders</th><th>Status</th></tr></thead>
            <tbody>
              {enc.map(e => (
                <tr key={e.id}>
                  <td className="text-xs">{fmtDateTime(e.startedAt)}</td>
                  <td>{e.provider.firstName} {e.provider.lastName}</td>
                  <td><Link href={`/encounters/${e.id}`} className="text-brand-700 hover:underline">{e.chiefComplaint || "—"}</Link></td>
                  <td>{e.diagnoses.length}</td>
                  <td>{e.charges.length}</td>
                  <td>{e._count.orders}</td>
                  <td><span className={`chip ${e.status === "signed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PatientChart>
  );
}
