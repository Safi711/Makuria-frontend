import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";

/**
 * «المستشار القانوني الذكي» at its own address.
 *
 * The advisor now also IS the homepage (see `app/page.tsx`), but this route
 * stays and renders exactly the same thing. Makuria's standing rule is that a
 * path never moves once it is public: anything already linked, bookmarked or
 * cited as /case-mapper keeps working. The page is rendered from one shared
 * component, so the two can never drift apart.
 *
 * `robots: index: false` — not because the page is private, but because it and
 * the homepage would otherwise be two URLs serving identical content, which
 * search engines treat as duplication and one of the two loses. The homepage
 * is the one that should rank.
 */
export const metadata: Metadata = {
  title: "المستشار القانوني الذكي",
  description:
    "أدخل وقائع الدعوى ليقابلها المستشار بالمواد القانونية والسوابق القضائية في متن مكوريا، مع بيان حالة نفاذ كل نص ومصدره.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default async function CaseMapperRoute(props: PageProps<"/case-mapper">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  return <AdvisorPage locale={locale} searchParams={searchParams} basePath="/case-mapper" />;
}
