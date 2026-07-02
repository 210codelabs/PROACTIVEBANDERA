import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtDateTime } from "@/lib/utils";
import LabcorpRoutingControls from "@/components/orders/LabcorpRoutingControls";
import PharmacyRoutingControls from "@/components/orders/PharmacyRoutingControls";
import { canRoleAccess, readAdminConfig } from "@/lib/admin/store";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const labcorpEnabled = adminConfig.modules.integrations.labcorpOutbound;
  const pharmacyEnabled = adminConfig.modules.integrations.pharmacyRouting;
  const canViewOrders = !adminConfig.modules.enforceRoleAccess || canRoleAccess(adminConfig, user.role, "ordersWrite") || canRoleAccess(adminConfig, user.role, "billingRead");
  const canRouteLabs = !adminConfig.modules.enforceRoleAccess || canRoleAccess(adminConfig, user.role, "ordersWrite");
  const canRouteRx = !adminConfig.modules.enforceRoleAccess || canRoleAccess(adminConfig, user.role, "ordersWrite");

  if (!canViewOrders) {
    return (
      <Shell user={user} pageTitle="Orders" jellyBeans={<JellyBeans />}>
        <div className="card card-pad border-rose-200 bg-rose-50 text-rose-900">
          Access denied. Your role does not currently have permission to access the orders workspace.
        </div>
      </Shell>
    );
  }

  let orders: Array<{
    id: string;
    type: string;
    patientId: string;
    itemName: string;
    rxStrength: string | null;
    rxSig: string | null;
    instructions: string | null;
    status: string;
    pharmacyName: string | null;
    routingNetwork: string | null;
    createdAt: Date;
    patient: { firstName: string; lastName: string };
    provider: { firstName: string; lastName: string };
  }> = [];
  let dataUnavailable = false;

  try {
    orders = await db.order.findMany({
      where: { ...(sp.type ? { type: sp.type } : {}), ...(sp.status ? { status: sp.status } : {}) },
      include: { patient: true, provider: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch {
    dataUnavailable = true;
  }

  const pendingLabCount = orders.filter((order) => order.type === "lab" && order.status === "pending").length;
  const sentLabCount = orders.filter((order) => order.type === "lab" && order.status === "sent").length;
  const pendingRxCount = orders.filter((order) => order.type === "rx" && order.status === "pending").length;
  const sentRxCount = orders.filter((order) => order.type === "rx" && order.status === "sent").length;

  return (
    <Shell user={user} pageTitle="Orders" jellyBeans={<JellyBeans />}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Orders data is temporarily unavailable. Try again in a moment.
        </div>
      )}
      {(sp.type === "rx" || !sp.type) && (
        <div className="card card-pad mb-3 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Pharmacy module</div>
              <div className="font-semibold text-slate-900">{pharmacyEnabled ? "E-prescribe routing is enabled. Search the pharmacy network and send prescriptions." : "Pharmacy e-prescribe routing is currently disabled by admin controls."}</div>
              <div className="mt-1 text-xs text-slate-600">{pharmacyEnabled ? "Connected to the Surescripts / Availity pharmacy directory for outbound prescriptions." : "Enable Pharmacy e-prescribe routing in Admin Operational Settings to activate this flow."}</div>
            </div>
            <span className={`chip ${pharmacyEnabled ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Surescripts / Availity</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Pending: {pendingRxCount}</span>
            <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Sent: {sentRxCount}</span>
          </div>
          {pharmacyEnabled && canRouteRx ? (
            <PharmacyRoutingControls pendingRxCount={pendingRxCount} />
          ) : (
            <div className="mt-3 text-xs text-slate-600">Routing controls are unavailable while pharmacy e-prescribe is disabled or your role lacks order routing permission.</div>
          )}
        </div>
      )}
      {(sp.type === "lab" || !sp.type) && (
        <div className="card card-pad mb-3 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Lab module</div>
              <div className="font-semibold text-slate-900">{labcorpEnabled ? "Labcorp routing is enabled for outbound lab orders." : "Labcorp routing is currently disabled by admin controls."}</div>
              <div className="mt-1 text-xs text-slate-600">{labcorpEnabled ? "Outbound routing endpoint is active for all lab orders." : "Enable Labcorp outbound routing in Admin Operational Settings to activate this flow."}</div>
            </div>
            <span className={`chip ${labcorpEnabled ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Labcorp</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Pending: {pendingLabCount}</span>
            <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Sent: {sentLabCount}</span>
          </div>
          {labcorpEnabled && canRouteLabs ? (
            <LabcorpRoutingControls pendingLabCount={pendingLabCount} />
          ) : (
            <div className="mt-3 text-xs text-slate-600">Routing controls are unavailable while Labcorp outbound is disabled or your role lacks order routing permission.</div>
          )}
        </div>
      )}
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap gap-2">
          <Link href="/orders" className={`chip ring-1 ring-inset ${!sp.type && !sp.status ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>All</Link>
          {["rx", "lab", "imaging", "referral", "procedure"].map(t => (
            <Link key={t} href={`/orders?type=${t}`} className={`chip ring-1 ring-inset ${sp.type === t ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{t.toUpperCase()}</Link>
          ))}
          <Link href="/orders?status=pending" className={`chip ring-1 ring-inset ml-auto ${sp.status === "pending" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Pending</Link>
          <Link href="/orders?status=completed" className={`chip ring-1 ring-inset ${sp.status === "completed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Completed</Link>
        </header>
        <table className="data">
          <thead><tr><th>Type</th><th>Patient</th><th>Item</th><th>Sig / instructions</th><th>Destination</th><th>Provider</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-10">No orders.</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td className="uppercase text-xs font-semibold text-slate-600">{o.type}</td>
                <td><Link href={`/patients/${o.patientId}`} className="text-brand-700 hover:underline">{o.patient.lastName}, {o.patient.firstName}</Link></td>
                <td className="font-medium">{o.itemName}{o.rxStrength ? ` ${o.rxStrength}` : ""}</td>
                <td className="text-xs text-slate-600 max-w-[260px] truncate">{o.rxSig || o.instructions || "—"}</td>
                <td className="text-xs text-slate-600">{o.pharmacyName ? o.pharmacyName : "—"}</td>
                <td className="text-xs">{o.provider.firstName} {o.provider.lastName}</td>
                <td><span className={`chip ${o.status === "sent" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : o.status === "completed" ? "bg-brand-100 text-brand-800 ring-brand-200" : o.status === "cancelled" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{o.status}</span></td>
                <td className="text-xs text-slate-500">{fmtDateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
