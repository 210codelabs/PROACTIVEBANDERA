import Shell from "@/components/Shell";
import Link from "next/link";
import AdminTabs from "@/components/admin/AdminTabs";
import { requireAdminSession } from "@/lib/admin/auth";
import ApiClientsManager from "@/components/admin/ApiClientsManager";
import { SCOPES } from "@/lib/api/scopes";

export const dynamic = "force-dynamic";

export default async function AdminApiPage() {
  const user = await requireAdminSession();
  return (
    <Shell user={user} pageTitle="API & Integrations">
      <div className="space-y-4">
        <AdminTabs active="/admin/api" />
        <section className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Integration API</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Issue API keys so external apps (for example a remote behavioral-health platform)
                can securely read and write ProactiveClinics data over the public API. Each key is
                granted only the scopes you choose.
              </p>
            </div>
            <Link
              href="/admin/api/docs"
              prefetch={false}
              className="px-3 py-2 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-700"
            >
              View API Reference →
            </Link>
          </div>
        </section>

        <ApiClientsManager allScopes={SCOPES} />
      </div>
    </Shell>
  );
}
