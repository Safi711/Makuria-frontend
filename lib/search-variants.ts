/**
 * Controls how many synonym variants a site search sends to the database, and
 * how many of them run at the same time. Defaults reproduce the behaviour before
 * this module existed (3 rewrites, all sent at once), so nothing changes unless
 * an env var is set.
 *
 * SEARCH_VARIANT_LIMIT        max rewrites besides the question as typed (default 3)
 * SEARCH_VARIANT_CONCURRENCY  max quick_search calls in flight (default: all)
 * SEARCH_TIMING=1             log total and per-call time to the server console
 */

const DEFAULT_VARIANT_LIMIT = 3;

function readInt(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function variantConfig(): { limit: number; concurrency: number } {
  const limit = readInt("SEARCH_VARIANT_LIMIT") ?? DEFAULT_VARIANT_LIMIT;
  const conc = readInt("SEARCH_VARIANT_CONCURRENCY");
  // 0 or unset means no cap: every variant starts at once (the old behaviour).
  return { limit, concurrency: conc && conc > 0 ? conc : Number.POSITIVE_INFINITY };
}

/** Bare form used to detect duplicates: hamza folded, diacritics and tatweel removed, punctuation and spaces normalised. */
export function variantKey(q: string): string {
  return q
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The question as typed (index 0) followed by its rewrites, with duplicates
 * removed by variantKey and at most `limit` rewrites kept (in their original order).
 */
export function selectVariants(all: string[], limit: number): string[] {
  if (all.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of all) {
    const k = variantKey(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  // out[0] is the question as typed; keep it, then at most `limit` rewrites.
  return out.slice(0, 1 + limit);
}

/** Runs fn over items with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export type CallTiming = { index: number; ms: number; error: boolean };

/** Logs total and per-call timings when SEARCH_TIMING=1. */
export function logSearchTiming(label: string, totalMs: number, calls: CallTiming[]): void {
  if (process.env.SEARCH_TIMING !== "1") return;
  const parts = calls.map((c) => `v${c.index}=${c.ms.toFixed(0)}ms${c.error ? "(err)" : ""}`);
  console.info(`[search-timing] ${label} total=${totalMs.toFixed(0)}ms calls=${calls.length} ${parts.join(" ")}`);
}
