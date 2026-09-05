import { Locale, t } from "@/lib/i18n";

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-auto border-t py-8 text-sm" style={{ borderColor: "var(--mk-border)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-2 font-semibold">{t(locale, "siteName")}</p>
        <p className="mb-4 max-w-2xl text-neutral-500">{t(locale, "siteTagline")}</p>
        <p className="mb-4 max-w-2xl text-xs text-neutral-400">{t(locale, "footerNotice")}</p>
        <p className="text-xs text-neutral-400">
          © {new Date().getFullYear()} {t(locale, "siteName")} — {t(locale, "footerRights")}
        </p>
      </div>
    </footer>
  );
}
