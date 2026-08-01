export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "proactive_locale";

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "en" || v === "es";
}
