import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import WenoRxLogFrame from "@/components/erx/WenoRxLogFrame";

export const dynamic = "force-dynamic";

export default async function WenoRxLogPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Weno Rx Log">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">On-demand view of prescriptions sent through Weno Online.</span>
        <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">← Back to dashboard</Link>
      </div>
      <WenoRxLogFrame />
    </Shell>
  );
}
