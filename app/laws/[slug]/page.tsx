import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Pagination } from "@/components/Pagination";

const ARTICLES_PAGE_SIZE = 30;

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
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
