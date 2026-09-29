import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

/**
 * The dark ground, the card and the footnote shared by /login and /signup —
 * the same navy-and-gold identity as «المستشار القانوني الذكي», declared the
 * same way: CSS variables on this element only. No global stylesheet is
 * touched, so no other page changes. (Safi, 2026-09-28: «لا تغيير في تصميم
 * الموقع» — the site keeps its look; these two pages were asked for by name.)
 *
 * The footnote is not decoration. Before this, an unsigned visitor who landed
 * on /login had no way of knowing that the laws, the precedents, the search
 * and the advisor are all open without an account — the page read as a wall
 * across the whole site. Now it says so, and links straight through.
 */
export function AuthShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full items-start justify-center px-4 py-12 sm:py-20"
      style={
        {
          background: "var(--cm-bg)",
          color: "var(--cm-text)",
          "--cm-bg": "#0A1A2F",
          "--cm-surface": "#102843",
          "--cm-surface-2": "#0C2138",
          "--cm-line": "#1F3A5A",
          "--cm-text": "#E9EDF3",
          "--cm-text-2": "#C6D2E0",
          "--cm-muted": "#94A6BC",
          "--cm-faint": "#7A8CA3",
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold"
            style={{
              background: "rgba(201,162,39,0.12)",
              color: "var(--mk-gold-soft)",
              border: "1px solid rgba(201,162,39,0.5)",
            }}
          >
            م
          </span>
          <span className="text-lg font-bold">{t(locale, "siteName")}</span>
        </div>

        <section
          className="rounded-2xl border p-6 sm:p-8"
          style={{ background: "var(--cm-surface)", borderColor: "var(--cm-line)" }}
        >
          {children}
        </section>

        <div
          className="mt-5 rounded-2xl border p-4 text-center"
          style={{ borderColor: "var(--cm-line)", background: "rgba(16,40,67,0.55)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--cm-muted)" }}>
            {t(locale, "authPublicNote")}
          </p>
          <Link
            href="/case-mapper"
            className="mt-2 inline-block text-sm font-medium hover:underline"
            style={{ color: "var(--mk-gold-soft)" }}
          >
            {/* The arrow points the way the language reads: left in Arabic,
                right in English. A hard-coded «←» pointed backwards for the
                English visitor. */}
            {t(locale, "authPublicCta")} {locale === "ar" ? "←" : "→"}
          </Link>
        </div>
      </div>
    </div>
  );
}
