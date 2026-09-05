import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";

export const revalidate = 60;

export default async function HomePage() {
  const locale = await getLocale();
  const supabase = await createClient();

  // Field-selected, row-limited teaser query — never select('*') on a
  // large table. Six rows for a homepage preview, newest first.
  const { data: recentLaws } = await supabase
    .from("laws")
    .select("id, title_ar, title_en, slug, law_number, year_issued, verified")
    .order("date_issued", { ascending: false })
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
                  <VerificationBadge verified={Boolean(law.verified)} locale={locale} />
                </div>
                <p className="text-xs text-neutral-500">
                  {t(locale, "lawNumber")} {law.law_number} · {law.year_issued}
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
