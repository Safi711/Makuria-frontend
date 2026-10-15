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
      return "ملغى — لا يُعمل به";
    case "amended":
      return "معدّل";
    case "reference":
      return "قيد المراجعة";
    default:
      return "قيد المراجعة";
  }
}

/**
 * A readable name for where a text came from.
 *
 * This replaces the «موثّق / غير موثّق» badge that used to sit on every law
 * and case. That badge was an editorial verdict the reader could not check,
 * and an audit on 24 Sep found it unreliable in its own right: 4 of the 8
 * laws marked verified had no recorded source at all. Naming the source, and
 * saying plainly when there is none, gives the reader something they can
 * check for themselves instead of a claim they have to take on trust.
 */
const SOURCE_NAMES_AR: Record<string, string> = {
  "moj.gov.sd": "وزارة العدل — جمهورية السودان",
  "cbos.gov.sd": "بنك السودان المركزي",
  "judiciary.gov.sd": "السلطة القضائية — جمهورية السودان",
};

export function sourceNameAr(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Not a URL — a citation typed by hand is still a source worth showing.
    return url.trim();
  }
  return SOURCE_NAMES_AR[host] ?? host;
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
