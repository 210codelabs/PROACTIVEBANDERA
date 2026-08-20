import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ErxBuilder from "./ErxBuilder";

export const dynamic = "force-dynamic";

export default async function ErxPage() {
  const user = await requireSession();
  const providerName = `${user.firstName} ${user.lastName}${user.credential ? ", " + user.credential : ""}`;
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { npi: true, dea: true } }).catch(() => null);
  return (
    <Shell user={user} pageTitle="eRx — E-Prescription" jellyBeans={<JellyBeans />}>
      <ErxBuilder providerName={providerName} defaultNpi={dbUser?.npi || ""} defaultDea={dbUser?.dea || ""} />
    </Shell>
  );
}
