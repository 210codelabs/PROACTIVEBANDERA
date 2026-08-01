"use client";

import { useI18n } from "./I18nProvider";
import { LOCALES, type Locale } from "@/lib/i18n/config";

export default function LanguageSwitcher({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const { locale, setLocale } = useI18n();

  const base =
    tone === "dark"
      ? "border-white/20 bg-white/10"
      : "border-slate-200 bg-white/80";

  return (
    <div
      data-testid="language-switcher"
      className={`inline-flex items-center rounded-full border p-0.5 text-xs font-semibold ${base} ${className}`}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => {
        const activeClass = tone === "dark" ? "bg-white text-slate-900" : "bg-teal-600 text-white";
        const idleClass = tone === "dark" ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-teal-700";
        return (
          <button
            key={l}
            type="button"
            data-testid={`lang-${l}`}
            aria-pressed={locale === l}
            onClick={() => setLocale(l as Locale)}
            className={`px-2.5 py-1 rounded-full transition ${locale === l ? activeClass : idleClass}`}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
