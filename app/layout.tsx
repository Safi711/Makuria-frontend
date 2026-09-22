import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n-server";
import { dirFor, t } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GaScript } from "@/components/GaScript";
import { SITE_NAME_AR, SITE_URL } from "@/lib/site";

// NOTE: this build intentionally does not pull typefaces from
// next/font/google. The sandboxed dev container this was authored in has
// no outbound access to fonts.googleapis.com, so relying on it would make
// the build non-deterministic. Vercel's own build servers can reach
// Google Fonts fine, but the safer, CI-proof choice for a foundation
// phase is a system font stack (see globals.css) with a real webfont
// swap-in left as a follow-up once this is validated end-to-end.

// Every page inherits this and overrides `title` / `description` / canonical
// with its own. Before this, all ~340 law and case pages shipped one identical
// title and description, which is the single biggest reason a corpus this size
// fails to get indexed: search engines treat the set as near-duplicates.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "مكوريا — القوانين والسوابق القضائية السودانية",
    template: "%s — مكوريا",
  },
  description:
    "معهد مكوريا القانوني: نصوص القوانين السودانية كاملة بموادها، والسوابق القضائية، والمبادئ القانونية — مع بيان حالة نفاذ كل نص ومصدره.",
  applicationName: SITE_NAME_AR,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME_AR,
    locale: "ar_SD",
    url: SITE_URL,
    title: "مكوريا — القوانين والسوابق القضائية السودانية",
    description:
      "نصوص القوانين السودانية كاملة بموادها، والسوابق القضائية، والمبادئ القانونية — مع بيان حالة نفاذ كل نص ومصدره.",
  },
  twitter: {
    card: "summary",
    title: "مكوريا — القوانين والسوابق القضائية السودانية",
    description:
      "نصوص القوانين السودانية كاملة بموادها، والسوابق القضائية، والمبادئ القانونية.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
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
