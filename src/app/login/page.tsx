import LoginForm from "./LoginForm";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50">
      <div className="flex flex-col lg:flex-row min-h-screen">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 to-brand-800 text-white p-12 flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex mb-10">
              <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-20 sm:h-24 w-auto object-contain" />
            </Link>
            <h2 className="text-3xl font-bold mb-4">{t("login.welcomeBack")}</h2>
            <p className="text-brand-100 text-lg leading-relaxed">
              {t("login.welcomeDesc")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("landing.ecosystem")}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-brand-100">
              <svg className="w-5 h-5 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              {t("login.hipaa")}
            </div>
            <div className="flex items-center gap-3 text-sm text-brand-100">
              <svg className="w-5 h-5 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              {t("login.encrypted")}
            </div>
            <div className="flex items-center gap-3 text-sm text-brand-100">
              <svg className="w-5 h-5 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              {t("login.needHelp")}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md space-y-6">
            <div className="flex items-center justify-between">
              <div className="lg:hidden flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <img src="/pclinic-header.png?v=2" alt="Proactive Clinic" className="h-14 w-auto object-contain" />
                </Link>
              </div>
              <div className="ml-auto">
                <LanguageSwitcher />
              </div>
            </div>

            <div className="text-center lg:text-left">
              <h1 className="text-2xl font-bold text-slate-900">{t("login.staffSignIn")}</h1>
              <p className="text-sm text-slate-500 mt-1">{t("login.enterCreds")}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <LoginForm next={sp.next} />
            </div>

            <div className="text-center text-xs text-slate-400 space-y-1">
              <Link href="/" className="text-brand-700 hover:underline">{t("common.backHome")}</Link>
              <div>&copy; {t("login.footer")}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
