/**
 * Legal-language synonyms for the site search (/search).
 *
 * The search is literal: it looks for the words the visitor typed. People say
 * «سقوط الدعوى الجنائية»; the Criminal Procedure Act 1991 says «انقضاء الدعوى
 * الجنائية» (Art. 37) and «التقادم المسقط للدعوى الجنائية» (Art. 38). A visitor
 * asking for «أسباب سقوط الدعوى الجنائية» got nothing relevant.
 *
 * So the question is searched as typed, and again with each listed word swapped
 * for its legal-language synonym; every result is kept once, at its best place.
 * Add a pair here whenever a common word turns out to differ from the statute's.
 */

/** Keys and values are bare words: no «ال», hamza folded to «ا». */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  سقوط: ["انقضاء", "مسقط"],
  انقضاء: ["سقوط", "مسقط"],
  تسقط: ["تنقضي"],
  تنقضي: ["تسقط"],
  // Nov 4 — each pair checked on the database: the everyday word finds little
  // or nothing; the statute's word finds the article (in brackets).
  نصب: ["احتيال"],        // الاحتيال م178 جنائي
  حرامي: ["سرقة"],        // 0 نتيجة → السرقة م174
  شتيمة: ["إساءة"],       // 0 نتيجة → الإساءة والسباب م160
  شتم: ["إساءة"],
  سواقة: ["قيادة"],       // «رخصة سواقة» → رخصة القيادة، قانون المرور
  سلفة: ["قرض"],          // القرض م277 معاملات
  سلفه: ["قرض"],
  ضرب: ["أذى"],           // الأذى م142 جنائي
};

/**
 * Phrases swapped as a whole, for words that are only safe together:
 * «شيك مرتد» is «صك مردود» (م179 جنائي), but «المرتد» alone is apostasy. Bare tokens, «ال» stripped, hamza folded.
 */
export const PHRASE_SYNONYMS: Array<[string[], string]> = [
  [["شيك", "مرتد"], "صك مردود"],
  [["شيك", "راجع"], "صك مردود"],
  [["شيك", "بدون", "رصيد"], "صك مردود"],
];

/**
 * Question words dropped from a synonym rewrite (never from the question as
 * typed). The statute rarely repeats them: Art. 38 «التقادم المسقط للدعوى
 * الجنائية» does not contain «أسباب», so «أسباب مسقط الدعوى الجنائية» matched
 * it only partly and it fell below two unrelated cases.
 */
const REWRITE_FILLER = new Set([
  "أسباب", "اسباب", "الأسباب", "الاسباب",
  // «عقوبة النصب» → «احتيال», not «عقوبة احتيال»: Art. 178 is titled «الاحتيال»
  // and the punishment sits in its text, so the shorter rewrite matches its
  // title and ranks it first (checked on the database, Nov 4).
  "عقوبة", "العقوبة",
]);

/** At most this many rewritten questions are searched besides the original. */
export const MAX_SYNONYM_VARIANTS = 3;

const PREFIX = /^(وال|بال|فال|كال|ال)/;

function foldHamza(w: string): string {
  return w.replace(/[أإآ]/g, "ا");
}

/** The question as typed, followed by its synonym rewrites (deduplicated). */
export function synonymVariants(q: string): string[] {
  const words = q.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [q];
  const bareAll = words.map((w) => foldHamza(w).replace(PREFIX, "").replace(/[؟?!.،,«»"]+$/u, ""));
  // Phrases first: «الشيك المرتد» → «صك مردود».
  for (const [phrase, repl] of PHRASE_SYNONYMS) {
    for (let i = 0; i + phrase.length <= bareAll.length && out.length <= MAX_SYNONYM_VARIANTS; i++) {
      if (!phrase.every((p, k) => bareAll[i + k] === p)) continue;
      const v = [...words.slice(0, i), repl, ...words.slice(i + phrase.length)]
        .filter((w, j) => j === i || !REWRITE_FILLER.has(w))
        .join(" ");
      if (!out.includes(v)) out.push(v);
    }
  }
  for (let i = 0; i < words.length && out.length <= MAX_SYNONYM_VARIANTS; i++) {
    const bare = bareAll[i];
    const alts = SEARCH_SYNONYMS[bare];
    if (!alts) continue;
    for (const alt of alts) {
      if (out.length > MAX_SYNONYM_VARIANTS) break;
      const v = [...words.slice(0, i), alt, ...words.slice(i + 1)]
        .filter((w, j) => j === i || !REWRITE_FILLER.has(w))
        .join(" ");
      if (!out.includes(v)) out.push(v);
    }
  }
  return out;
}

type Ranked = {
  result_type: string;
  entity_id: string;
  status_rank: number | null;
  rank?: number | null;
  match_source?: string | null;
};

/**
 * Merge the result lists of the variants (index 0 = the question as typed).
 * A result found by several variants keeps its best (status_rank, full match
 * before partial, synonym rewrite before the question as typed, rank,
 * variant, position); the merged list is ordered the same way. «partial» = the row matched only some of the words, so a full
 * match found through a synonym outranks it.
 */
export function mergeVariantResults<T extends Ranked>(lists: T[][], limit: number): T[] {
  type Keyed = { row: T; key: [number, number, number, number, number, number] };
  const best = new Map<string, Keyed>();
  lists.forEach((rows, v) => {
    rows.forEach((row, pos) => {
      const partial = row.match_source === "partial" ? 1 : 0;
      // When the question has a listed everyday word, the statute's wording
      // decides first: «عقوبة الحرامي» alone falls back to every «عقوبة …»
      // article (الشغب، الزنا …), while «سرقة» finds Art. 174.
      const asTyped = v === 0 && lists.length > 1 ? 1 : 0;
      const key: Keyed["key"] = [row.status_rank ?? 0, partial, asTyped, row.rank ?? 99, v, pos];
      const id = `${row.result_type}:${row.entity_id}`;
      const cur = best.get(id);
      if (!cur || cmp(key, cur.key) < 0) best.set(id, { row, key });
    });
  });
  return [...best.values()]
    .sort((a, b) => cmp(a.key, b.key))
    .slice(0, limit)
    .map((k) => k.row);
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
