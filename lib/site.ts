/**
 * Canonical site identity, in one place.
 *
 * SITE_URL is deliberately hard-coded to the public domain rather than read
 * from VERCEL_URL: preview deployments and the *.vercel.app alias must still
 * emit canonical URLs pointing at makuria.legal, otherwise Google indexes the
 * preview host and splits ranking signals across duplicate copies of the same
 * corpus (the pplx.app mirrors already create that risk).
 */
export const SITE_URL = "https://makuria.legal";

export const SITE_NAME_AR = "مكوريا — معهد مكوريا القانوني";
export const SITE_NAME_EN = "Makuria Legal Institute";

/** Arabic label for a law's `status` value, used in page descriptions. */
export function lawStatusWordAr(status?: string | null): string {
  switch (status) {
    case "active":
    case "published":
      return "ساري";
    case "repealed":
      return "ملغى";
    case "amended":
      return "معدّل";
    case "reference":
      return "تحت المراجعة";
    default:
      return "تحت المراجعة";
  }
}

/**
 * Collapse whitespace and cut to a length that search engines actually
 * display, breaking on a word boundary rather than mid-word.
 */
export function clampDescription(text: string, max = 300): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
