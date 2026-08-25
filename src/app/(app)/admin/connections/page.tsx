import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ProviderIntegrations from "@/components/admin/ProviderIntegrations";
import WenoDirectorySync from "@/components/admin/WenoDirectorySync";
import { readIntegrationsForClient } from "@/lib/integrations/store";
import ConnectionsClient from "./ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  const integrations = await readIntegrationsForClient();
  return (
    <Shell user={user} pageTitle="Connection Health" jellyBeans={<JellyBeans />}>
      <div className="space-y-6">
        <section>
          <h2 className="text-base font-semibold text-slate-900">Live status</h2>
          <ConnectionsClient />
        </section>
        <section>
          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-base font-semibold text-slate-900">Edit &amp; save configuration</h2>
            <p className="text-sm text-slate-500 mb-3">Update API keys, credentials, and enable/disable each integration. Changes save to the platform and take effect immediately for new requests.</p>
            <ProviderIntegrations initialState={integrations} />
          </div>
        </section>
        <section>
          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">E-Prescribing directory</h2>
            <WenoDirectorySync />
          </div>
        </section>
      </div>
    </Shell>
  );
}
