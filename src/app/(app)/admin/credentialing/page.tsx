import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import CredentialingBoard from "@/components/admin/CredentialingBoard";
import CredentialingGate from "@/components/admin/CredentialingGate";

export const dynamic = "force-dynamic";

export default async function CredentialingPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Credentialing">
      <CredentialingGate>
        <CredentialingBoard />
      </CredentialingGate>
    </Shell>
  );
}
