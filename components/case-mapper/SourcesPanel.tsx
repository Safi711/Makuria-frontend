import { Locale, t } from "@/lib/i18n";
import type { RetrievedAuthority, RetrievedCase } from "@/lib/case-mapper/analyze";

export function SourcesPanel({
  locale,
  laws,
  cases,
}: {
  locale: Locale;
  laws: RetrievedAuthority[];
  cases: RetrievedCase[];
}) {
  const lawSources = laws.filter((l) => l.sourceUrl);
  const caseSources = cases.filter((c) => c.sourceUrl);
  const anySources = lawSources.length > 0 || caseSources.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t(locale, "cmSectionSources")}</h2>
      {!anySources ? (
        <p className="text-sm text-neutral-500">{t(locale, "cmSourceUnavailable")}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {lawSources.map((l) => (
            <li key={`law-${l.id}`}>
              <a href={l.sourceUrl!} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--mk-gold)]">
                {l.type === "article" ? l.lawTitle : l.title} — {t(locale, "cmSourceLink")}
              </a>
            </li>
          ))}
          {caseSources.map((c) => (
            <li key={`case-${c.id}`}>
              <a href={c.sourceUrl!} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--mk-gold)]">
                {c.title} — {t(locale, "cmSourceLink")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
