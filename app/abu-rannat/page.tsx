import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";

/**
 * «أبو رنات — المستشار القانوني الذكي» — an ordinary, indexed page.
 *
 * Lived at /case-mapper until 2026-10-12, when it moved to /abu-rannat to
 * match the name the advisor is known by (Safi approved the rename on
 * 2026-09-30). The old path is not dead: next.config.ts sends /case-mapper
 * here with a permanent (308) redirect that keeps the query string, so a
 * bookmarked or shared analysis link — /case-mapper?facts=… — still opens the
 * same analysis.
 *
 * For part of 2026-09-29 the advisor WAS the homepage and carried `noindex`;
 * that was reversed the same day (see app/page.tsx), so this page is indexed
 * with a self-referencing canonical.
 */
export const metadata: Metadata = {
  title: "أبو رنات — المستشار القانوني الذكي",
  description:
    "اكتب وقائع دعواك ليقابلها أبو رنات — المستشار القانوني الذكي من مكوريا — بالمواد القانونية والسوابق القضائية، مع بيان حالة نفاذ كل نص ومصدره، وسبب ظهور كل نتيجة.",
  alternates: { canonical: "/abu-rannat" },
};

export default async function AbuRannatRoute(props: PageProps<"/abu-rannat">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  return <AdvisorPage locale={locale} searchParams={searchParams} basePath="/abu-rannat" />;
}
