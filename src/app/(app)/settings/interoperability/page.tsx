import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import Link from "next/link";
import InteropAccessCenter from "@/components/interop/InteropAccessCenter";
import { getInteropSources } from "@/lib/interop/registry";

export default async function InteroperabilityPage() {
  const user = await requireSession();
  const sources = getInteropSources();
  return (
    <Shell user={user} pageTitle="Interoperability & Data Sources" jellyBeans={<JellyBeans />}>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Interoperability &amp; Data Source Access</h1>
        <p className="text-sm text-slate-500">Capacity to connect to state / federal / verified clinical data sources for new-patient enrichment (medications, allergies, provider data).</p>
      </div>
      <Link href="/settings/interoperability/pmp-kit" className="card card-pad mb-4 flex items-center justify-between gap-3 hover:ring-2 hover:ring-brand-200 transition group">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-900">Texas PMP Onboarding Kit</div>
            <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Ready to send</span>
          </div>
          <div className="text-sm text-slate-500">Get a checklist of exactly what to gather plus a ready-to-send request email to Bamboo Health to start Texas PMP (controlled-substance) integration.</div>
        </div>
        <span className="chip bg-brand-100 text-brand-800 ring-brand-200 group-hover:bg-brand-200">Open →</span>
      </Link>
      <InteropAccessCenter sources={sources} />
    </Shell>
  );
}
