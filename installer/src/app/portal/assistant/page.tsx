import PortalAssistantChat from "@/components/portal/PortalAssistantChat";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalSession } from "@/lib/portalAuth";

export default async function PortalAssistantPage() {
  const session = await requirePortalSession();

  return (
    <PortalShell session={session} active="/portal/assistant">
      <PortalAssistantChat />
    </PortalShell>
  );
}
