import { Locale, t } from "@/lib/i18n";
import type { AuthorityLevel } from "@/lib/case-mapper/analyze";

/**
 * Case authority strength badge. Reads `cases.authority_status`
 * (good_law / limited / overruled / under_review / null) — a real,
 * existing field, not a new status invented for Case Mapper. `overruled`
 * gets its own visually distinct (red) treatment: a case must never look
 * like standing authority once it's been overruled.
 */
export function AuthorityBadge({ level, locale }: { level: AuthorityLevel; locale: Locale }) {
  const styles: Record<AuthorityLevel, { bg: string; fg: string; key: string }> = {
    verified: { bg: "var(--mk-verified-bg)", fg: "var(--mk-verified-fg)", key: "cmAuthorityVerified" },
    needs_review: { bg: "var(--mk-unverified-bg)", fg: "var(--mk-unverified-fg)", key: "cmAuthorityNeedsReview" },
    overruled: { bg: "#fdeaea", fg: "#a3231c", key: "cmAuthorityOverruled" },
    unverified: { bg: "#f2f2f0", fg: "#5a5a55", key: "cmAuthorityUnverified" },
  };
  const s = styles[level];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {t(locale, s.key)}
    </span>
  );
}
