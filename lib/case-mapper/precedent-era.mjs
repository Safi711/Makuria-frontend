/**
 * Era notice for precedents older than the Criminal Act 1991.
 * It states the date only: it never says that a principle lapsed or survives.
 * Run tests: node lib/case-mapper/__tests__/test-precedent-era.mjs
 */
export const CRIMINAL_ACT_YEAR = 1991;
export const CRIMINAL_ACT_SLUG = "criminal-law-1991";

/** Returns the notice text, or null when no notice applies. */
export function precedentEraNotice(year, criminal) {
  if (!criminal || !Number.isInteger(year) || year >= CRIMINAL_ACT_YEAR) return null;
  return `صدرت هذه السابقة سنة ${year}، قبل القانون الجنائي لسنة ${CRIMINAL_ACT_YEAR}. راجع النص النافذ قبل الاستناد إليها.`;
}
