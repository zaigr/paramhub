/**
 * Simple TTL (time-to-live) cache for provider responses.
 *
 * Used to avoid redundant network calls when the user navigates
 * back to a previously-viewed search result set.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/** Default TTL: 30 seconds. */
const DEFAULT_TTL_MS = 30_000;

export class TTLCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();
  private readonly ttl: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttl = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttl });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove expired entries (optional housekeeping). */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
