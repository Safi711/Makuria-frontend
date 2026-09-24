import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { LawStatusBadge } from "@/components/LawStatusBadge";
import { Pagination } from "@/components/Pagination";
import type { Metadata } from "next";

const PAGE_SIZE = 20;

// Pages 2+ and category filters are the same corpus in a different order, so
// they carry the index of page 1 rather than competing with it.
export async function generateMetadata(props: PageProps<"/laws">): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const filtered = page > 1 || typeof searchParams.category === "string";
  return {
    title: "القوانين السودانية",
    description:
      "فهرس القوانين السودانية على منصة مكوريا — النص الكامل لكل قانون بمواده، مصنّفاً بحسب المجال، مع بيان حالة النفاذ: ساري، أو ملغى، أو تحت المراجعة.",
    alternates: { canonical: "/laws" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function LawsPage(props: PageProps<"/laws">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const categorySlug = typeof searchParams.category === "string" ? searchParams.category : undefined;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_ar, name_en, slug")
    .order("display_order", { ascending: true });

  let categoryId: string | undefined;
  if (categorySlug) {
    categoryId = categories?.find((c) => c.slug === categorySlug)?.id;
  }

  // Explicit field list + range() pagination + server-side filter —
  // never select('*') across the whole laws table.
  //
  // Unlike the homepage this is the whole corpus, so repealed and reference
  // texts belong here — a researcher needs to reach a repealed law. What they
  // must not do is arrive unlabelled, hence `status` in the select and a
  // LawStatusBadge on every row.
  //
  // `year_issued` rather than `date_issued`: 91 of 109 laws have no
  // `date_issued`, and DESC puts NULLs first, which made the index open on
  // undated records in an order that changed between requests.
  let query = supabase
    .from("laws")
    .select(
      "id, title_ar, title_en, slug, law_number, year_issued, category_id, status, verified, total_articles",
      { count: "exact" }
    )
    .neq("status", "draft")
    .not("slug", "is", null)
    // Operational record, not a law.
    .neq("slug", "site-migration-notice")
    .order("year_issued", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data: laws, count } = await query;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t(locale, "navLaws")}</h1>

      {categories && categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/laws"
            className={`rounded-full border px-3 py-1 text-xs ${!categorySlug ? "border-[var(--mk-gold)]" : ""}`}
            style={{ borderColor: !categorySlug ? "var(--mk-gold)" : "var(--mk-border)" }}
          >
            {locale === "ar" ? "الكل" : "All"}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/laws?category=${c.slug}`}
              className="rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: categorySlug === c.slug ? "var(--mk-gold)" : "var(--mk-border)",
              }}
            >
              {locale === "ar" ? c.name_ar : c.name_en || c.name_ar}
            </Link>
          ))}
        </div>
      )}

      {laws && laws.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: "var(--mk-border)" }}>
          {laws.map((law) => (
            <li key={law.id} className="py-4">
              <Link href={`/laws/${law.slug}`} className="flex items-start justify-between gap-4 group">
                <div>
                  <p className="font-medium group-hover:text-[var(--mk-gold)]">
                    {law.title_ar || law.title_en}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t(locale, "lawNumber")} {law.law_number} · {law.year_issued} ·{" "}
                    {/* A title-only record says so here rather than after the click. */}
                    {(law.total_articles ?? 0) > 0
                      ? `${law.total_articles} ${t(locale, "articlesCount")}`
                      : t(locale, "textNotEnteredYet")}
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <LawStatusBadge status={law.status} locale={locale} />
                  <VerificationBadge verified={Boolean(law.verified)} locale={locale} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
      )}

      <Pagination
        basePath="/laws"
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={count ?? 0}
        locale={locale}
        extraParams={categorySlug ? { category: categorySlug } : {}}
      />
    </div>
  );
}
