import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

// Split out from lib/i18n.ts because it imports next/headers, which is
// invalid inside any module that a Client Component also imports from
// (e.g. LocaleToggle, LogoutButton). Server Components/pages import
// getLocale from here; everything else (t, dirFor, dictionaries) comes
// from the plain lib/i18n.ts.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
