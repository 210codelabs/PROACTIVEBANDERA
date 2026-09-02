import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import PtFeeSchedule from "@/components/pt/PtFeeSchedule";

export const dynamic = "force-dynamic";

export default async function PtFeesPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="PT Fee Schedule">
      <div className="mb-3">
        <Link href="/pt" className="text-sm text-brand-700 hover:underline">← Back to Physical Rehab</Link>
      </div>
      <PtFeeSchedule />
    </Shell>
  );
}
