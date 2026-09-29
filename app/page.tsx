import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale } from "@/lib/i18n";
import { LawStatusBadge } from "@/components/LawStatusBadge";

/**
 * TWO DOORS — Safi, 2026-09-29: «ماذا إذا جعلنا هذه الصفحة الرئيسية والمستشار
 * الصفحة الفرعية، بمعنى تفتح الموقع هذا وهو الذي يوجّهك للمستشار».
 *
 * This reverses the arrangement made earlier the same day, and it is the right
 * reversal — it repairs a cost recorded at the time in
 * `homepage-becomes-the-advisor-2026-09-29.md`.
 *
 * Why, in the order the reasons matter:
 *
 * 1. THE SIZE OF THE ASK. «Write the facts of your case» is a heavy request to
 *    make of a stranger who has not yet decided whether to trust the site.
 *    «عقوبة السرقة» is two words. The quick door earns the trust that brings
 *    someone back to write their facts.
 * 2. GOOGLE. The homepage, the most-linked address on the site, had become a
 *    form: almost no readable text and no internal links into the corpus. This
 *    page carries the corpus counts, the most recent laws with their statuses,
 *    and links into /laws, /cases and /principles.
 * 3. THE ADVISOR ITSELF GAINS. A page that is only a textarea does not explain
 *    what it is for. A card that says what it does — and that it shows its
 *    reasoning — both explains and invites. It is seen by more people, not
 *    fewer.
 *
 * `/case-mapper` goes back to being an ordinary indexed page: the two URLs no
 * longer serve the same content, so the `noindex` that kept them from
 * competing is removed and the route returns to the sitemap.
 *
 * The counts are read live rather than hard-coded. A legal reference that
 * advertises «١٠٨ قانون» while holding a different number is exactly the kind
 * of small dishonesty that costs a reader's trust — and the old site on
 * pplx.app is currently showing «٠ مادة» beside 5,821 real articles, which is
 * what that failure looks like in practice.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "مكوريا — قوانين السودان وسوابقه القضائية",
  description:
    "نصوص القوانين السودانية كاملة بموادها، والسوابق القضائية، مع بيان حالة نفاذ كل نص ومصدره — واكتب وقائع دعواك ليقابلها المستشار القانوني الذكي بالمواد والسوابق المرتبطة بها.",
  alternates: { canonical: "/" },
};

const EXAMPLES = [
  "ما عقوبة السرقة؟",
  "المادة 130",
  "قانون الإجراءات الجنائية",
  "غسل الأموال",
  "الحضانة",
];

function ar(n: number): string {
  return n.toLocaleString("ar-EG");
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--mk-gold-soft)" }}>
        {value}
      </div>
      <div className="text-xs sm:text-sm" style={{ color: "var(--cm-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function BrowseCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border p-5 transition-colors hover:border-[var(--mk-gold)]"
      style={{ background: "var(--cm-surface)", borderColor: "var(--cm-line)" }}
    >
      <p className="mb-1.5 font-semibold">{title}</p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--cm-muted)" }}>
        {body}
      </p>
    </Link>
  );
}

export default async function HomePage() {
  const locale: Locale = await getLocale();
  const supabase = await createClient();

  // Counts and the recent-laws teaser in one round trip each. `head: true`
  // asks Postgres for the count without shipping the rows.
  //
  // Every count excludes `site-migration-notice`: it is an operational row
  // that steers the OLD site's visitors here, not a law, and it must never be
  // counted as one — see claude/makurialaw-traffic-and-control-lever.md.
  const [lawCount, articleCount, caseCount, recent] = await Promise.all([
    supabase
      .from("laws")
      .select("id", { count: "exact", head: true })
      .neq("slug", "site-migration-notice"),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    // The same six-law teaser the homepage carried before, with the four
    // corrections made on 23 Sep still in force: `status` selected so a
    // repealed law cannot look live, only laws in force shown, title-only
    // records excluded, and ordered by `year_issued` because 91 of 109 rows
    // have no `date_issued` and NULLs sort first in Postgres.
    supabase
      .from("laws")
      .select("id, title_ar, title_en, slug, year_issued, status")
      .in("status", ["active", "published"])
      .not("slug", "is", null)
      .neq("slug", "site-migration-notice")
      .gt("total_articles", 0)
      .order("year_issued", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const laws = recent.data ?? [];

  const showStats =
    (lawCount.count ?? 0) > 0 &&
    (articleCount.count ?? 0) > 0 &&
    (caseCount.count ?? 0) > 0;

  return (
    <div
      className="min-h-full"
      style={
        {
          background: "var(--cm-bg)",
          color: "var(--cm-text)",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        {/* ─────────────────────────────── the quick door: search */}
        <div className="text-center">
          <p
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
            style={{
              color: "var(--mk-gold-soft)",
              borderColor: "rgba(228,193,67,0.45)",
              background: "rgba(228,193,67,0.08)",
            }}
          >
            <span aria-hidden>●</span>
            {t(locale, "homeEyebrow")}
          </p>

          <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{t(locale, "homeTitle")}</h1>

          <p
            className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--cm-muted)" }}
          >
            {t(locale, "homeSubtitle")}
          </p>

          <form action="/search" className="mx-auto flex max-w-2xl gap-2">
            <label htmlFor="home-q" className="sr-only">
              {t(locale, "searchPlaceholder")}
            </label>
            <input
              id="home-q"
              type="text"
              name="q"
              placeholder={t(locale, "searchPlaceholder")}
              className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-[var(--mk-gold)]"
              style={{
                background: "var(--cm-surface-2)",
                borderColor: "var(--cm-line-2)",
                color: "var(--cm-text)",
              }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-6 py-3 text-sm font-bold"
              style={{
                background: "linear-gradient(180deg,#EACC82 0%,#DBB663 100%)",
                color: "#071226",
              }}
            >
              {t(locale, "homeSearchBtn")}
            </button>
          </form>

          {/* Example queries. Not decoration — they teach a first-time visitor
              what this corpus can be asked, which a placeholder alone does not. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs" style={{ color: "var(--cm-faint)" }}>
              {t(locale, "homeExamplesLabel")}:
            </span>
            {EXAMPLES.map((ex) => (
              <Link
                key={ex}
                href={`/search?q=${encodeURIComponent(ex)}`}
                className="rounded-full border px-3 py-1 text-xs transition-colors hover:border-[var(--mk-gold)]"
                style={{ borderColor: "var(--cm-line-2)", color: "var(--cm-text-2)" }}
              >
                {ex}
              </Link>
            ))}
          </div>

          {/* ───────────────────────────── the corpus, in numbers
              SHOWN ONLY IF ALL THREE COUNTS REALLY CAME BACK. If a query fails
              — a network blip, an expired key — `count` is null, and rendering
              `?? 0` would put «٠ قانون · ٠ مادة» on the front page of a legal
              reference holding 5,821 articles.
              That is not hypothetical: the old site on pplx.app is advertising
              «٠ مادة» at this moment for exactly this reason. Silence is
              honest; a confident zero is not. */}
          {showStats && (
            <div className="mt-10 flex items-start justify-center gap-8 sm:gap-14">
              <Stat value={ar(lawCount.count!)} label={t(locale, "homeStatLaws")} />
              <Stat value={ar(articleCount.count!)} label={t(locale, "homeStatArticles")} />
              <Stat value={ar(caseCount.count!)} label={t(locale, "homeStatCases")} />
            </div>
          )}
        </div>

        {/* ───────────────────────────── the deep door: the advisor */}
        <section
          className="mt-12 rounded-2xl border p-6 sm:mt-16 sm:p-8"
          style={{
            background: "linear-gradient(135deg, rgba(228,193,67,0.10) 0%, var(--cm-surface) 55%)",
            borderColor: "rgba(228,193,67,0.40)",
          }}
        >
          <p
            className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: "#EAE2CD", color: "#5A4A22" }}
          >
            {t(locale, "homeAdvisorTag")}
          </p>
          <h2 className="mb-2 text-xl font-bold sm:text-2xl">{t(locale, "homeAdvisorTitle")}</h2>
          <p
            className="mb-5 max-w-3xl text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--cm-text-2)" }}
          >
            {t(locale, "homeAdvisorBody")}
          </p>
          <Link
            href="/case-mapper"
            className="inline-block rounded-xl px-6 py-3 text-sm font-bold"
            style={{
              background: "linear-gradient(180deg,#EACC82 0%,#DBB663 100%)",
              color: "#071226",
            }}
          >
            {t(locale, "homeAdvisorCta")} {locale === "ar" ? "←" : "→"}
          </Link>
        </section>

        {/* ───────────────────────────────────────── browse */}
        <section className="mt-12 sm:mt-16">
          <h2 className="mb-5 text-xl font-bold">{t(locale, "homeBrowseTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <BrowseCard
              href="/laws"
              title={t(locale, "navLaws")}
              body={t(locale, "homeBrowseLawsBody")}
            />
            <BrowseCard
              href="/cases"
              title={t(locale, "navCases")}
              body={t(locale, "homeBrowseCasesBody")}
            />
            <BrowseCard
              href="/principles"
              title={t(locale, "navPrinciples")}
              body={t(locale, "homeBrowsePrinciplesBody")}
            />
          </div>
        </section>

        {/* ───────────────────────── the most recent laws in force */}
        {laws.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <h2 className="mb-5 text-xl font-bold">{t(locale, "homeLatestTitle")}</h2>
            <ul className="divide-y [&>li]:border-[var(--mk-border)]">
              {laws.map((law) => (
                <li key={law.id} className="py-4">
                  <Link
                    href={`/laws/${law.slug}`}
                    className="group flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium group-hover:text-[var(--mk-gold)]">
                        {law.title_ar || law.title_en}
                      </p>
                      {law.year_issued && (
                        <p className="mt-1 text-xs" style={{ color: "var(--cm-faint)" }}>
                          {law.year_issued}
                        </p>
                      )}
                    </div>
                    <LawStatusBadge status={law.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/laws"
              className="mt-5 inline-block text-sm font-medium"
              style={{ color: "var(--mk-gold-soft)" }}
            >
              {t(locale, "homeLatestAll")} {locale === "ar" ? "←" : "→"}
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
