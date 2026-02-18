interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get or set cached data with TTL
 * @param key Cache key
 * @param fetcher Async function to fetch data on cache miss
 * @param ttlMs Time to live in milliseconds (default 5 minutes)
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 5 * 60 * 1000): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache keys matching a prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Cache invalidation guide for API routes:
 *
 * When an API route modifies reference data (create, update, or delete),
 * call invalidateCache() with the appropriate key after the successful
 * database operation.
 *
 * Cache keys used by reference data functions in src/lib/data.ts:
 *   - "status_types"   -> invalidate after modifying statusType records
 *   - "categories"     -> invalidate after modifying assetCategoryType records
 *   - "manufacturers"  -> invalidate after modifying manufacturer records
 *   - "models"         -> invalidate after modifying model records
 *   - "locations"      -> invalidate after modifying location records
 *   - "suppliers"      -> invalidate after modifying supplier records
 *   - "users"          -> invalidate after modifying user records
 *
 * Example usage in an API route:
 *
 *   import { invalidateCache } from "@/lib/cache";
 *
 *   // After a successful create/update/delete:
 *   await prisma.statusType.create({ data: { ... } });
 *   invalidateCache("status_types");
 *
 * You can also use invalidateCacheByPrefix() to clear multiple related
 * keys at once, or clearCache() to reset everything (e.g., after a
 * bulk import operation).
 */
