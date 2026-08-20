import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ErxBuilder from "./ErxBuilder";

export const dynamic = "force-dynamic";

export default async function ErxPage() {
  const user = await requireSession();
  const providerName = `${user.firstName} ${user.lastName}${user.credential ? ", " + user.credential : ""}`;
  return (
    <Shell user={user} pageTitle="eRx — E-Prescription" jellyBeans={<JellyBeans />}>
      <ErxBuilder providerName={providerName} />
    </Shell>
  );
}
