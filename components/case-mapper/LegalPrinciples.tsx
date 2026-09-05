import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import type { RetrievedPrinciple } from "@/lib/case-mapper/analyze";

export function LegalPrinciples({ locale, principles }: { locale: Locale; principles: RetrievedPrinciple[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionPrinciples")}</h2>
      {principles.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmNoPrinciples")}</p>
      ) : (
        <ul className="space-y-3">
          {principles.map((p) => (
            <li key={p.id} className="rounded-lg border p-4" style={{ borderColor: "var(--mk-border)" }}>
              <p className="font-medium">{p.title}</p>
              {p.category && <p className="mt-0.5 text-xs text-neutral-500">{p.category}</p>}
              {p.summary && <p className="mt-2 text-sm leading-relaxed">{p.summary.slice(0, 220)}</p>}
              <p className="mt-2 text-xs text-neutral-400">
                {t(locale, "cmMatchedOn")}: {p.matchedTerm}
              </p>
              {p.slug && (
                <Link href={`/principles/${p.slug}`} className="mt-1 inline-block text-xs hover:text-[var(--mk-gold)]">
                  {locale === "ar" ? "عرض المبدأ كاملاً ←" : "View full principle →"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
