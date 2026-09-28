import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { SITE_URL, clampDescription, sourceNameAr } from "@/lib/site";

/**
 * A precedent is the kind of page people search for by its principle, not by
 * the site's name — so the principle (falling back to the subject) is what
 * goes in the description.
 */
export async function generateMetadata(
  props: PageProps<"/cases/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cases")
    .select("case_title_ar, case_number, judgment_date, principle_ar, summary_ar, subject_ar")
    .eq("slug", slug)
    .maybeSingle();

  if (!c) return { title: "سابقة غير موجودة", robots: { index: false, follow: true } };

  const title = c.case_title_ar || `قضية ${c.case_number ?? ""}`.trim();
  const body = c.principle_ar || c.summary_ar || c.subject_ar || "";
  const facts = [
    c.case_number ? `رقم القضية ${c.case_number}` : null,
    c.judgment_date ? `تاريخ الحكم ${c.judgment_date}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = clampDescription(
    body ? `${body}${facts ? ` — ${facts}` : ""}` : `سابقة قضائية سودانية. ${facts}`
  );

  return {
    title,
    description,
    alternates: { canonical: `/cases/${slug}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/cases/${slug}`,
      title,
      description,
    },
  };
}

export default async function CaseDetailPage(props: PageProps<"/cases/[slug]">) {
  const { slug } = await props.params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("cases")
    .select(
      "id, case_title_ar, case_number, judgment_date, plaintiff_ar, defendant_ar, subject_ar, facts_ar, legal_issue_ar, ruling_ar, reasoning_ar, principle_ar, verified, court_id, source_url"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!caseRow) notFound();

  const caseSource = sourceNameAr(caseRow.source_url);

  const sections: { label: string; value: string | null }[] = [
    { label: locale === "ar" ? "الوقائع" : "Facts", value: caseRow.facts_ar },
    { label: locale === "ar" ? "المسألة القانونية" : "Legal Issue", value: caseRow.legal_issue_ar },
    { label: locale === "ar" ? "الحكم" : "Ruling", value: caseRow.ruling_ar },
    { label: locale === "ar" ? "التسبيب" : "Reasoning", value: caseRow.reasoning_ar },
    { label: locale === "ar" ? "المبدأ" : "Principle", value: caseRow.principle_ar },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{caseRow.case_title_ar}</h1>
      <p className="mb-2 text-sm text-neutral-500">
        {[
          caseRow.case_number ? `${t(locale, "caseNumber")} ${caseRow.case_number}` : null,
          caseRow.judgment_date ? `${t(locale, "judgmentDate")} ${caseRow.judgment_date}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Same rule as the law pages: name the source, or say there is none.
          42 of 224 published cases carry no source at all — that is a fact a
          reader needs, and a trust badge was hiding it. */}
      <p className="mb-8 text-sm" style={{ color: caseSource ? "#52525b" : "#8A6414" }}>
        {caseSource ? (
          <>
            {t(locale, "sourceLabel")}:{" "}
            {caseRow.source_url?.startsWith("http") ? (
              <a
                href={caseRow.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-2"
              >
                {caseSource}
              </a>
            ) : (
              caseSource
            )}
          </>
        ) : (
          t(locale, "noSourceRecorded")
        )}
      </p>

      <div className="space-y-6">
        {sections
          .filter((s) => s.value)
          .map((s) => (
            <section key={s.label}>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--mk-gold)" }}>
                {s.label}
              </h2>
              <p className="text-sm leading-relaxed">{s.value}</p>
            </section>
          ))}
      </div>
    </div>
  );
}
