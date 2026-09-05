import { Locale, t } from "@/lib/i18n";

export function CaseSummary({
  locale,
  excerpt,
  truncated,
}: {
  locale: Locale;
  excerpt: string;
  truncated: boolean;
}) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{t(locale, "cmSectionSummary")}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t(locale, "cmSummaryNote")}</p>
      <div className="rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ borderColor: "var(--mk-border)" }}>
        {excerpt}
        {truncated && <p className="mt-2 text-xs text-neutral-400">{t(locale, "cmSummaryTruncated")}</p>}
      </div>
    </section>
  );
}
