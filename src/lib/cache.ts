/**
 * PostgreSQL-backed caching layer with TTL expiration.
 *
 * Uses an UNLOGGED table ("cache") for fast key-value storage with automatic
 * expiry. This replaces the previous in-memory Map, which was ineffective in
 * serverless environments (Vercel) where each invocation gets its own memory.
 *
 * Public API:
 *  - `cache.get(key)`                      — retrieve a cached value
 *  - `cache.set(key, value, ttlSeconds)`   — store a value with TTL
 *  - `cache.del(key)`                      — delete a single key
 *  - `cache.invalidatePattern(prefix)`     — delete all keys matching a prefix
 *  - `cache.clear()`                       — remove all cached entries
 *  - `cached(key, fetcher, ttlMs)`         — fetch-through helper (backward compatible)
 *  - `invalidateCache(key)`                — delete a single key (alias)
 *  - `invalidateCacheByPrefix(prefix)`     — delete keys by prefix (alias)
 *  - `clearCache()`                        — remove all cached entries
 */

import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Row shape returned by SELECT on the cache table. */
interface CacheRow {
  value: unknown;
}

// ---------------------------------------------------------------------------
// Public cache object
// ---------------------------------------------------------------------------

export const cache = {
  /**
   * Retrieve a cached value by key.
   * Returns null on cache miss or if the entry has expired.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const rows = await prisma.$queryRawUnsafe<CacheRow[]>(
        `SELECT "value" FROM "cache" WHERE "key" = $1 AND "expires_at" > NOW()`,
        key,
      );
      if (rows.length === 0) return null;
      return rows[0].value as T;
    } catch (error) {
      console.error("[cache] get failed:", error);
      return null;
    }
  },

  /**
   * Store a value with a TTL in seconds (default 300 = 5 minutes).
   * Uses an upsert so existing keys are updated atomically.
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "cache" ("key", "value", "expires_at")
         VALUES ($1, $2::jsonb, NOW() + make_interval(secs => $3))
         ON CONFLICT ("key")
         DO UPDATE SET "value" = $2::jsonb,
                       "expires_at" = NOW() + make_interval(secs => $3)`,
        key,
        JSON.stringify(value),
        ttlSeconds,
      );
    } catch (error) {
      console.error("[cache] set failed:", error);
    }
  },

  /**
   * Delete a single cache entry by exact key.
   */
  async del(key: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "cache" WHERE "key" = $1`,
        key,
      );
    } catch (error) {
      console.error("[cache] del failed:", error);
    }
  },

  /**
   * Delete all cache entries whose key starts with the given prefix.
   */
  async invalidatePattern(prefix: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "cache" WHERE "key" LIKE $1`,
        prefix + "%",
      );
    } catch (error) {
      console.error("[cache] invalidatePattern failed:", error);
    }
  },

  /**
   * Remove all entries from the cache table.
   */
  async clear(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "cache"`);
    } catch (error) {
      console.error("[cache] clear failed:", error);
    }
  },
};

// ---------------------------------------------------------------------------
// Backward-compatible helpers (used by data.ts and API routes)
// ---------------------------------------------------------------------------

/**
 * Get or set cached data with TTL.
 * @param key    Cache key
 * @param fetcher Async function to fetch data on cache miss
 * @param ttlMs  Time to live in milliseconds (default 5 minutes)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000,
): Promise<T> {
  // Try the cache first; on PG failure we still fall through to fetcher.
  const existing = await cache.get<T>(key);
  if (existing !== null) {
    return existing;
  }

  const data = await fetcher();

  // Store in cache (fire-and-forget; errors are logged inside cache.set).
  const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000));
  await cache.set(key, data, ttlSeconds);

  return data;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  await cache.del(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  await cache.invalidatePattern(prefix);
}

/**
 * Clear entire cache.
 */
export async function clearCache(): Promise<void> {
  await cache.clear();
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
 *   await invalidateCache("status_types");
 */
