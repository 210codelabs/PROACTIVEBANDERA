import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import CasualtyPayers from "@/components/pt/CasualtyPayers";

export const dynamic = "force-dynamic";

export default async function CasualtyPayersPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Auto / PIP Casualty Payers">
      <div className="mb-3">
        <Link href="/pt" className="text-sm text-brand-700 hover:underline">← Back to Physical Rehab</Link>
      </div>
      <CasualtyPayers />
    </Shell>
  );
}
