import Shell from "@/components/Shell";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getStediConfig } from "@/lib/stedi";
import RevenueCycle from "@/components/billing/RevenueCycle";

export const dynamic = "force-dynamic";

export default async function RevenueCyclePage() {
  const user = await requireSession();
  const stedi = await getStediConfig();
  return (
    <Shell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Revenue Cycle</h1>
          <p className="text-sm text-slate-500">Payers, enrollment, fee schedule, claims and payment tracking via Stedi.</p>
        </div>
        <Link href="/billing" className="btn-secondary">Back to Billing</Link>
      </div>
      <div className="card card-pad">
        <RevenueCycle configured={Boolean(stedi.enabled && stedi.apiKey)} defaultPayerId={stedi.defaultPayerId} />
      </div>
    </Shell>
  );
}
