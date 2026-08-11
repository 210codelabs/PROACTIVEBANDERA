import Link from "next/link";
import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import BankEft from "@/components/billing/BankEft";

export default async function BankEftPage() {
  const user = await requireSession();
  const allowed = ["admin", "billing"].includes(user.role);
  return (
    <Shell user={user} pageTitle="Bank & EFT setup" jellyBeans={<JellyBeans />}>
      <div className="mb-3 flex items-center gap-2">
        <Link href="/billing" className="btn-secondary text-sm">← Billing</Link>
        <Link href="/billing/revenue-cycle" className="btn-secondary text-sm">Revenue Cycle →</Link>
      </div>
      {allowed ? (
        <BankEft />
      ) : (
        <div className="card card-pad border-rose-200 bg-rose-50 text-rose-900">Access denied — Bank &amp; EFT setup is limited to admin and billing roles.</div>
      )}
    </Shell>
  );
}
