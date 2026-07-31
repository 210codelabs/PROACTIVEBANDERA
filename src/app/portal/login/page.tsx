import { redirect } from "next/navigation";
import Link from "next/link";
import { getPortalSession } from "@/lib/portalAuth";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { PortalAccess, Footer } from "@/app/page";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const session = await getPortalSession();
  if (session) redirect("/portal/dashboard");
  const { t, m } = await getT();
  const L = m.landing;

  return (
    <main className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img src="/pclinic-header.png?v=2" alt="Proactive Clinic" className="h-16 sm:h-20 w-auto object-contain" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher className="mr-1" />
              <Link
                href="/"
                className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-brand-700 transition px-3 py-1.5"
              >
                {t("common.backHome")}
              </Link>
              <Link href="/login" className="btn-secondary text-sm">{L.staffLogin}</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Patient Portal access — instructions + sign-in (preserved from the landing) */}
      <div className="flex-1">
        <PortalAccess L={L} t={t} />
      </div>

      <Footer L={L} />
    </main>
  );
}
