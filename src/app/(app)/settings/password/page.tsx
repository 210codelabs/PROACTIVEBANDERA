import { requireSession, roleLabel } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function PasswordSettings() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Change password" jellyBeans={<JellyBeans />}>
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="font-semibold text-slate-900">Change my password</div>
          <div className="text-sm text-slate-500">Signed in as {user.firstName} {user.lastName} · {user.email} · {roleLabel(user.role)}</div>
        </header>
        <div className="p-4">
          <ChangePasswordForm />
        </div>
      </section>
    </Shell>
  );
}
