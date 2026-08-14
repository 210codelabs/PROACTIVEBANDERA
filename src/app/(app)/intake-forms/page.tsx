import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import IntakeFormsClient from "./IntakeFormsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getSession();
  if (!user) redirect("/login");
  return (
    <Shell user={user}>
      <IntakeFormsClient />
    </Shell>
  );
}
