import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import PharmacyRoutingControls from "@/components/orders/PharmacyRoutingControls";
import { fmtMoney, fmtRelative } from "@/lib/utils";
import { ADDON_SERVICES } from "@/lib/modules";
import { readAdminConfig } from "@/lib/admin/store";

export default async function PharmacyPage() {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const dispensingEnabled = adminConfig.modules.integrations.pharmacyDispensing;
  const routingEnabled = adminConfig.modules.integrations.pharmacyRouting;

  let pendingRx: Array<{ id: string; patientId: string; itemName: string; rxStrength: string | null; rxSig: string | null; createdAt: Date; patient: { firstName: string; lastName: string }; provider: { firstName: string; lastName: string } }> = [];
  let sentRxCount = 0;
  let pendingRxCount = 0;
  let formulary: Array<{ id: string; name: string; strength: string | null; unit: string | null; quantityOnHand: number; reorderLevel: number; retailPriceCents: number; controlled: boolean }> = [];
  let pharmacies: Array<{ id: string; name: string; network: string; city: string | null; state: string | null; phone: string | null; hours: string | null; services: string | null; preferred: boolean }> = [];

  try {
    const [dbPending, dbSent, dbFormulary, dbPharmacies] = await Promise.all([
      db.order.findMany({ where: { type: "rx", status: "pending" }, include: { patient: true, provider: true }, orderBy: { createdAt: "desc" }, take: 25 }),
      db.order.count({ where: { type: "rx", status: "sent" } }),
      db.inventoryItem.findMany({ where: { active: true, category: "medication" }, orderBy: { name: "asc" } }),
      db.pharmacy.findMany({ where: { active: true }, orderBy: [{ preferred: "desc" }, { name: "asc" }], take: 12 }),
    ]);
    pendingRx = dbPending;
    pendingRxCount = dbPending.length;
    sentRxCount = dbSent;
    formulary = dbFormulary;
    pharmacies = dbPharmacies;
  } catch {
    // Keep the pharmacy workspace usable when data is briefly unavailable.
  }

  const lowFormulary = formulary.filter((m) => m.quantityOnHand <= m.reorderLevel);
  const pharmacyAddOns = ADDON_SERVICES.filter((s) => s.category === "pharmacy");

  return (
    <Shell user={user} pageTitle="Pharmacy" jellyBeans={<JellyBeans />}>
      <div className="space-y-4">
        {!dispensingEnabled && (
          <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
            The pharmacy dispensing workspace is currently paused in Admin → Operational Modules.
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Pending Rx" value={String(pendingRxCount)} accent="border-l-amber-500" />
          <Stat label="Sent Rx" value={String(sentRxCount)} accent="border-l-emerald-500" />
          <Stat label="Formulary items" value={String(formulary.length)} accent="border-l-teal-500" />
          <Stat label="Network pharmacies" value={String(pharmacies.length)} accent="border-l-brand-500" />
        </section>

        {/* E-prescribe routing */}
        <section className="card card-pad border-l-4 border-l-teal-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">E-prescribe routing</div>
              <div className="font-semibold text-slate-900">{routingEnabled ? "Search the pharmacy network and route pending prescriptions." : "E-prescribe routing is currently disabled by admin controls."}</div>
              <div className="mt-1 text-xs text-slate-600">Connected to the Surescripts / Availity pharmacy directory for outbound prescriptions.</div>
            </div>
            <span className={`chip ${routingEnabled ? "bg-teal-100 text-teal-800 ring-teal-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Surescripts / Availity</span>
          </div>
          {routingEnabled ? (
            <PharmacyRoutingControls pendingRxCount={pendingRxCount} />
          ) : (
            <div className="mt-3 text-xs text-slate-600">Enable Pharmacy e-prescribe routing in Admin Operational Settings to activate this flow.</div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pending queue */}
          <section className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <span className="font-semibold text-slate-900">Prescription queue</span>
              <Link href="/orders?type=rx" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200 ml-auto">All Rx orders</Link>
            </header>
            <ul className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {pendingRx.length === 0 && <li className="px-4 py-8 text-center text-slate-500">No prescriptions awaiting routing.</li>}
              {pendingRx.map((rx) => (
                <li key={rx.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/patients/${rx.patientId}`} className="font-medium text-brand-700 hover:underline">{rx.patient.lastName}, {rx.patient.firstName}</Link>
                    <span className="text-xs text-slate-400">{fmtRelative(rx.createdAt)}</span>
                  </div>
                  <div className="text-slate-900">{rx.itemName}{rx.rxStrength ? ` ${rx.rxStrength}` : ""}</div>
                  <div className="text-xs text-slate-500 truncate">{rx.rxSig || "—"} · {rx.provider.firstName} {rx.provider.lastName}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* In-house dispensary */}
          <section className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <span className="font-semibold text-slate-900">In-house dispensary</span>
              <Link href="/inventory?category=medication" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200 ml-auto">Manage stock</Link>
            </header>
            {lowFormulary.length > 0 && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                {lowFormulary.length} medication(s) at or below reorder level.
              </div>
            )}
            <ul className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {formulary.length === 0 && <li className="px-4 py-8 text-center text-slate-500">No dispensary medications stocked.</li>}
              {formulary.map((m) => {
                const low = m.quantityOnHand <= m.reorderLevel;
                return (
                  <li key={m.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{m.name}{m.controlled ? <span className="ml-1 text-[10px] text-rose-600 font-semibold">CTRL</span> : null}</div>
                      <div className="text-xs text-slate-500">{m.retailPriceCents > 0 ? fmtMoney(m.retailPriceCents) : "—"} · {m.quantityOnHand} {m.unit} on hand</div>
                    </div>
                    <span className={`chip ${low ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-emerald-100 text-emerald-800 ring-emerald-200"}`}>{low ? "Reorder" : "In stock"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Pharmacy directory */}
        <section className="card overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Pharmacy network directory</header>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pharmacies.length === 0 && <div className="col-span-full text-center text-slate-500 py-6">Directory unavailable.</div>}
            {pharmacies.map((p) => (
              <div key={p.id} className="rounded-lg ring-1 ring-slate-200 p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  {p.preferred && <span className="chip bg-teal-100 text-teal-800 ring-teal-200">preferred</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500">{[p.city, p.state].filter(Boolean).join(", ")}{p.phone ? ` · ${p.phone}` : ""}</div>
                <div className="text-xs text-slate-500">{p.hours || ""}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{p.network}</span>
                  {(p.services || "").split(",").filter(Boolean).slice(0, 3).map((s) => (
                    <span key={s} className="chip bg-slate-100 text-slate-600 ring-slate-200">{s.trim()}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Add-on services */}
        <section className="card overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Pharmacy add-on services</header>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {pharmacyAddOns.map((s) => (
              <div key={s.code} className="rounded-lg ring-1 ring-slate-200 p-3 bg-white">
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.blurb}</div>
              </div>
            ))}
          </div>
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
