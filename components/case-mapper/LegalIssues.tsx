import { Locale, t } from "@/lib/i18n";
import type { IssueLens } from "@/lib/case-mapper/analyze";

const ORIGIN_KEY: Record<IssueLens["origin"], string> = {
  case_type: "cmIssueOriginCaseType",
  keyword: "cmIssueOriginKeyword",
  extracted: "cmIssueOriginExtracted",
};

export function LegalIssues({ locale, issues }: { locale: Locale; issues: IssueLens[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{t(locale, "cmSectionIssues")}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t(locale, "cmIssuesNote")}</p>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
