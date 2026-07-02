import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminAgentsConsole from "@/components/admin/AdminAgentsConsole";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAgentOpsSnapshot } from "@/lib/agentOps";

export default async function AdminAgentsPage() {
  const user = await requireAdminSession();
  const snapshot = await getAgentOpsSnapshot();

  return (
    <Shell user={user} pageTitle="Admin · Autonomous Agents">
      <div className="space-y-4">
        <AdminTabs active="/admin/agents" />
        <AdminAgentsConsole initialAgents={snapshot.agents} initialRuns={snapshot.runs} />
      </div>
    </Shell>
  );
}
