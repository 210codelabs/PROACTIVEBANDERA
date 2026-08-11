import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import { requireAdminSession } from "@/lib/admin/auth";
import DataTools from "@/components/admin/DataTools";

export default async function DataToolsPage() {
  const user = await requireAdminSession();
  return (
    <Shell user={user} pageTitle="Data Tools">
      <div className="space-y-4">
        <AdminTabs active="/admin/data-tools" />
        <DataTools />
      </div>
    </Shell>
  );
}
