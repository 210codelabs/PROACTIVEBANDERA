import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import AttorneyManager from "@/components/AttorneyManager";

export default async function AttorneysPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Attorney Accounts">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">Attorney Accounts</h1>
        <p className="text-sm text-slate-500">Create authorized attorney logins for the Attorney Portal, reset their access codes, and enable or disable access.</p>
      </div>
      <AttorneyManager />
    </Shell>
  );
}
