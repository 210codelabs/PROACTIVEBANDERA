import { cookies } from "next/headers";
import BookClient from "@/components/BookClient";
import { LOCALE_COOKIE, isLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

// PUBLIC scheduling page (no auth required). Bilingual EN/ES.
export default async function BookPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const sp = await searchParams;
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const initialLang = isLocale(raw) ? raw : DEFAULT_LOCALE;
  return <BookClient initialLang={initialLang} initialLocation={sp?.location || ""} />;
}
