import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { CaseInputForm } from "@/components/case-mapper/CaseInputForm";
import { CaseSummary } from "@/components/case-mapper/CaseSummary";
import { LegalIssues } from "@/components/case-mapper/LegalIssues";
import { RelatedLaws } from "@/components/case-mapper/RelatedLaws";
import { RelatedCases } from "@/components/case-mapper/RelatedCases";
import { LegalPrinciples } from "@/components/case-mapper/LegalPrinciples";
import { CaseMap } from "@/components/case-mapper/CaseMap";
import { SourcesPanel } from "@/components/case-mapper/SourcesPanel";
import { analyzeCase } from "@/lib/case-mapper/analyze";

function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function CaseMapperPage(props: PageProps<"/case-mapper">) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  const facts = paramStr(searchParams.facts);
  const caseType = paramStr(searchParams.case_type);
  const court = paramStr(searchParams.court);
  const jurisdiction = paramStr(searchParams.jurisdiction);
  const incidentDate = paramStr(searchParams.incident_date);
  const keywords = paramStr(searchParams.keywords);
  const submitted = paramStr(searchParams.submitted) === "1";

  let result: Awaited<ReturnType<typeof analyzeCase>> | null = null;
  let errored = false;

  if (submitted && facts.trim()) {
    try {
      const supabase = await createClient();
      result = await analyzeCase(supabase, {
        facts,
        caseType: caseType || undefined,
        court: court || undefined,
        jurisdiction: jurisdiction || undefined,
        incidentDate: incidentDate || undefined,
        keywords: keywords || undefined,
      });
    } catch {
      errored = true;
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row">
      <WorkspaceNav locale={locale} />
      <div className="min-w-0 flex-1 space-y-10">
        <div>
          <h1 className="mb-1 text-2xl font-bold">{t(locale, "cmPageTitle")}</h1>
          <p className="mb-6 text-xs text-neutral-500">{t(locale, "cmDisclaimer")}</p>

          <CaseInputForm
            locale={locale}
            initial={{ facts, caseType, court, jurisdiction, incidentDate, keywords }}
          />
        </div>

        {submitted && !facts.trim() && (
          <p className="text-sm text-red-600">{t(locale, "cmEmptyFacts")}</p>
        )}

        {errored && <p className="text-sm text-red-600">{t(locale, "cmErrorState")}</p>}

        {result && (
          <>
            {!result.hasAnyResults ? (
              <p className="rounded-lg border p-4 text-sm text-neutral-600" style={{ borderColor: "var(--mk-border)" }}>
                {t(locale, "cmNoResultsAtAll")}
              </p>
            ) : null}

            <CaseSummary locale={locale} excerpt={result.factsExcerpt} truncated={result.factsIsTruncated} />
            <LegalIssues locale={locale} issues={result.issues} />
            <RelatedLaws locale={locale} laws={result.laws} />
            <RelatedCases locale={locale} cases={result.cases} />
            <LegalPrinciples locale={locale} principles={result.principles} />
            <CaseMap locale={locale} issues={result.issues} />
            <SourcesPanel locale={locale} laws={result.laws} cases={result.cases} />
          </>
        )}
      </div>
    </div>
  );
}
