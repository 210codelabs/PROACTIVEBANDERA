import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site/config";
import SetupWizard from "@/components/setup/SetupWizard";

export const dynamic = "force-dynamic";

// Admin-gated first-run (and re-editable) branding/setup wizard. Any staff can
// be redirected here before setup completes; only admins may run it.
export default async function SetupPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  const config = await getSiteConfig();
  return <SetupWizard initial={JSON.parse(JSON.stringify(config))} />;
}
