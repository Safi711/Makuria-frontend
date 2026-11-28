/**
 * Renamed law slugs.
 *
 * A law's slug is its public address (/laws/<slug>) and the key the analyzer
 * uses to fetch companion laws and mapped articles. When a slug is corrected,
 * the database row and the deployed code cannot change at the same instant.
 * Every lookup therefore accepts both spellings, and every result is reported
 * under the current one, so the site works before, during and after the rename.
 *
 * Map: old slug → current slug.
 *
 * - evidence-law-1993 → evidence-law-1994: article 1 of the Evidence Act names
 *   it «قانون الإثبات لسنة 1994» (Act No. 31 of 1994). 1993 was the year of the
 *   provisional decree that first enacted it.
 */
export const RENAMED_LAW_SLUGS: Readonly<Record<string, string>> = {
  "evidence-law-1993": "evidence-law-1994",
};

/** The current slug for any spelling, old or new. */
export function canonicalLawSlug(slug: string): string;
export function canonicalLawSlug(slug: string | null | undefined): string | null;
export function canonicalLawSlug(slug: string | null | undefined): string | null {
  if (!slug) return slug ?? null;
  return RENAMED_LAW_SLUGS[slug] ?? slug;
}

/** Every spelling a law may be stored under in the database right now. */
export function lawSlugVariants(slug: string): string[] {
  const current = canonicalLawSlug(slug);
  const variants = new Set<string>([slug, current]);
  for (const [oldSlug, newSlug] of Object.entries(RENAMED_LAW_SLUGS)) {
    if (newSlug === current) variants.add(oldSlug);
  }
  return [...variants];
}

/** Expand a list of slugs for a `.in("slug", …)` query. */
export function expandLawSlugs(slugs: readonly string[]): string[] {
  return [...new Set(slugs.flatMap(lawSlugVariants))];
}
