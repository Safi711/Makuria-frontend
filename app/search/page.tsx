import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

const RESULT_LIMIT = 25;

type SearchRow = {
  result_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  identifier: string | null;
  slug: string | null;
  crumb: string | null;
  match_source: string | null;
  legal_status: string | null;
  status_note_ar: string | null;
  law_status: string | null;
  status_rank: number | null;
  law_slug: string | null;
};

// status_rank: 0 = in force, 1 = disputed / not verified, 2 = repealed.
const IN_FORCE = 0;
const DISPUTED = 1;
const REPEALED = 2;

// «تحت المراجعة»: the force of the text has not been verified yet — either the
// article's own status is `unknown`, or its law is a `reference` copy with no
// documented official source. This is NOT the same as «غير نافذة», so these
// rows get their own section instead of falling under the repealed/disputed one.
function isUnderReview(row: SearchRow): boolean {
  if (row.status_rank === REPEALED) return false;
  if (row.legal_status === "unknown") return true;
  return row.law_status === "reference" && row.legal_status !== "disputed";
}

function statusLabelKey(row: SearchRow): string | null {
  if (row.status_rank === REPEALED) return "statusRepealed";
  if (isUnderReview(row)) return "statusUnknown";
  if (row.status_rank !== DISPUTED) return null;
  switch (row.legal_status) {
    case "amended":
      return "statusAmended";
    case "not_yet_in_force":
      return "statusNotYetInForce";
    default:
      return "statusDisputed";
  }
}

