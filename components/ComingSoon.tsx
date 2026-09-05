import { Locale, t } from "@/lib/i18n";

/**
 * Honest empty state for route space reserved for a future module
 * (Case Mapper, Quick Check, Practical Law Sudan, Alerts, /matters).
 * Phase 0.6 explicitly does not build these — this component exists so
 * the reservation is truthful rather than a fake "under construction"
 * page pretending to be a feature.
 */
export function ComingSoon({ locale, moduleName }: { locale: Locale; moduleName: string }) {
  return (
    <div
      className="mx-auto my-16 max-w-xl rounded-lg border p-8 text-center"
      style={{ borderColor: "var(--mk-border)" }}
    >
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--mk-gold)" }}
      >
        {moduleName}
      </p>
      <h1 className="mb-3 text-xl font-semibold">{t(locale, "comingSoonTitle")}</h1>
      <p className="text-sm text-neutral-500">{t(locale, "comingSoonBody")}</p>
    </div>
  );
}
