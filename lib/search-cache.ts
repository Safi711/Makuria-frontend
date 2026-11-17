/**
 * Short-lived in-memory cache for quick_search_v4 results.
 *
 * Search results are public and identical for every visitor, so a repeated
 * question can be answered from memory instead of asking the database again.
 * Only successful responses are stored: an error is never cached, so the next
 * visitor retries the database.
 *
 * SEARCH_CACHE_TTL_MS  how long a result stays valid (default 600000 = 10 min); 0 disables the cache
 */

type Stored = { data: unknown; error: unknown; at: number };

const MAX_ENTRIES = 500;
const store = new Map<string, Stored>();

function ttlMs(): number {
  const raw = process.env.SEARCH_CACHE_TTL_MS;
  if (raw === undefined || raw === "") return 600_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 600_000;
}

/**
 * Returns the cached { data, error } for `key` when fresh; otherwise runs `run`,
 * caches a successful result, and returns it.
 */
export async function cachedSearch<T extends { data: unknown; error: unknown }>(
  key: string,
  run: () => PromiseLike<T>,
): Promise<T> {
  const ttl = ttlMs();
  if (ttl === 0) return await run();

  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return { data: hit.data, error: hit.error } as T;
  }

  const fresh = await run();
  if (!fresh.error) {
    if (store.size >= MAX_ENTRIES) {
      // Drop the oldest entry (Map keeps insertion order).
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { data: fresh.data, error: fresh.error, at: Date.now() });
  }
  return fresh;
}
