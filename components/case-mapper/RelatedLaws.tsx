import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Highlight } from "@/components/case-mapper/Highlight";
import type { RetrievedAuthority } from "@/lib/case-mapper/analyze";

export function RelatedLaws({ locale, laws }: { locale: Locale; laws: RetrievedAuthority[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionLaws")}</h2>
      {laws.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoLaws")}</p>
      ) : (
        <ul className="space-y-3">
          {laws.map((law) => (
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
                <VerificationBadge verified={law.verified} locale={locale} />
              </div>
              <p className="mb-2 text-sm leading-relaxed text-neutral-700">
                <Highlight html={law.excerptHtml} />
              </p>
              <p className="text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {law.matchedTerm}
              </p>
              {law.slug && law.type === "law" && (
                <Link href={`/laws/${law.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض القانون كاملاً ←" : "View full law →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
