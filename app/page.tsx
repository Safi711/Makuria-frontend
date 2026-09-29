import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { AdvisorPage } from "@/components/case-mapper/AdvisorPage";

/**
 * THE HOMEPAGE IS THE ADVISOR — Safi, 2026-09-29, on sending the
 * `Makuria_Case_Mapper_Login_Page.html` mockup: «في التصميم دا الصفحة الرئيسية
 * مفروض تكون This». Consistent with what he said when the tool first went into
 * the navigation: «هذا هو السبب، الموقع كله».
 *
 * What was here before: a black hero band, a search box posting to /search, and
 * six cards showing the most recent laws in force. That query and the four bugs
 * it had been corrected for are not lost — the same listing, with the whole
 * corpus and every status, lives at /laws, which the header links to.
 *
 * ONE COST, RECORDED HONESTLY. The old homepage carried real indexable text —
 * six law titles with their years and statuses, linking into the corpus. This
 * one is a form. Google has less to read at the site's most-linked address, and
 * the internal links that fed /laws from the front page are gone. If that shows
 * up in the indexing numbers, the fix is small: render the same six cards below
 * the advisor. The listing component and its query are preserved in git history
 * at this path.
 *
 * No `revalidate` here any more: the old page cached its law list for 60
 * seconds, but this page's content is whatever the visitor typed, so there is
 * nothing to revalidate.
 */
export const metadata: Metadata = {
  title: "المستشار القانوني الذكي — مكوريا",
  description:
    "اكتب وقائع الدعوى ليقابلها المستشار بالمواد القانونية والسوابق القضائية في متن مكوريا، مع بيان حالة نفاذ كل نص ومصدره. قوانين السودان وسوابقه القضائية، موثّقة بمصادرها.",
  alternates: { canonical: "/" },
};

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  return <AdvisorPage locale={locale} searchParams={searchParams} basePath="/" />;
}
