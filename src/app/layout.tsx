import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import FloatingAssistantWidget from "@/components/FloatingAssistantWidget";
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
  title: "Proactive Clinic | PMR, Wound Care, Aesthetics & Primary Care in Miami",
  description:
    "Proactive Clinic offers physical medicine & rehabilitation, wound care, aesthetic medicine, primary care, and in-house pharmacy services in Miami, FL. Now accepting new patients.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${manrope.variable} ${sora.variable}`}>
        <I18nProvider initialLocale={locale}>
          {children}
          <FloatingAssistantWidget />
        </I18nProvider>
      </body>
    </html>
  );
}
