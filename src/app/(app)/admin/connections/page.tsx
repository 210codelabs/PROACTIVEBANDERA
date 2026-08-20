import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ConnectionsClient from "./ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <Shell user={user} pageTitle="Connection Health" jellyBeans={<JellyBeans />}>
      <ConnectionsClient />
    </Shell>
  );
}
