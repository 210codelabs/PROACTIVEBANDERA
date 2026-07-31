import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import LandingManager from "@/components/admin/LandingManager";
import { requireAdminSession } from "@/lib/admin/auth";
import { readAdminConfig } from "@/lib/admin/store";

export default async function AdminLandingPage() {
  const user = await requireAdminSession();
  const config = await readAdminConfig();

  return (
    <Shell user={user} pageTitle="Admin · Landing Page">
      <div className="space-y-4">
        <AdminTabs active="/admin/landing" />
        <LandingManager initialLanding={config.landing} />
      </div>
    </Shell>
  );
}
