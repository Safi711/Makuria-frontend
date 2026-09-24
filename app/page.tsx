import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { LawStatusBadge } from "@/components/LawStatusBadge";

export const revalidate = 60;

export default async function HomePage() {
  const locale = await getLocale();
  const supabase = await createClient();

  // Field-selected, row-limited teaser query — never select('*') on a
  // large table. Six laws for the homepage preview.
  //
  // Four things this query has to get right, each one a bug found on the live
  // page on 23 Sep:
  //
  // 1. `status` must be selected. Without it the cards showed only the
  //    verification badge, so a repealed law looked exactly like a law in
  //    force. Two of the six cards were in fact repealed.
  // 2. Only laws in force belong on the front page. The full corpus —
  //    repealed and reference texts included — stays one click away at /laws,
  //    where every card now carries its status.
  // 3. `total_articles > 0` keeps out title-only records; two of the six led
  //    to a page with no text at all.
  // 4. Order by `year_issued`, not `date_issued`. 91 of 109 laws have no
  //    `date_issued`, and a descending sort puts NULLs first in Postgres, so
  //    the "newest" row was really six undated records in arbitrary order
  //    that reshuffled on every revalidate — and the genuinely recent laws
  //    never appeared at all.
  const { data: recentLaws } = await supabase
    .from("laws")
    .select("id, title_ar, title_en, slug, law_number, year_issued, status, verified")
    .in("status", ["active", "published"])
    .not("slug", "is", null)
    // Operational record, not a law — see claude/makurialaw-traffic-and-control-lever.md
    .neq("slug", "site-migration-notice")
    .gt("total_articles", 0)
    .order("year_issued", { ascending: false, nullsFirst: false })
    .limit(6);

  return (
    <div>
      <section
        className="border-b px-4 py-16 text-center"
        style={{ borderColor: "var(--mk-border)", background: "var(--mk-black)" }}
      >
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-white md:text-4xl">
          {t(locale, "heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-neutral-300">{t(locale, "heroSubtitle")}</p>

        <form action="/search" className="mx-auto mt-8 flex max-w-xl gap-2">
          <input
            type="text"
            name="q"
            placeholder={t(locale, "searchPlaceholder")}
            className="flex-1 rounded-md border-0 px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md px-4 py-2.5 text-sm font-semibold text-black"
            style={{ background: "var(--mk-gold)" }}
          >
            {t(locale, "searchButton")}
          </button>
        </form>

        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/laws" className="text-[var(--mk-gold-soft)] hover:underline">
            {t(locale, "exploreLaws")}
          </Link>
          <Link href="/cases" className="text-[var(--mk-gold-soft)] hover:underline">
            {t(locale, "exploreCases")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-lg font-semibold">{t(locale, "navLaws")}</h2>
        {recentLaws && recentLaws.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentLaws.map((law) => (
              <Link
                key={law.id}
                href={`/laws/${law.slug}`}
                className="rounded-lg border p-4 transition hover:border-[var(--mk-gold)]"
                style={{ borderColor: "var(--mk-border)" }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{law.title_ar || law.title_en}</span>
                  {/* Legal force first: it is what a reader needs before the text. */}
                  <LawStatusBadge status={law.status} locale={locale} />
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                  <span>
                    {t(locale, "lawNumber")} {law.law_number} · {law.year_issued}
                  </span>
                  {/* Whether the record itself was checked against an official
                      source — a separate question from whether it is in force. */}
                  <VerificationBadge verified={Boolean(law.verified)} locale={locale} />
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
        )}
      </section>
    </div>
  );
}
