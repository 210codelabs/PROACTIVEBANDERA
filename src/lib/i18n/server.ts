import { cookies } from "next/headers";
import { dictionaries, resolveKey, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const value = c.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT(): Promise<{ locale: Locale; t: (key: string) => string; m: Dictionary }> {
  const locale = await getLocale();
  const m = dictionaries[locale];
  return {
    locale,
    m,
    t: (key: string) => resolveKey(m, key),
  };
}
