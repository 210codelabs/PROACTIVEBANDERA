import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDateTime } from "@/lib/utils";

export default async function PtOrders({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let orders: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    orders = await db.order.findMany({ where: { patientId: id }, include: { provider: true }, orderBy: { createdAt: "desc" } });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PatientChart user={user} {...ctx} active="orders">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Order data is temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold">Orders ({orders.length})</div>
          <div className="flex gap-2">
            <Link href={`/patients/${id}/orders/new?type=rx`} className="btn-primary">+ Rx</Link>
            <Link href={`/patients/${id}/orders/new?type=lab`} className="btn-secondary">+ Lab</Link>
            <Link href={`/patients/${id}/orders/new?type=imaging`} className="btn-secondary">+ Imaging</Link>
            <Link href={`/patients/${id}/orders/new?type=referral`} className="btn-secondary">+ Referral</Link>
          </div>
        </header>
        {orders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No orders yet.</div>
        ) : (
          <table className="data">
            <thead><tr><th>Type</th><th>Item</th><th>Sig / Instructions</th><th>Status</th><th>Provider</th><th>Created</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="uppercase text-xs font-semibold text-slate-600">{o.type}</td>
                  <td className="font-medium">{o.itemName}{o.rxStrength ? ` ${o.rxStrength}` : ""}</td>
                  <td className="text-xs text-slate-600">{o.rxSig || o.instructions || "—"}</td>
                  <td><span className="chip bg-slate-100 text-slate-700 ring-slate-200">{o.status}</span></td>
                  <td className="text-xs">{o.provider.firstName} {o.provider.lastName}</td>
                  <td className="text-xs text-slate-500">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PatientChart>
  );
}
