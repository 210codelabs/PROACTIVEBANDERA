import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";
import MyProfileForm from "@/components/settings/MyProfileForm";

export const dynamic = "force-dynamic";

export default async function MyProviderProfilePage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="My Provider Profile">
      <div className="mb-3">
        <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Back to Settings</Link>
      </div>
      <section className="card card-pad">
        <h1 className="text-lg font-bold text-slate-900">My Provider Profile</h1>
        <p className="text-sm text-slate-500 mb-4">Your credentialing details. NPI and state license are stamped onto PT/PI notes you sign and used as the rendering provider on PT claims.</p>
        <MyProfileForm />
      </section>
    </Shell>
  );
}
