"use client";

/**
 * Client-side API response caching layer backed by localStorage.
 *
 * Exports:
 *  - `cachedFetch`   — drop-in replacement for `fetch` that caches JSON responses.
 *  - `clearApiCache` — removes all cached entries from localStorage.
 *  - `getCacheSize`  — returns approximate total size of cached data in bytes.
 */

const CACHE_PREFIX = "__api_cache__";
const MAX_CACHE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface CacheEntry {
  /** Serialised JSON response body */
  body: string;
  /** Response status */
  status: number;
  /** Response status text */
  statusText: string;
  /** Subset of response headers worth preserving */
  headers: Record<string, string>;
  /** Timestamp (ms) when the entry was written */
  ts: number;
  /** TTL in ms */
  ttl: number;
}

function cacheKey(url: string): string {
  return `${CACHE_PREFIX}${url}`;
}

/** Return all localStorage keys that belong to our cache. */
function cacheKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(CACHE_PREFIX)) {
      keys.push(k);
    }
  }
  return keys;
}

/** Approximate byte size of a string (UTF-16 in JS, but we estimate using UTF-8). */
function byteSize(str: string): number {
  return new Blob([str]).size;
}

/** Evict oldest entries until total cache size is under `maxBytes`. */
function evictIfNeeded(maxBytes: number): void {
  const entries: { key: string; ts: number; size: number }[] = [];

  for (const key of cacheKeys()) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed: CacheEntry = JSON.parse(raw);
      entries.push({ key, ts: parsed.ts, size: byteSize(raw) });
    } catch {
      // Corrupt entry — remove it
      localStorage.removeItem(key);
    }
  }

  // Sort oldest first
  entries.sort((a, b) => a.ts - b.ts);

  let total = entries.reduce((sum, e) => sum + e.size, 0);

  while (total > maxBytes && entries.length > 0) {
    const oldest = entries.shift()!;
    localStorage.removeItem(oldest.key);
    total -= oldest.size;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch with transparent client-side caching.
 *
 * - **Online**: performs a real `fetch`, caches the JSON response, and returns it.
 * - **Offline**: returns the cached response when available; throws otherwise.
 *
 * Only caches responses for GET requests (or when no method / body is provided).
 *
 * @param url     The URL to fetch.
 * @param options Standard `RequestInit` plus an optional `ttl` (ms, default 5 min).
 */
export async function cachedFetch(
  url: string,
  options?: RequestInit & { ttl?: number }
): Promise<Response> {
  const ttl = options?.ttl ?? DEFAULT_TTL_MS;
  const method = (options?.method ?? "GET").toUpperCase();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // Only cache GET-like requests
  const isCacheable = method === "GET" && !options?.body;

  // ---------- offline path ----------
  if (!isOnline) {
    if (!isCacheable) {
      throw new Error("Cannot perform non-GET requests while offline.");
    }

    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) {
      throw new Error(`No cached response available for ${url}`);
    }

    try {
      const entry: CacheEntry = JSON.parse(raw);
      return new Response(entry.body, {
        status: entry.status,
        statusText: entry.statusText,
        headers: entry.headers,
      });
    } catch {
      localStorage.removeItem(cacheKey(url));
      throw new Error(`Cached response for ${url} is corrupt.`);
    }
  }

  // ---------- online path ----------
  const response = await fetch(url, options);

  if (isCacheable && response.ok) {
    try {
      // Clone so the caller can still consume the original body
      const clone = response.clone();
      const body = await clone.text();

      const headersToStore: Record<string, string> = {};
      clone.headers.forEach((value, key) => {
        headersToStore[key] = value;
      });

      const entry: CacheEntry = {
        body,
        status: clone.status,
        statusText: clone.statusText,
        headers: headersToStore,
        ts: Date.now(),
        ttl,
      };

      const serialised = JSON.stringify(entry);

      // Evict old entries if adding this one would exceed the limit
      evictIfNeeded(MAX_CACHE_BYTES - byteSize(serialised));

      localStorage.setItem(cacheKey(url), serialised);
    } catch (e) {
      // Caching is best-effort; swallow write errors (e.g. quota exceeded)
      console.warn("[api-cache] Failed to cache response:", e);
    }
  }

  return response;
}

/** Remove all cached API responses from localStorage. */
export function clearApiCache(): void {
  for (const key of cacheKeys()) {
    localStorage.removeItem(key);
  }
}

/** Return the approximate total size (in bytes) of all cached API responses. */
export function getCacheSize(): number {
  let total = 0;
  for (const key of cacheKeys()) {
    const raw = localStorage.getItem(key);
    if (raw) {
      total += byteSize(raw);
    }
  }
  return total;
}
