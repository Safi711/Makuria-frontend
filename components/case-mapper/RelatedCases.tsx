import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { AuthorityBadge } from "@/components/case-mapper/AuthorityBadge";
import { Highlight } from "@/components/case-mapper/Highlight";
import type { RetrievedCase } from "@/lib/case-mapper/analyze";

export function RelatedCases({ locale, cases }: { locale: Locale; cases: RetrievedCase[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionCases")}</h2>
      {cases.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoCases")}</p>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="font-medium">{c.title}</p>
                <AuthorityBadge level={c.authority} locale={locale} />
              </div>
              <p className="mb-2 text-xs text-neutral-500">
                {[c.courtName, c.year ?? undefined, c.citation ?? c.caseNumber ?? undefined]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.principle && (
                <p className="mb-2 text-sm leading-relaxed">
                  <span className="font-medium">{locale === "ar" ? "المبدأ: " : "Principle: "}</span>
                  {c.principle}
                </p>
              )}
              <p className="mb-2 text-sm leading-relaxed text-neutral-700">
                <span className="text-xs font-medium text-neutral-500">{t(locale, "cmRelevanceReason")}: </span>
                <Highlight html={c.excerptHtml} />
              </p>
              <p className="text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {c.matchedTerm}
              </p>
              {c.slug && (
                <Link href={`/cases/${c.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض السابقة كاملة ←" : "View full precedent →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
