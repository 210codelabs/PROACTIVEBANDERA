import { readAdminConfig } from "@/lib/admin/store";
import LandingClient from "@/components/landing/LandingClient";
import { getSession } from "@/lib/auth";
import { getPortalSession } from "@/lib/portalAuth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = sp.tab === "ehr" ? "ehr" : "patient";

  // If already logged in as provider, redirect to provider dashboard
  const user = await getSession();
  if (user) {
    redirect("/dashboard");
  }

  // If already logged in as patient, redirect to patient dashboard
  const portalUser = await getPortalSession();
  if (portalUser) {
    redirect("/portal/dashboard");
  }

  const config = await readAdminConfig();
  const { branding, landing, org } = config;

  return (
    <LandingClient branding={branding} landing={landing} org={org} initialTab={initialTab} />
  );
}
