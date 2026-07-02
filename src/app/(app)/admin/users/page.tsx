import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminUsersManager from "@/components/admin/AdminUsersManager";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export default async function AdminUsersPage() {
  const user = await requireAdminSession();
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      credential: true,
      specialty: true,
      npi: true,
      active: true,
      createdAt: true,
    },
  });

  return (
    <Shell user={user} pageTitle="Admin · User Management">
      <div className="space-y-4">
        <AdminTabs active="/admin/users" />
        <AdminUsersManager
          initialUsers={users.map((u) => ({
            ...u,
            role: u.role as "provider" | "nurse" | "frontdesk" | "billing" | "admin",
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </Shell>
  );
}
