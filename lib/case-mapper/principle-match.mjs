/**
 * Principles for the semantic path (Safi, 6 Nov 2026 — إ5).
 * The semantic search returns articles only, so principles were always empty
 * there. We look for principles that share at least two meaningful words with
 * the titles of the top articles found. Words are compared after the same
 * folding the database uses, and «لل/ل/و/ب» prefixes become «ال».
 * Run tests: node lib/case-mapper/__tests__/test-principle-match.mjs
 */
const STOP = new Set(["الذي", "التي", "علي", "الي", "من", "في", "عن", "او", "مع", "حق", "احكام", "قانون"]);

export function foldWord(w) {
  let s = w.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  if (/^لل/.test(s)) s = "ال" + s.slice(2);
  else if (/^[وب]ال/.test(s)) s = s.slice(1);
  return s;
}

export function keyWords(text) {
  return [...new Set((text ?? "").split(/[^ء-ي٠-٩A-Za-z0-9]+/)
    .map(foldWord).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

/** Principles sharing ≥2 key words with the article titles, best first. */
export function matchPrinciples(articleTitles, principles, max = 3) {
  const want = new Set(articleTitles.flatMap(keyWords));
  if (want.size < 2) return [];
  return principles
    .map((p) => {
      const have = new Set(keyWords(`${p.title_ar ?? ""} ${p.summary_ar ?? ""}`));
      const shared = [...want].filter((w) => have.has(w));
      return { p, n: shared.length };
    })
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.p);
}
