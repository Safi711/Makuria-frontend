import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Locale, t } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { LogoutButton } from "@/components/LogoutButton";

export async function Header({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = Boolean(data.user);

  const navItems: { href: string; label: string }[] = [
    { href: "/", label: t(locale, "navHome") },
    { href: "/laws", label: t(locale, "navLaws") },
    { href: "/cases", label: t(locale, "navCases") },
    { href: "/principles", label: t(locale, "navPrinciples") },
    { href: "/search", label: t(locale, "navSearch") },
  ];

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: "var(--mk-border)", background: "rgba(255,255,255,0.9)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold" style={{ color: "var(--mk-black)" }}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--mk-black)", border: "1px solid var(--mk-gold)" }}
          >
            م
          </span>
          {t(locale, "siteName")}
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[var(--mk-gold)]">
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
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "var(--mk-black)", border: "1px solid var(--mk-gold)" }}
              >
                {t(locale, "navWorkspace")}
              </Link>
              <LogoutButton locale={locale} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--mk-black)", border: "1px solid var(--mk-gold)" }}
            >
              {t(locale, "navLogin")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
