import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import IntakeInboxClient from "./IntakeInboxClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getSession();
  if (!user) redirect("/login");
  return (
    <Shell user={user}>
      <IntakeInboxClient />
    </Shell>
  );
}
