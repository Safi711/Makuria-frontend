import type { Locale } from "@/lib/i18n";
import { lawStatusWordAr } from "@/lib/site";

/**
 * A law's LEGAL FORCE — «ساري» / «ملغى» / «تحت المراجعة».
 *
 * This is deliberately a different component from `VerificationBadge`, which
 * answers a different question: whether *the record* has been checked against
 * an official source. Before this existed the homepage and the laws index
 * showed only the verification badge, and because `unverified` read as «تحت
 * المراجعة» — the same words the search page uses for unverified force — a
 * repealed law and a law in force were indistinguishable to a reader. On a
 * legal reference that is the one mistake that cannot be shipped.
 *
 * Colours match the search results page so the same status reads the same way
 * wherever a visitor meets it.
 */
const STYLE = {
  inForce: { fg: "#1F7A3D", bg: "#EEF7EE", border: "#BFE0C6", en: "In force" },
  repealed: { fg: "#5E2316", bg: "#F7E6E1", border: "#E3CAC2", en: "Repealed" },
  review: { fg: "#2E4460", bg: "#E8EEF5", border: "#C9D5E3", en: "Under review" },
} as const;

function toneFor(status?: string | null): keyof typeof STYLE {
  switch (status) {
    case "active":
    case "published":
      return "inForce";
    case "repealed":
      return "repealed";
    // `reference`, `amended`, `unknown`, null — force not established.
    default:
      return "review";
  }
}

export function LawStatusBadge({
  status,
  locale,
}: {
  status?: string | null;
  locale: Locale;
}) {
  const s = STYLE[toneFor(status)];

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color: s.fg, background: s.bg, borderColor: s.border }}
    >
      {locale === "ar" ? lawStatusWordAr(status) : s.en}
    </span>
  );
}
