import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import FloatingAssistantWidget from "@/components/FloatingAssistantWidget";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ProactiveClinics EHR",
  description: "ProactiveClinics Electronic Health Records",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>
        {children}
        <FloatingAssistantWidget />
      </body>
    </html>
  );
}
