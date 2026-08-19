import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import Link from "next/link";
import PmpOnboardingKit from "@/components/interop/PmpOnboardingKit";

export default async function PmpKitPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Texas PMP Onboarding Kit" jellyBeans={<JellyBeans />}>
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Texas PMP — Onboarding Kit</h1>
          <p className="text-sm text-slate-500">Everything to request access to the Texas Prescription Monitoring Program (controlled substances) via Bamboo Health PMP Gateway.</p>
        </div>
        <Link href="/settings/interoperability" className="chip bg-slate-100 text-slate-700 ring-slate-200">← Back to Access Center</Link>
      </div>
      <PmpOnboardingKit />
    </Shell>
  );
}
