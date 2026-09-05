import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 20;

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
  let query = supabase
    .from("laws")
    .select(
      "id, title_ar, title_en, slug, law_number, year_issued, category_id, verified, total_articles",
      { count: "exact" }
    )
    .order("date_issued", { ascending: false })
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
                    {law.total_articles ?? 0} {t(locale, "articlesCount")}
                  </p>
                </div>
                <VerificationBadge verified={Boolean(law.verified)} locale={locale} />
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
