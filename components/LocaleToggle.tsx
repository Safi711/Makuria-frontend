"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n";

export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const other: Locale = locale === "ar" ? "en" : "ar";

  function switchLocale() {
    document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <button
      onClick={switchLocale}
      className="rounded-md border px-2.5 py-1 text-xs font-medium hover:border-[var(--mk-gold)]"
      style={{ borderColor: "var(--mk-border)" }}
      aria-label="Switch language"
    >
      {other === "ar" ? "العربية" : "English"}
    </button>
  );
}
