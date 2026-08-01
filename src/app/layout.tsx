import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import FloatingAssistantWidget from "@/components/FloatingAssistantWidget";
import CookieConsent from "@/components/CookieConsent";
import BackToTop from "@/components/BackToTop";
import PWAController from "@/components/PWAController";
import ThemeStyle from "@/components/ThemeStyle";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLocale } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site/config";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteConfig();
  const name = c.identity.clinicName;
  const loc = [c.identity.city, c.identity.state].filter(Boolean).join(", ");
  return {
    title: `${name}${loc ? ` | ${loc}` : ""}`,
    description:
      `${name} — ${c.identity.tagline}. ${c.identity.division}`.trim(),
    manifest: "/manifest.webmanifest",
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const c = await getSiteConfig();
  return { themeColor: c.colors.secondary };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${manrope.variable} ${sora.variable}`}>
        <ThemeStyle />
        <I18nProvider initialLocale={locale}>
          {children}
          <FloatingAssistantWidget />
          <CookieConsent />
          <BackToTop />
          <PWAController />
        </I18nProvider>
      </body>
    </html>
  );
}
