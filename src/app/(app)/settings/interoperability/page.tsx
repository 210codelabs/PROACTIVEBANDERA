import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
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
      <InteropAccessCenter sources={sources} />
    </Shell>
  );
}
