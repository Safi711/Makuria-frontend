import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { cookies } from "next/headers";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";
import { decodeInput, inputFromLegacyParams } from "@/lib/case-mapper/advisor-input";

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
 * Since 2026-10-27 new analyses never put the facts in the URL: the form posts
 * to a Server Action (./actions.ts) that keeps the input in a short-lived
 * httpOnly cookie, read back here. Old ?facts=…&submitted=1 links are still
 * honoured so nothing anyone shared before then breaks; sharing from now on
 * is an explicit button that creates /abu-rannat/s/<token>.
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
  const store = await cookies();

  // A legacy link wins over a stored draft: it is what the visitor just opened.
  const input =
    inputFromLegacyParams(searchParams) ?? decodeInput((n) => store.get(n)?.value);
  const shareError = searchParams.share_error === "1";

  return <AdvisorPage locale={locale} input={input} shareError={shareError} />;
}
