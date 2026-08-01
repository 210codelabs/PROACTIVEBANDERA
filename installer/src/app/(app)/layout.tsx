import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site/config";
import SessionGuard from "@/components/SessionGuard";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  // First-run onboarding: send admins to the branding/setup wizard until the
  // deployment has been configured. Other staff can keep working meanwhile.
  const site = await getSiteConfig();
  if (!site.setupComplete && user.role === "admin") redirect("/setup");
  return (
    <>
      <SessionGuard refreshUrl="/api/auth/refresh" logoutUrl="/api/auth/logout" redirectTo="/" />
      {children}
    </>
  );
}
