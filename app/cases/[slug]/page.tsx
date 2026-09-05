import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";

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

  const sections: { label: string; value: string | null }[] = [
    { label: locale === "ar" ? "الوقائع" : "Facts", value: caseRow.facts_ar },
    { label: locale === "ar" ? "المسألة القانونية" : "Legal Issue", value: caseRow.legal_issue_ar },
    { label: locale === "ar" ? "الحكم" : "Ruling", value: caseRow.ruling_ar },
    { label: locale === "ar" ? "التسبيب" : "Reasoning", value: caseRow.reasoning_ar },
    { label: locale === "ar" ? "المبدأ" : "Principle", value: caseRow.principle_ar },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{caseRow.case_title_ar}</h1>
        <VerificationBadge verified={Boolean(caseRow.verified)} locale={locale} />
      </div>
      <p className="mb-8 text-sm text-neutral-500">
        {t(locale, "caseNumber")} {caseRow.case_number} · {t(locale, "judgmentDate")} {caseRow.judgment_date}
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
