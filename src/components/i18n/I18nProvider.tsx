"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dictionaries, resolveKey, type Dictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

type I18nCtx = {
  locale: Locale;
  t: (key: string) => string;
  m: Dictionary;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nCtx>(() => {
    const m = dictionaries[locale];
    return { locale, m, t: (key: string) => resolveKey(m, key), setLocale };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const m = dictionaries[DEFAULT_LOCALE];
  return { locale: DEFAULT_LOCALE, m, t: (key: string) => resolveKey(m, key), setLocale: () => {} };
}
