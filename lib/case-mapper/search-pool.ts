/**
 * Database search calls made by Abu Rannat, kept within what the database can
 * take at once.
 *
 * Abu Rannat used to send one quick_search_v4 / universal_search_v3 call per
 * extracted term, all at the same moment. On this database a short query
 * takes about a second and public queries are cut at 3 seconds; with ten or
 * more arriving together some ran past the limit (Supabase logs, 2026-11-04:
 * pairs of «statement timeout» → 500 from the server side). Each failure was
 * silently treated as «no results», so an article or case could drop out of
 * an analysis without anyone knowing.
 *
 * Now: at most SEARCH_CONCURRENCY calls at a time, one retry for a timeout,
 * and a count of what still failed (logged without any of the user's text).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const SEARCH_CONCURRENCY = 3;
const TIMEOUT_CODE = "57014";

/** Like Promise.all(items.map(fn)), but at most `limit` calls run at once.
 * Results keep the order of `items`. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export type SearchFailures = { timeouts: number; retried: number; failed: number };

export function newSearchFailures(): SearchFailures {
  return { timeouts: 0, retried: 0, failed: 0 };
}

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/** One RPC call; a statement timeout is retried once. Anything still failing
 * is counted in `stats` and returned as the error, as before. */
export async function rpcWithRetry(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  stats?: SearchFailures,
): Promise<RpcResult> {
  let res = (await supabase.rpc(fn, args)) as RpcResult;
  if (res.error?.code === TIMEOUT_CODE) {
    if (stats) { stats.timeouts++; stats.retried++; }
    res = (await supabase.rpc(fn, args)) as RpcResult;
  }
  if (res.error && stats) stats.failed++;
  return res;
}

/** One line in the server log when something was lost — never the facts. */
export function logSearchFailures(stats: SearchFailures, where: string): void {
  if (stats.timeouts || stats.failed) {
    console.warn(`[abu-rannat] ${where}: search timeouts=${stats.timeouts} retried=${stats.retried} still_failed=${stats.failed}`);
  }
}
