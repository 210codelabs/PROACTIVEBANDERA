import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminRolesManager from "@/components/admin/AdminRolesManager";
import { requireAdminSession } from "@/lib/admin/auth";
import { readAdminConfig } from "@/lib/admin/store";

export default async function AdminRolesPage() {
  const user = await requireAdminSession();
  const config = await readAdminConfig();

  return (
    <Shell user={user} pageTitle="Admin · Roles and Permissions">
      <div className="space-y-4">
        <AdminTabs active="/admin/roles" />
        <AdminRolesManager initialRoles={config.roles} />
      </div>
    </Shell>
  );
}
