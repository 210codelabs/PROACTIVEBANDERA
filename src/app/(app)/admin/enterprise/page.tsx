import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import EnterpriseAdmin from "./EnterpriseAdmin";
import { SERVICE_CATALOG } from "@/lib/enterprise/catalog";

export const dynamic = "force-dynamic";

export default async function EnterpriseAdminPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <Shell user={user} pageTitle="Enterprise Clients" jellyBeans={<JellyBeans />}>
      <EnterpriseAdmin catalog={SERVICE_CATALOG} />
    </Shell>
  );
}
