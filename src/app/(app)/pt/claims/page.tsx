import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import PtClaims from "@/components/pt/PtClaims";

export const dynamic = "force-dynamic";

export default async function PtClaimsPage() {
  const user = await requireSession();
  return (
    <Shell user={user}>
      <PtClaims />
    </Shell>
  );
}
