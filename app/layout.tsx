import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n-server";
import { dirFor, t } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GaScript } from "@/components/GaScript";

// NOTE: this build intentionally does not pull typefaces from
// next/font/google. The sandboxed dev container this was authored in has
// no outbound access to fonts.googleapis.com, so relying on it would make
// the build non-deterministic. Vercel's own build servers can reach
// Google Fonts fine, but the safer, CI-proof choice for a foundation
// phase is a system font stack (see globals.css) with a real webfont
// swap-in left as a follow-up once this is validated end-to-end.

export const metadata: Metadata = {
  title: "مكوريا — Makuria Legal Institute",
  description:
    "Sudanese legal intelligence platform — laws, judicial precedents, and legal principles with source verification.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2"
        >
          {t(locale, "navHome")}
        </a>
        <Header locale={locale} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
        <GaScript />
      </body>
    </html>
  );
}
