import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  return <>{children}</>;
}
