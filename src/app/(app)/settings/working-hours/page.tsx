import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import WorkingHoursEditor from "@/components/settings/WorkingHoursEditor";

export const dynamic = "force-dynamic";

export default async function WorkingHoursPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Working Hours">
      <div className="mb-3">
        <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Back to Settings</Link>
      </div>
      <section className="card card-pad">
        <h1 className="text-lg font-bold text-slate-900">Working Hours & Days</h1>
        <p className="text-sm text-slate-500 mb-4">Set the days and hours you (or, as an admin, any provider) are available for appointments. The scheduler uses this for click-to-create, drag auto-shift and slot suggestions.</p>
        <WorkingHoursEditor />
      </section>
    </Shell>
  );
}
