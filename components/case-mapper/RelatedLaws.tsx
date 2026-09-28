import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { LawStatusBadge } from "@/components/LawStatusBadge";
import { sourceNameAr } from "@/lib/site";
import { Highlight } from "@/components/case-mapper/Highlight";
import type { RetrievedAuthority, ForceStatus } from "@/lib/case-mapper/analyze";

/** The corpus status string that `LawStatusBadge` already knows how to label
 * in both locales. Reused rather than inventing a second vocabulary for the
 * same three states. */
function badgeStatus(force: ForceStatus): string | undefined {
  switch (force) {
    case "in_force":
      return "active";
    case "not_in_force":
      return "repealed";
    case "under_review":
      return "reference";
    default:
      return undefined;
  }
}

export function RelatedLaws({ locale, laws }: { locale: Locale; laws: RetrievedAuthority[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionLaws")}</h2>
      {laws.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoLaws")}</p>
      ) : (
        <ul className="space-y-3">
          {laws.map((law) => {
            // An article of a repealed or under-review law must not read as
            // live authority just because it matched the search. Legal force
            // comes first, before the record-provenance badge.
            const href =
              law.type === "article"
                ? law.lawSlug
                  ? `/laws/${law.lawSlug}`
                  : null
                : law.slug
                  ? `/laws/${law.slug}`
                  : null;

            return (
              <li key={law.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    {law.type === "article" ? (
                      <p className="font-medium">
                        {law.lawTitle}
                        {law.articleNumber && (
                          <span className="text-neutral-500">
                            {" "}
                            — {t(locale, "cmArticleLabel")} {law.articleNumber}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="font-medium">{law.title}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LawStatusBadge status={badgeStatus(law.force)} locale={locale} />
                  </div>
                </div>

                <p className="mb-2 text-sm leading-relaxed text-neutral-700">
                  <Highlight html={law.excerptHtml} />
                </p>

                {law.statusNote && (
                  <p
                    className="mb-2 rounded border px-2 py-1 text-xs leading-relaxed"
                    style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface, transparent)" }}
                  >
                    {law.statusNote}
                  </p>
                )}

                {/* Source, not a «verified / unverified» stamp. That stamp was
                    retired across the site on 2026-09-24: it told the reader
                    whether someone had ticked a box, not where the text came
                    from — and it read «غير موثّق» on the Traffic Act even
                    after its full official text was loaded from the Ministry
                    of Justice. What a lawyer needs is the source. */}
                <p className="text-xs text-neutral-400">
                  {t(locale, "sourceLabel")}:{" "}
                  {sourceNameAr(law.sourceUrl) ?? t(locale, "noSourceRecorded")}
                </p>
                <p className="text-xs text-neutral-400">
                  {t(locale, "cmMatchedOn")}: {law.matchedTerms.join("، ")}
                </p>

                {href && (
                  <Link href={href} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                    {locale === "ar" ? "عرض القانون كاملاً ←" : "View full law →"}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
