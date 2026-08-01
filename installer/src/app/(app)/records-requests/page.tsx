import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import RecordRequestsManager from "@/components/RecordRequestsManager";

export default async function RecordRequestsPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Attorney Record Requests">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">Attorney Record Requests</h1>
        <p className="text-sm text-slate-500">Review and approve authorized attorney requests for patient records. Approved requests can be downloaded by the attorney from their portal.</p>
      </div>
      <RecordRequestsManager />
    </Shell>
  );
}