function hrefFor(row: SearchRow): string | null {
  if (row.result_type === "case" && row.slug) return `/cases/${row.slug}`;
  if (row.result_type === "law" && row.slug) return `/laws/${row.slug}`;
  if (row.result_type === "article" && row.law_slug) return `/laws/${row.law_slug}`;
  return null;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  // quick_search_v4 (deployed 2026-09-22) keeps v3's output columns and adds:
  // Arabic-Indic digits (٩٦ → 96), hamza/ta-marbuta/diacritic folding, whole
  // questions («ما عقوبة السرقة») split into words, «المادة 96 من القانون
  // الجنائي» understood as article 96 of that law, and `reference` laws
  // returned as law results. It is bounded by limit_rows like v3.
  const { data, error } = q
    ? await supabase.rpc("quick_search_v4", {
        q,
        limit_rows: RESULT_LIMIT,
        include_repealed: true,
      })
    : { data: null, error: null };

  const results: SearchRow[] = (data as SearchRow[] | null) ?? [];
  const underReview = results.filter(isUnderReview);
  const inForce = results.filter(
    (r) => !isUnderReview(r) && (r.status_rank ?? IN_FORCE) === IN_FORCE
  );
  const notInForce = results.filter(
    (r) => !isUnderReview(r) && (r.status_rank ?? IN_FORCE) > IN_FORCE
  );
  const disputedCount = notInForce.filter((r) => r.status_rank === DISPUTED).length;
  const repealedCount = notInForce.filter((r) => r.status_rank === REPEALED).length;
  // The question named a law that is not in the corpus (e.g. «قانون العقوبات
  // 1983»): v4 falls back to every article carrying that number.
  const articleNumberOnly = results.some((r) => r.match_source === "article_no_only");

  function ResultCard({ row }: { row: SearchRow }) {
    const labelKey = statusLabelKey(row);
    const isRepealed = row.status_rank === REPEALED;
    const reviewing = isUnderReview(row);
    const href = hrefFor(row);
    const crumb =
      row.crumb && row.law_status === "repealed"
        ? `${row.crumb} — ${t(locale, "statusRepealed")}`
        : row.crumb;

    const accent = isRepealed ? "#9C3B24" : reviewing ? "#4E6A8A" : "#8A6414";
    const accentBg = isRepealed ? "#F7E6E1" : reviewing ? "#E8EEF5" : "#F9F0DC";
    const accentText = isRepealed ? "#5E2316" : reviewing ? "#2E4460" : "#5A4210";

    return (
      <li
        className="rounded-lg border p-4"
        style={{
          borderColor: isRepealed
            ? "var(--mk-repealed-border, #E3CAC2)"
            : reviewing
              ? "var(--mk-review-border, #C9D5E3)"
              : row.status_rank === DISPUTED
                ? "var(--mk-disputed-border, #E0CE9E)"
                : "var(--mk-border)",
        }}
      >
        <p className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
          {crumb ?? row.result_type}
        </p>

        <p className="flex flex-wrap items-baseline gap-2 font-medium">
          {href ? (
            <Link
              href={href}
              className="hover:underline"
              style={isRepealed ? { color: "#4A5A75" } : undefined}
            >
              {row.title}
            </Link>
          ) : (
            <span style={isRepealed ? { color: "#4A5A75" } : undefined}>{row.title}</span>
          )}
          {row.identifier && (
            <span className="text-xs text-neutral-500">
              {t(locale, "articleLabel")} {row.identifier}
            </span>
          )}
          {labelKey && (
            <span
              className="rounded border px-2 py-0.5 text-[10.5px] tracking-wide"
              style={{ color: accent, background: accentBg, borderColor: "currentColor" }}
            >
              {t(locale, labelKey)}
            </span>
          )}
        </p>

        {row.subtitle && <p className="text-xs text-neutral-500">{row.subtitle}</p>}

        {row.snippet && (
          <p
            className="mt-1 text-sm"
            style={{ color: isRepealed ? "#7E8DA6" : "var(--mk-muted, #52525b)" }}
          >
            {row.snippet}
          </p>
        )}

        {row.status_note_ar && (
          <p
            className="mt-2 border-s-[3px] px-3 py-1.5 text-xs leading-relaxed"
            style={{
              background: accentBg,
              borderInlineStartColor: accent,
              color: accentText,
            }}
          >
            {row.status_note_ar}
          </p>
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t(locale, "navSearch")}</h1>

      <form className="mb-8 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t(locale, "searchPlaceholder")}
          className="flex-1 rounded-md border px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--mk-border)" }}
        />
        <button
          type="submit"
          className="rounded-md px-4 py-2.5 text-sm font-semibold text-black"
          style={{ background: "var(--mk-gold)" }}
        >
          {t(locale, "searchButton")}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600">
          {locale === "ar"
            ? "حدث خطأ أثناء البحث."
            : "Something went wrong running the search."}
        </p>
      )}

      {q && !error && (
        <>
          {results.length > 0 ? (
            <>
              <p className="mb-4 text-xs text-neutral-500">
                <strong>{inForce.length}</strong> {t(locale, "resultsInForce")}
                {underReview.length > 0 && (
                  <>
                    {" · "}
                    <strong>{underReview.length}</strong> {t(locale, "statusUnknown")}
                  </>
                )}
                {disputedCount > 0 && (
                  <>
                    {" · "}
                    <strong>{disputedCount}</strong> {t(locale, "statusDisputed")}
                  </>
                )}
                {repealedCount > 0 && (
                  <>
                    {" · "}
                    <strong>{repealedCount}</strong> {t(locale, "statusRepealed")}
                  </>
                )}
              </p>

              {articleNumberOnly && (
                <p
                  className="mb-4 rounded-md border px-3 py-2 text-xs"
                  style={{ borderColor: "#C9D5E3", background: "#E8EEF5", color: "#2E4460" }}
                >
                  {t(locale, "articleNumberOnlyNote")}
                </p>
              )}

              {inForce.length > 0 && (
                <ul className="space-y-3">
                  {inForce.map((r) => (
                    <ResultCard key={`${r.result_type}-${r.entity_id}`} row={r} />
                  ))}
                </ul>
              )}

              {underReview.length > 0 && (
                <>
                  <div
                    className="mt-6 border-t-2 pt-3"
                    style={{ borderTopColor: "#4E6A8A" }}
                  >
                    <h2 className="text-sm font-semibold" style={{ color: "#4E6A8A" }}>
                      {t(locale, "underReviewHeading")}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {t(locale, "underReviewNote")}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-3">
                    {underReview.map((r) => (
                      <ResultCard key={`${r.result_type}-${r.entity_id}`} row={r} />
                    ))}
                  </ul>
                </>
              )}

              {notInForce.length > 0 && (
                <>
                  <div
                    className="mt-6 border-t-2 pt-3"
                    style={{ borderTopColor: "#9C3B24" }}
                  >
                    <h2 className="text-sm font-semibold" style={{ color: "#9C3B24" }}>
                      {t(locale, "notInForceHeading")}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {t(locale, "notInForceNote")}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-3">
                    {notInForce.map((r) => (
                      <ResultCard key={`${r.result_type}-${r.entity_id}`} row={r} />
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
          )}
        </>
      )}
    </div>
  );
}
