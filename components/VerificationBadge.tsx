import { Locale, t } from "@/lib/i18n";

/**
 * Mandatory visual rule carried over from the Case Mapper spec: verified
 * authority must always be visually distinct from unverified/pending
 * content, everywhere it appears — including here in the public research
 * pages, not only inside the future workspace.
 */
export function VerificationBadge({
  verified,
  locale,
}: {
  verified: boolean;
  locale: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        verified ? "mk-badge-verified" : "mk-badge-unverified"
      }`}
    >
      {verified ? t(locale, "verified") : t(locale, "unverified")}
    </span>
  );
}
