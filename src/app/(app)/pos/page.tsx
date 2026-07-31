import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import PosTerminal from "@/components/pos/PosTerminal";
import { fmtMoney, fmtRelative } from "@/lib/utils";
import { readAdminConfig } from "@/lib/admin/store";

export default async function PosPage() {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const enabled = adminConfig.modules.integrations.posTerminal;

  let products: Array<{ id: string; sku: string; name: string; category: string; retailPriceCents: number; quantityOnHand: number; taxable: boolean }> = [];
  let services: Array<{ code: string; name: string }> = [];
  let recentSales: Array<{ id: string; number: string; totalCents: number; paymentMethod: string | null; patientName: string | null; cashier: string | null; createdAt: Date; lines: Array<{ id: string }> }> = [];
  let salesTodayCount = 0;
  let salesTodayCents = 0;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [dbProducts, dbServices, dbSales, todays] = await Promise.all([
      db.inventoryItem.findMany({ where: { active: true, retailPriceCents: { gt: 0 } }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.serviceType.findMany({ where: { active: true, category: "add-on-services" }, orderBy: { name: "asc" } }),
      db.posSale.findMany({ include: { lines: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.posSale.findMany({ where: { createdAt: { gte: startOfDay } }, select: { totalCents: true } }),
    ]);
    products = dbProducts.map((p) => ({ id: p.id, sku: p.sku, name: p.name, category: p.category, retailPriceCents: p.retailPriceCents, quantityOnHand: p.quantityOnHand, taxable: p.taxable }));
    services = dbServices.map((s) => ({ code: s.code, name: s.name }));
    recentSales = dbSales;
    salesTodayCount = todays.length;
    salesTodayCents = todays.reduce((sum, s) => sum + s.totalCents, 0);
  } catch {
    // Render the terminal shell even if data is briefly unavailable.
  }

  return (
    <Shell user={user} pageTitle="Point of Sale" jellyBeans={<JellyBeans />}>
      <div className="space-y-4">
        {!enabled ? (
          <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
            The point-of-sale terminal is currently paused in Admin → Operational Modules.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="card card-pad border-l-4 border-l-indigo-500">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sales today</div>
                <div className="text-xl font-bold text-slate-900">{salesTodayCount}</div>
              </div>
              <div className="card card-pad border-l-4 border-l-emerald-500">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Takings today</div>
                <div className="text-xl font-bold text-slate-900">{fmtMoney(salesTodayCents)}</div>
              </div>
              <div className="card card-pad border-l-4 border-l-brand-500">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sellable items</div>
                <div className="text-xl font-bold text-slate-900">{products.length}</div>
              </div>
            </section>

            <PosTerminal products={products} services={services} />

            <section className="card">
              <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Recent transactions</header>
              <table className="data">
                <thead><tr><th>Receipt</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Cashier</th><th>When</th></tr></thead>
                <tbody>
                  {recentSales.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No sales recorded yet.</td></tr>}
                  {recentSales.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.number}</td>
                      <td>{s.patientName || "Walk-in"}</td>
                      <td className="text-slate-600">{s.lines.length}</td>
                      <td><span className="chip bg-slate-100 text-slate-700 ring-slate-200">{s.paymentMethod || "—"}</span></td>
                      <td className="font-semibold">{fmtMoney(s.totalCents)}</td>
                      <td className="text-xs text-slate-500">{s.cashier || "—"}</td>
                      <td className="text-xs text-slate-400">{fmtRelative(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
