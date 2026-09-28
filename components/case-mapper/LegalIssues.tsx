import { Locale, t } from "@/lib/i18n";
import type { IssueLens, CaseMapResult } from "@/lib/case-mapper/analyze";

const ORIGIN_KEY: Record<IssueLens["origin"], string> = {
  keyword: "cmIssueOriginKeyword",
  expanded: "cmIssueOriginExpanded",
  extracted: "cmIssueOriginExtracted",
};

export function LegalIssues({
  locale,
  issues,
  caseTypeLens,
}: {
  locale: Locale;
  issues: IssueLens[];
  caseTypeLens?: CaseMapResult["caseTypeLens"];
}) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{t(locale, "cmSectionIssues")}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t(locale, "cmIssuesNote")}</p>

      {/* The case type is no longer searched as a word — saying so out loud,
          because a reader who typed «جنائي» would otherwise expect to see it
          listed among the issues below. */}
      {caseTypeLens && (
        <p className="mb-3 text-xs text-neutral-500">
          {t(locale, "cmCaseTypeLens")} —{" "}
          {caseTypeLens.categoryNameAr
            ? `${t(locale, "cmCaseTypeLensOn")} ${caseTypeLens.categoryNameAr}`
            : t(locale, "cmCaseTypeLensNone")}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {issues.map((issue) => (
          <li
            key={issue.term}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--mk-border)" }}
          >
            <p className="font-medium">{issue.term}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--mk-gold)" }}>
              {t(locale, "cmAnalysisLabel")} · {t(locale, ORIGIN_KEY[issue.origin])}
            </p>
            {/* "Matched nothing" is a finding, not a blank. */}
            {issue.searchedAndEmpty && (
              <p className="mt-2 text-xs text-neutral-500">{t(locale, "cmIssueNothingFound")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
