import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

const RESULT_LIMIT = 25;

export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  // quick_search is a bounded RPC (limit_rows) that searches across
  // articles and case law server-side — this is the one-line frontend
  // change already deployed in production; the new frontend just calls
  // it instead of re-implementing an unbounded client-side query.
  const { data: results, error } = q
    ? await supabase.rpc("quick_search", { q, limit_rows: RESULT_LIMIT })
    : { data: null, error: null };

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
          {locale === "ar" ? "حدث خطأ أثناء البحث." : "Something went wrong running the search."}
        </p>
      )}

      {q && !error && (
        <>
          {results && results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((r: {
                result_type: string;
                entity_id: string;
                title: string;
                subtitle: string | null;
                snippet: string | null;
                slug: string | null;
              }) => (
                <li key={`${r.result_type}-${r.entity_id}`} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
                  <p className="mb-1 text-xs uppercase tracking-wide text-neutral-400">{r.result_type}</p>
                  <p className="font-medium">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-neutral-500">{r.subtitle}</p>}
                  {r.snippet && <p className="mt-1 text-sm text-neutral-600">{r.snippet}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
          )}
        </>
      )}
    </div>
  );
}
