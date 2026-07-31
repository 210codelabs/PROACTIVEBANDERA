import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import FloatingAssistantWidget from "@/components/FloatingAssistantWidget";
import CookieConsent from "@/components/CookieConsent";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLocale } from "@/lib/i18n/server";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Proactive Clinic | Primary Care, Rehab, Pain Management & Wellness in San Antonio",
  description:
    "Proactive Clinic offers primary & preventive care, physical rehabilitation, pain management, wellness & recovery, chronic condition monitoring, and telehealth in San Antonio, TX. Now accepting new patients. A Division of Proactive UMS Inc.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${manrope.variable} ${sora.variable}`}>
        <I18nProvider initialLocale={locale}>
          {children}
          <FloatingAssistantWidget />
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
