/**
 * Universal caching layer with Redis (Upstash) support and in-memory fallback.
 *
 * When `REDIS_URL` is set, uses Upstash Redis for distributed caching.
 * Otherwise, falls back to a simple in-memory Map with TTL expiration.
 *
 * Public API:
 *  - `cache.get(key)`                      — retrieve a cached value
 *  - `cache.set(key, value, ttlSeconds)`   — store a value with TTL
 *  - `cache.del(key)`                      — delete a single key
 *  - `cache.invalidatePattern(prefix)`     — delete all keys matching a prefix
 *  - `cached(key, fetcher, ttlMs)`         — fetch-through helper (backward compatible)
 *  - `invalidateCache(key)`                — delete a single key (alias)
 *  - `invalidateCacheByPrefix(prefix)`     — delete keys by prefix (alias)
 *  - `clearCache()`                        — remove all cached entries
 */

// ---------------------------------------------------------------------------
// Cache backend interface
// ---------------------------------------------------------------------------

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidatePattern(prefix: string): Promise<void>;
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory backend
// ---------------------------------------------------------------------------

interface MemoryEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

class MemoryCacheBackend implements CacheBackend {
  private store = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as MemoryEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePattern(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Redis (Upstash) backend
// ---------------------------------------------------------------------------

class RedisCacheBackend implements CacheBackend {
  private client: {
    get: Function;
    set: Function;
    del: Function;
    scan: Function;
  };
  private keyPrefix = "cache:";

  constructor(redisClient: {
    get: Function;
    set: Function;
    del: Function;
    scan: Function;
  }) {
    this.client = redisClient;
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(this.prefixed(key));
      if (raw === null || raw === undefined) return null;
      // Upstash auto-deserializes JSON, but handle string case too
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      }
      return raw as T;
    } catch (err) {
      console.warn("[cache] Redis GET failed, returning null:", err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(this.prefixed(key), serialized, { ex: ttlSeconds });
    } catch (err) {
      console.warn("[cache] Redis SET failed:", err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(this.prefixed(key));
    } catch (err) {
      console.warn("[cache] Redis DEL failed:", err);
    }
  }

  async invalidatePattern(prefix: string): Promise<void> {
    try {
      // Upstash supports SCAN-based key listing
      const pattern = `${this.keyPrefix}${prefix}*`;
      let cursor = 0;
      do {
        const [nextCursor, keys]: [number, string[]] = await this.client.scan(
          cursor,
          { match: pattern, count: 100 },
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== 0);
    } catch (err) {
      console.warn("[cache] Redis invalidatePattern failed:", err);
    }
  }

  async clear(): Promise<void> {
    await this.invalidatePattern("");
  }
}

// ---------------------------------------------------------------------------
// Backend initialization
// ---------------------------------------------------------------------------

let _backend: CacheBackend | null = null;

async function getBackend(): Promise<CacheBackend> {
  if (_backend) return _backend;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Dynamic import so the app works without @upstash/redis installed
      // @ts-ignore -- optional dependency, may not be installed
      const { Redis } = await import("@upstash/redis");
      const client = new Redis({
        url: redisUrl,
        token: process.env.REDIS_TOKEN ?? "",
      });
      _backend = new RedisCacheBackend(client);
      console.info("[cache] Using Upstash Redis backend");
      return _backend;
    } catch (err) {
      console.warn(
        "[cache] Failed to initialize Redis backend, falling back to in-memory:",
        err,
      );
    }
  }

  _backend = new MemoryCacheBackend();
  return _backend;
}

// Eagerly initialize to avoid repeated async overhead on hot paths
const backendPromise = getBackend();

// ---------------------------------------------------------------------------
// Public cache object
// ---------------------------------------------------------------------------

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const backend = await backendPromise;
    return backend.get<T>(key);
  },

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const backend = await backendPromise;
    return backend.set(key, value, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    const backend = await backendPromise;
    return backend.del(key);
  },

  async invalidatePattern(prefix: string): Promise<void> {
    const backend = await backendPromise;
    return backend.invalidatePattern(prefix);
  },

  async clear(): Promise<void> {
    const backend = await backendPromise;
    return backend.clear();
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
  const backend = await backendPromise;
  const existing = await backend.get<T>(key);
  if (existing !== null) {
    return existing;
  }

  const data = await fetcher();
  const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000));
  await backend.set(key, data, ttlSeconds);
  return data;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const backend = await backendPromise;
  await backend.del(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  const backend = await backendPromise;
  await backend.invalidatePattern(prefix);
}

/**
 * Clear entire cache.
 */
export async function clearCache(): Promise<void> {
  const backend = await backendPromise;
  await backend.clear();
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
 *
 * You can also use invalidateCacheByPrefix() to clear multiple related
 * keys at once, or clearCache() to reset everything (e.g., after a
 * bulk import operation).
 */
