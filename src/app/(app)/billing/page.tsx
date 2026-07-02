import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtDateTime, fmtMoney } from "@/lib/utils";
import { canRoleAccess, readAdminConfig } from "@/lib/admin/store";

export default async function BillingPage() {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const canViewBilling = !adminConfig.modules.enforceRoleAccess || canRoleAccess(adminConfig, user.role, "billingRead");

  if (!canViewBilling) {
    return (
      <Shell user={user} pageTitle="Billing" jellyBeans={<JellyBeans />}>
        <div className="card card-pad border-rose-200 bg-rose-50 text-rose-900">
          Access denied. Your role does not currently have billing access.
        </div>
      </Shell>
    );
  }

  let enc: Array<{
    id: string;
    patientId: string;
    startedAt: Date;
    status: string;
    patient: { firstName: string; lastName: string };
    provider: { firstName: string; lastName: string };
    diagnoses: Array<{ icd10: string }>;
    charges: Array<{ cpt: string; feeCents: number; units: number }>;
  }> = [];
  let dataUnavailable = false;

  try {
    enc = await db.encounter.findMany({
      where: { charges: { some: {} } },
      include: { patient: true, provider: true, charges: true, diagnoses: true },
      orderBy: { startedAt: "desc" },
      take: 200,
    });
  } catch {
    dataUnavailable = true;
  }

  const grand = enc.flatMap(e => e.charges).reduce((s, c) => s + c.feeCents * c.units, 0);
  const signedTotal = enc.filter(e => e.status === "signed").flatMap(e => e.charges).reduce((s, c) => s + c.feeCents * c.units, 0);
  const draftTotal = enc.filter(e => e.status !== "signed").flatMap(e => e.charges).reduce((s, c) => s + c.feeCents * c.units, 0);

  return (
    <Shell user={user} pageTitle="Billing" jellyBeans={<JellyBeans />}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Billing data is temporarily unavailable. Totals are showing fallback values.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Stat label="Total billed" value={fmtMoney(grand)} accent="brand" />
        <Stat label="Ready to submit (signed)" value={fmtMoney(signedTotal)} accent="emerald" />
        <Stat label="Draft / unsigned" value={fmtMoney(draftTotal)} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <section className="card card-pad space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Superbill submission</h2>
            <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Ready</span>
          </div>
          <p className="text-sm text-slate-600">How to send the superbill from this screen:</p>
          <ol className="list-decimal ml-5 text-sm text-slate-600 space-y-1">
            <li>Filter to signed encounters and verify ICD-10/CPT combinations.</li>
            <li>Confirm rendering provider and patient subscriber details.</li>
            <li>Export or transmit the compiled superbill batch to your clearinghouse.</li>
          </ol>
        </section>

        <section className="card card-pad space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Availity integration</h2>
            <span className="chip bg-brand-100 text-brand-800 ring-brand-200">Enabled</span>
          </div>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>Eligibility checks route through Availity for insured and workers comp cases.</li>
            <li>Claim submission path is configured for Availity billing workflows.</li>
          </ul>
        </section>
      </div>

      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Encounters with charges</header>
        <table className="data">
          <thead><tr><th>Date</th><th>Patient</th><th>Provider</th><th>Dx</th><th>CPT</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {enc.map(e => {
              const total = e.charges.reduce((s, c) => s + c.feeCents * c.units, 0);
              return (
                <tr key={e.id}>
                  <td className="text-xs">{fmtDateTime(e.startedAt)}</td>
                  <td><Link href={`/patients/${e.patientId}`} className="text-brand-700 hover:underline">{e.patient.lastName}, {e.patient.firstName}</Link></td>
                  <td className="text-xs">{e.provider.firstName} {e.provider.lastName}</td>
                  <td className="text-xs">{e.diagnoses.map(d => d.icd10).join(", ") || "—"}</td>
                  <td className="text-xs">{e.charges.map(c => c.cpt).join(", ")}</td>
                  <td className="font-semibold">{fmtMoney(total)}</td>
                  <td><span className={`chip ${e.status === "signed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{e.status}</span></td>
                </tr>
              );
            })}
            {enc.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-10">No charges yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "brand" | "emerald" | "amber" }) {
  const grad = { brand: "from-brand-100", emerald: "from-emerald-100", amber: "from-amber-100" }[accent];
  return (
    <div className={`card card-pad bg-gradient-to-br ${grad} to-white`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
