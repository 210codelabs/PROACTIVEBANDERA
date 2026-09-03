import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import WaitlistManager from "@/components/WaitlistManager";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Waitlist">
      <div className="mb-3">
        <Link href="/schedule" className="text-sm text-brand-700 hover:underline">← Back to Schedule</Link>
      </div>
      <WaitlistManager />
    </Shell>
  );
}
