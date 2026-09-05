import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 20;

export default async function CasesPage(props: PageProps<"/cases">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // RLS already restricts this table to status = 'published' for anon/
  // authenticated readers — no client-side status filter needed, and no
  // select('*') across 280+ rows.
  const { data: cases, count } = await supabase
    .from("cases")
    .select("id, case_title_ar, slug, case_number, judgment_date, year, court_id, verified, is_landmark", {
      count: "exact",
    })
    .order("judgment_date", { ascending: false })
    .range(from, to);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t(locale, "navCases")}</h1>

      {cases && cases.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: "var(--mk-border)" }}>
          {cases.map((c) => (
            <li key={c.id} className="py-4">
              <Link href={`/cases/${c.slug}`} className="flex items-start justify-between gap-4 group">
                <div>
                  <p className="font-medium group-hover:text-[var(--mk-gold)]">{c.case_title_ar}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t(locale, "caseNumber")} {c.case_number} · {t(locale, "judgmentDate")}{" "}
                    {c.judgment_date}
                  </p>
                </div>
                <VerificationBadge verified={Boolean(c.verified)} locale={locale} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
      )}

      <Pagination basePath="/cases" page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} locale={locale} />
    </div>
  );
}
