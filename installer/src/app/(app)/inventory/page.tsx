import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import InventoryAdjust from "@/components/inventory/InventoryAdjust";
import { colorForCategory, fmtDate, fmtMoney, fmtRelative } from "@/lib/utils";
import { readAdminConfig } from "@/lib/admin/store";

const CATEGORY_LABEL: Record<string, string> = {
  medication: "Medications",
  supply: "Clinical Supplies",
  retail: "Retail / OTC",
  aesthetic: "Aesthetic Consumables",
  equipment: "Equipment & Devices",
};

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  strength: string | null;
  unit: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  unitCostCents: number;
  retailPriceCents: number;
  location: string | null;
  supplier: string | null;
  controlled: boolean;
  expiresAt: Date | null;
};

function stockState(item: Item): { label: string; chip: string } {
  if (item.quantityOnHand <= 0) return { label: "Out of stock", chip: "bg-rose-100 text-rose-800 ring-rose-200" };
  if (item.quantityOnHand <= item.reorderLevel) return { label: "Reorder", chip: "bg-amber-100 text-amber-800 ring-amber-200" };
  return { label: "In stock", chip: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const enabled = adminConfig.modules.integrations.inventoryManagement;

  let items: Item[] = [];
  let movements: Array<{ id: string; type: string; quantity: number; reason: string | null; actor: string | null; createdAt: Date; item: { name: string } }> = [];
  let dataUnavailable = false;

  try {
    [items, movements] = await Promise.all([
      db.inventoryItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.stockMovement.findMany({ include: { item: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
    ]);
  } catch {
    dataUnavailable = true;
  }

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const filtered = sp.category ? items.filter((i) => i.category === sp.category) : items;

  const lowStock = items.filter((i) => i.quantityOnHand <= i.reorderLevel);
  const onHandValueCents = items.reduce((sum, i) => sum + i.unitCostCents * i.quantityOnHand, 0);
  const soonDays = 90;
  const expiringSoon = items.filter((i) => i.expiresAt && new Date(i.expiresAt).getTime() - Date.now() < soonDays * 86400000);

  return (
    <Shell user={user} pageTitle="Inventory" jellyBeans={<JellyBeans />}>
      <div className="space-y-4">
        {!enabled && (
          <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
            Inventory management is currently paused in Admin → Operational Modules. Viewing is read-only until it is re-enabled.
          </div>
        )}
        {dataUnavailable && (
          <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">Inventory data is temporarily unavailable. Try again in a moment.</div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active items" value={String(items.length)} accent="border-l-brand-500" />
          <Stat label="Reorder / out" value={String(lowStock.length)} accent="border-l-amber-500" />
          <Stat label="On-hand value" value={fmtMoney(onHandValueCents)} accent="border-l-emerald-500" />
          <Stat label="Expiring < 90d" value={String(expiringSoon.length)} accent="border-l-rose-500" />
        </section>

        {lowStock.length > 0 && (
          <section className="card overflow-hidden border-l-4 border-l-amber-500">
            <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Low-stock & reorder alerts</header>
            <div className="p-4 flex flex-wrap gap-2">
              {lowStock.map((i) => (
                <span key={i.id} className="chip bg-amber-100 text-amber-800 ring-amber-200">
                  {i.name} · {i.quantityOnHand}/{i.reorderLevel} {i.unit}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 mr-1">Stock</span>
            <Link href="/inventory" className={`chip ring-1 ring-inset ${!sp.category ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>All</Link>
            {categories.map((cat) => (
              <Link key={cat} href={`/inventory?category=${cat}`} className={`chip ring-1 ring-inset ${sp.category === cat ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                {CATEGORY_LABEL[cat] || cat}
              </Link>
            ))}
            <Link href="/pos" className="chip bg-indigo-100 text-indigo-800 ring-indigo-200 hover:bg-indigo-200 ml-auto">Open checkout</Link>
          </header>
          <table className="data">
            <thead>
              <tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder</th><th>Cost</th><th>Retail</th><th>Location</th><th>Status / action</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-10">No inventory items in this view.</td></tr>}
              {filtered.map((i) => {
                const state = stockState(i);
                return (
                  <tr key={i.id}>
                    <td>
                      <div className="font-medium text-slate-900">{i.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{i.sku}{i.controlled ? " · controlled" : ""}{i.expiresAt ? ` · exp ${fmtDate(i.expiresAt)}` : ""}</div>
                    </td>
                    <td><span className={`chip ${colorForCategory(i.category)}`}>{CATEGORY_LABEL[i.category] || i.category}</span></td>
                    <td className="font-semibold">{i.quantityOnHand} <span className="text-xs text-slate-500">{i.unit}</span></td>
                    <td className="text-slate-600">{i.reorderLevel}</td>
                    <td className="text-slate-600">{fmtMoney(i.unitCostCents)}</td>
                    <td className="text-slate-600">{i.retailPriceCents > 0 ? fmtMoney(i.retailPriceCents) : "—"}</td>
                    <td className="text-xs text-slate-500">{i.location || "—"}</td>
                    <td>
                      <span className={`chip ${state.chip}`}>{state.label}</span>
                      {enabled && <InventoryAdjust itemId={i.id} unit={i.unit || "each"} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Recent stock movements</header>
          <ul className="divide-y divide-slate-100">
            {movements.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No movements recorded yet.</li>}
            {movements.map((m) => (
              <li key={m.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`chip ${m.quantity >= 0 ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>{m.quantity >= 0 ? `+${m.quantity}` : m.quantity}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{m.item.name}</div>
                  <div className="text-xs text-slate-500 truncate">{m.type}{m.reason ? ` · ${m.reason}` : ""}{m.actor ? ` · ${m.actor}` : ""}</div>
                </div>
                <div className="text-xs text-slate-400 whitespace-nowrap">{fmtRelative(m.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`card card-pad border-l-4 ${accent}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
