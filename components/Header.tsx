import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Locale, t } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { LogoutButton } from "@/components/LogoutButton";

export async function Header({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = Boolean(data.user);

  const navItems: { href: string; label: string; highlight?: boolean }[] = [
    { href: "/", label: t(locale, "navHome") },
    // ثانياً في الترتيب بطلب صافي: «هذا هو السبب، الموقع كله».
    // والعنوان يبقى /case-mapper ولا يتغيّر مع تغيّر الاسم المعروض،
    // فلا ينكسر رابط سبق أن شاركه أحد.
    { href: "/case-mapper", label: t(locale, "navAdvisor"), highlight: true },
    { href: "/laws", label: t(locale, "navLaws") },
    { href: "/cases", label: t(locale, "navCases") },
    { href: "/principles", label: t(locale, "navPrinciples") },
    { href: "/search", label: t(locale, "navSearch") },
  ];

  return (
    // The one place on the site whose background was hard-coded white rather
    // than inherited. Now navy, slightly deeper than the page so the bar
    // reads as chrome and not as another card. (Safi, 2026-09-29: the design
    // applies to every page.)
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: "var(--mk-border)", background: "rgba(9,20,43,0.92)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold" style={{ color: "var(--cm-text)" }}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
            style={{
              background: "rgba(228,193,67,0.12)",
              color: "var(--mk-gold-soft)",
              border: "1px solid rgba(228,193,67,0.5)",
            }}
          >
            م
          </span>
          {t(locale, "siteName")}
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-[var(--mk-gold)]"
              style={item.highlight ? { color: "var(--mk-gold)" } : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleToggle locale={locale} />
          {isAuthed ? (
            <>
              <Link
                href="/workspace"
                className="rounded-md px-3 py-1.5 text-xs font-bold"
                style={{ background: "var(--mk-gold)", color: "#071226" }}
              >
                {t(locale, "navWorkspace")}
              </Link>
              <LogoutButton locale={locale} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-xs font-bold"
              style={{ background: "var(--mk-gold)", color: "#071226" }}
            >
              {t(locale, "navLogin")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
