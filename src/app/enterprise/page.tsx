import { requireEnterpriseSession } from "@/lib/enterpriseAuth";
import EnterpriseDashboard from "./EnterpriseDashboard";
import { SERVICE_CATALOG } from "@/lib/enterprise/catalog";

export const dynamic = "force-dynamic";

export default async function EnterpriseHome() {
  const s = await requireEnterpriseSession();
  return <EnterpriseDashboard session={s} catalog={SERVICE_CATALOG} />;
}
