import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";

/**
 * «المستشار القانوني الذكي» — an ordinary, indexed page again.
 *
 * For part of 2026-09-29 the advisor WAS the homepage, and this route carried
 * `robots: noindex` so the two URLs would not compete over identical content.
 * That arrangement was reversed the same day (see app/page.tsx): the homepage
 * is now a landing page that leads here, the two pages no longer serve the
 * same thing, and so the `noindex` and the self-referencing canonical are
 * both restored to normal.
 *
 * The path never moved through any of it. Anything bookmarked, shared or cited
 * as /case-mapper has worked continuously.
 */
export const metadata: Metadata = {
  title: "المستشار القانوني الذكي",
  description:
    "اكتب وقائع دعواك ليقابلها المستشار بالمواد القانونية والسوابق القضائية في متن مكوريا، مع بيان حالة نفاذ كل نص ومصدره، وبيان سبب ظهور كل نتيجة.",
  alternates: { canonical: "/case-mapper" },
};

export default async function CaseMapperRoute(props: PageProps<"/case-mapper">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  return <AdvisorPage locale={locale} searchParams={searchParams} basePath="/case-mapper" />;
}
