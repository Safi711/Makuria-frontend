import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Pagination } from "@/components/Pagination";
import { SITE_URL, clampDescription, lawStatusWordAr } from "@/lib/site";

const ARTICLES_PAGE_SIZE = 30;

/**
 * A title and description of this law alone. Without it every law page
 * inherited the site-wide title, so a search for «قانون المعادن لسنة 2015»
 * had nothing to match against.
 *
 * Paginated views (?page=2…) are marked noindex and point their canonical at
 * page 1: the articles differ, but the page is the same law, and indexing each
 * slice competes with the law's own page.
 */
export async function generateMetadata(
  props: PageProps<"/laws/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const supabase = await createClient();
  const { data: law } = await supabase
    .from("laws")
    .select(
      "title_ar, title_en, law_number, year_issued, issuing_authority, summary_ar, status, total_articles"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!law) return { title: "قانون غير موجود", robots: { index: false, follow: true } };

  const title = law.title_ar || law.title_en || slug;
  const articleCount = law.total_articles ?? 0;
  // 105 of 108 titles already end in «لسنة NNNN» — repeating the year in the
  // description just wastes the snippet.
  const yearInTitle = law.year_issued ? title.includes(String(law.year_issued)) : true;
  const facts = [
    law.law_number ? `قانون رقم ${law.law_number}` : null,
    !yearInTitle && law.year_issued ? `لسنة ${law.year_issued}` : null,
    law.issuing_authority || null,
    articleCount > 0 ? `${articleCount} مادة` : null,
    `الحالة: ${lawStatusWordAr(law.status)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // The law's own identity leads, and `summary_ar` follows only as a tail:
  // 55 of the 108 laws carry the *same* summary text («نسخة مرجعية قيد
  // المراجعة…») and 30 carry none, so a summary-first description would
  // recreate the duplicate-description problem this whole change exists to fix.
  const lead = `${title} — النص الكامل بمواده. ${facts}`;
  const description = clampDescription(
    law.summary_ar ? `${lead}. ${law.summary_ar}` : lead
  );

  return {
    title,
    description,
    alternates: { canonical: `/laws/${slug}` },
    // A law whose text has not been extracted yet is an empty page: keep it
    // reachable, keep it out of the index until it has something to say.
    robots: page > 1 || articleCount === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      url: `${SITE_URL}/laws/${slug}`,
      title,
      description,
    },
  };
}

export default async function LawDetailPage(props: PageProps<"/laws/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: law } = await supabase
    .from("laws")
    .select(
      "id, title_ar, title_en, slug, law_number, year_issued, date_issued, issuing_authority, summary_ar, verified, total_articles, source_url"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!law) notFound();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const from = (page - 1) * ARTICLES_PAGE_SIZE;
  const to = from + ARTICLES_PAGE_SIZE - 1;

  // Articles for one law only, field-selected + paginated — a law with
  // hundreds of articles never ships its full article set in one response.
  const { data: articles, count } = await supabase
    .from("articles")
    .select("id, article_number, title_ar, content_ar, verified", { count: "exact" })
    .eq("law_id", law.id)
    .order("article_number_int", { ascending: true })
    .range(from, to);

  // Structured data: lets Google understand this page as a piece of
  // legislation (number, date, issuing authority) instead of generic text.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: law.title_ar || law.title_en,
    inLanguage: "ar",
    url: `${SITE_URL}/laws/${slug}`,
    legislationJurisdiction: "Sudan",
    ...(law.law_number ? { legislationIdentifier: String(law.law_number) } : {}),
    ...(law.date_issued ? { legislationDate: law.date_issued } : {}),
    ...(law.issuing_authority
      ? { legislationPassedBy: { "@type": "Organization", name: law.issuing_authority } }
      : {}),
    ...(law.summary_ar ? { description: clampDescription(law.summary_ar, 500) } : {}),
    ...(law.source_url ? { sameAs: law.source_url } : {}),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{law.title_ar || law.title_en}</h1>
        <VerificationBadge verified={Boolean(law.verified)} locale={locale} />
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        {t(locale, "lawNumber")} {law.law_number} · {t(locale, "yearIssued")} {law.year_issued} ·{" "}
        {law.issuing_authority}
      </p>

      {law.summary_ar && <p className="mb-8 text-sm leading-relaxed">{law.summary_ar}</p>}

      <h2 className="mb-4 text-lg font-semibold">
        {t(locale, "articlesCount")} ({law.total_articles ?? count ?? 0})
      </h2>

      {articles && articles.length > 0 ? (
        <ol className="space-y-4">
          {articles.map((a) => (
            <li key={a.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {locale === "ar" ? "المادة" : "Article"} {a.article_number}
                </span>
                <VerificationBadge verified={Boolean(a.verified)} locale={locale} />
              </div>
              <p className="text-sm leading-relaxed">{a.content_ar}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
      )}

      <Pagination basePath={`/laws/${slug}`} page={page} pageSize={ARTICLES_PAGE_SIZE} totalCount={count ?? 0} locale={locale} />
    </div>
  );
}
