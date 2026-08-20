import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import AnalyticsBoard from "@/components/analytics/AnalyticsBoard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  return (
    <Shell user={user} pageTitle="Analytics & Insights" jellyBeans={<JellyBeans />}>
      <AnalyticsBoard mode="dashboard" initialFrom={sp.from} initialTo={sp.to} />
    </Shell>
  );
}
