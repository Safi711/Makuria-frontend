import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function PrinciplesPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  // RLS restricts this table to review_status = 'published' for anon/
  // authenticated readers already — small table (a handful of rows
  // today), still explicit field selection rather than select('*').
  const { data: principles } = await supabase
    .from("legal_principles")
    .select("id, title_ar, title_en, slug, summary_ar, summary_en, category")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t(locale, "navPrinciples")}</h1>
      <p className="mb-8 text-sm text-neutral-500">
        {locale === "ar"
          ? "المبادئ القانونية المنشورة والمراجَعة فقط. المبادئ قيد المراجعة لا تظهر هنا."
          : "Only published, reviewed legal principles. Principles still under review are not shown here."}
      </p>

      {principles && principles.length > 0 ? (
        <ul className="space-y-4">
          {principles.map((p) => (
            <li key={p.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <Link href={`/principles/${p.slug}`} className="font-medium hover:text-[var(--mk-gold)]">
                {locale === "ar" ? p.title_ar : p.title_en || p.title_ar}
              </Link>
              {p.category && <p className="mt-1 text-xs text-neutral-500">{p.category}</p>}
              <p className="mt-2 text-sm text-neutral-600">
                {(locale === "ar" ? p.summary_ar : p.summary_en || p.summary_ar)?.slice(0, 220)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">{t(locale, "noResults")}</p>
      )}
    </div>
  );
}
