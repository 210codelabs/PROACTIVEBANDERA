import Shell from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import ChartingSettings from "@/components/settings/ChartingSettings";

export const dynamic = "force-dynamic";

export default async function ChartingSettingsPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Charting Setup">
      <div className="p-4">
        <p className="text-sm text-slate-500 mb-4">Configure the chart note formats and encounter types your practice uses. Defaults are applied automatically when a new encounter is started.</p>
        <ChartingSettings />
      </div>
    </Shell>
  );
}
