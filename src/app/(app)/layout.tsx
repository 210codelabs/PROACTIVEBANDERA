import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SessionGuard from "@/components/SessionGuard";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  return (
    <>
      <SessionGuard refreshUrl="/api/auth/refresh" logoutUrl="/api/auth/logout" redirectTo="/" />
      {children}
    </>
  );
}
