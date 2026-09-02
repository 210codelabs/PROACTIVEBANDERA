import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import CredentialingBoard from "@/components/admin/CredentialingBoard";

export const dynamic = "force-dynamic";

export default async function CredentialingPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Credentialing">
      <CredentialingBoard />
    </Shell>
  );
}
