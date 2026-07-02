import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import BrandingManager from "@/components/admin/BrandingManager";
import { requireAdminSession } from "@/lib/admin/auth";
import { readAdminConfig } from "@/lib/admin/store";

export default async function AdminBrandingPage() {
  const user = await requireAdminSession();
  const config = await readAdminConfig();

  return (
    <Shell user={user} pageTitle="Admin · Branding">
      <div className="space-y-4">
        <AdminTabs active="/admin/branding" />
        <BrandingManager initialBranding={config.branding} />
      </div>
    </Shell>
  );
}
