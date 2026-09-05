import { Locale, t } from "@/lib/i18n";
import { AuthorityBadge } from "@/components/case-mapper/AuthorityBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import type { IssueLens } from "@/lib/case-mapper/analyze";

/**
 * §F "خريطة الربط" — a plain card/tree layout, deliberately not a graph
 * library (none is installed, and Phase 1 doesn't need one). Each column
 * is a single honest chain: الوقائع → المسألة → النص القانوني →
 * السابقة → المبدأ, per issue lens. Any empty slot says so plainly
 * rather than being skipped silently.
 */
function MapNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--mk-border)" }}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--mk-gold)" }}>
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1 text-neutral-300" aria-hidden>
      ↓
    </div>
  );
}

export function CaseMap({ locale, issues }: { locale: Locale; issues: IssueLens[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionMap")}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {issues.map((issue) => (
          <div key={issue.term} className="flex flex-col">
            <MapNode label={t(locale, "cmMapFacts")}>
              <p className="text-neutral-600">
                {issue.origin === "case_type"
                  ? t(locale, "cmIssueOriginCaseType")
                  : issue.origin === "keyword"
                    ? t(locale, "cmIssueOriginKeyword")
                    : t(locale, "cmIssueOriginExtracted")}
              </p>
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapIssue")}>
              <p className="font-medium">{issue.term}</p>
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapLaw")}>
              {issue.topLaw ? (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {issue.topLaw.type === "article"
                      ? `${issue.topLaw.lawTitle ?? ""} — ${t(locale, "cmArticleLabel")} ${issue.topLaw.articleNumber ?? ""}`
                      : issue.topLaw.title}
                  </span>
                  <VerificationBadge verified={issue.topLaw.verified} locale={locale} />
                </div>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoLaws")}</span>
              )}
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapCase")}>
              {issue.topCase ? (
                <div className="flex items-center justify-between gap-2">
                  <span>{issue.topCase.title}</span>
                  <AuthorityBadge level={issue.topCase.authority} locale={locale} />
                </div>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoCases")}</span>
              )}
            </MapNode>
            <Arrow />
            <MapNode label={t(locale, "cmMapPrinciple")}>
              {issue.topPrinciple ? (
                <span>{issue.topPrinciple.title}</span>
              ) : (
                <span className="text-neutral-400">{t(locale, "cmNoPrinciples")}</span>
              )}
            </MapNode>
          </div>
        ))}
      </div>
    </section>
  );
}
