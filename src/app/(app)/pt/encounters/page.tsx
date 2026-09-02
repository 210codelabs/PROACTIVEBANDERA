import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import PtEncounters from "@/components/pt/PtEncounters";

export const dynamic = "force-dynamic";

export default async function PtEncountersPage() {
  const user = await requireSession();
  return (
    <Shell user={user}>
      <PtEncounters user={user} />
    </Shell>
  );
}
