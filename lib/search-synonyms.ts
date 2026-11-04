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
};

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
  for (let i = 0; i < words.length && out.length <= MAX_SYNONYM_VARIANTS; i++) {
    const bare = foldHamza(words[i]).replace(PREFIX, "");
    const alts = SEARCH_SYNONYMS[bare];
    if (!alts) continue;
    for (const alt of alts) {
      if (out.length > MAX_SYNONYM_VARIANTS) break;
      const v = [...words.slice(0, i), alt, ...words.slice(i + 1)].join(" ");
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
 * before partial, rank, variant, position); the merged list is ordered the
 * same way. «partial» = the row matched only some of the words, so a full
 * match found through a synonym outranks it.
 */
export function mergeVariantResults<T extends Ranked>(lists: T[][], limit: number): T[] {
  type Keyed = { row: T; key: [number, number, number, number, number] };
  const best = new Map<string, Keyed>();
  lists.forEach((rows, v) => {
    rows.forEach((row, pos) => {
      const partial = row.match_source === "partial" ? 1 : 0;
      const key: Keyed["key"] = [row.status_rank ?? 0, partial, row.rank ?? 99, v, pos];
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
