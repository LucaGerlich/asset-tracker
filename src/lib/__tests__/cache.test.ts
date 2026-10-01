import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import prisma from "@/lib/prisma";
// Integration tests: exercise the real Postgres-backed cache table.
// Skipped when no DATABASE_URL is configured (they run in CI against a test DB).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const SCHEMA = process.env.DB_SCHEMA || "assettool";
const CACHE_TABLE = `"${SCHEMA}"."cache"`;

// Reset module for clean cache state between tests
let cacheModule: typeof import("../cache");

// Keys written by the tests below, cleaned before every test and after the suite.
const TEST_KEYS = [
  "test-key",
  "key",
  "keyA",
  "keyB",
  "asset:1",
  "user:1",
  "user:2",
  "foo",
  "ref:cats",
  "ref:dogs",
  "other:x",
  "ttl-test",
];

async function clearTestKeys(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await prisma.$executeRawUnsafe(
    `DELETE FROM ${CACHE_TABLE} WHERE "key" = ANY($1)`,
    TEST_KEYS,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  cacheModule = await import("../cache");
  await clearTestKeys();
});

afterAll(clearTestKeys);

// ponytail: expiry is decided by Postgres NOW(), so fake timers cannot move it.
// TTL tests use a real 1-second TTL (the minimum `cached()` stores) and sleep past it.
describeDb("cached", () => {
  it("calls fetcher on first access", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: "hello" });
    const result = await cacheModule.cached("test-key", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: "hello" });
  });

  it("returns cached value on second access (no re-fetch)", async () => {
    const fetcher = vi.fn().mockResolvedValue("value");
    await cacheModule.cached("key", fetcher);
    const result = await cacheModule.cached("key", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toBe("value");
  });

  it("re-fetches after TTL expires", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");

    await cacheModule.cached("key", fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await sleep(1100);

    const result = await cacheModule.cached("key", fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe("new");
  });

  it("does not re-fetch before TTL expires", async () => {
    const fetcher = vi.fn().mockResolvedValue("value");

    await cacheModule.cached("key", fetcher, 5000);
    await cacheModule.cached("key", fetcher, 5000);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("uses default TTL of 5 minutes", async () => {
    const fetcher = vi.fn().mockResolvedValue("value");
    await cacheModule.cached("key", fetcher);

    const rows = await prisma.$queryRawUnsafe<{ secs: number }[]>(
      `SELECT EXTRACT(EPOCH FROM ("expires_at" - NOW()))::float8 AS secs
			 FROM ${CACHE_TABLE} WHERE "key" = $1`,
      "key",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].secs).toBeGreaterThan(290);
    expect(rows[0].secs).toBeLessThanOrEqual(300);
  });
});

describeDb("invalidateCache", () => {
  it("forces re-fetch after invalidation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    await cacheModule.cached("key", fetcher);
    await cacheModule.invalidateCache("key");
    const result = await cacheModule.cached("key", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe("second");
  });

  it("does not affect other keys", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A");
    const fetcherB = vi.fn().mockResolvedValue("B");

    await cacheModule.cached("keyA", fetcherA);
    await cacheModule.cached("keyB", fetcherB);

    await cacheModule.invalidateCache("keyA");

    await cacheModule.cached("keyB", fetcherB);
    expect(fetcherB).toHaveBeenCalledOnce(); // Still cached
  });
});

describeDb("invalidateCacheByPrefix", () => {
  it("invalidates all keys with given prefix", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A");
    const fetcherB = vi.fn().mockResolvedValue("B");
    const fetcherC = vi.fn().mockResolvedValue("C");

    await cacheModule.cached("user:1", fetcherA);
    await cacheModule.cached("user:2", fetcherB);
    await cacheModule.cached("asset:1", fetcherC);

    await cacheModule.invalidateCacheByPrefix("user:");

    await cacheModule.cached("user:1", fetcherA);
    await cacheModule.cached("user:2", fetcherB);
    await cacheModule.cached("asset:1", fetcherC);

    expect(fetcherA).toHaveBeenCalledTimes(2); // Re-fetched
    expect(fetcherB).toHaveBeenCalledTimes(2); // Re-fetched
    expect(fetcherC).toHaveBeenCalledOnce(); // Still cached
  });
});

describeDb("clearCache", () => {
  it("invalidates all cached keys", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A");
    const fetcherB = vi.fn().mockResolvedValue("B");

    await cacheModule.cached("keyA", fetcherA);
    await cacheModule.cached("keyB", fetcherB);

    await cacheModule.clearCache();

    await cacheModule.cached("keyA", fetcherA);
    await cacheModule.cached("keyB", fetcherB);

    expect(fetcherA).toHaveBeenCalledTimes(2);
    expect(fetcherB).toHaveBeenCalledTimes(2);
  });
});

describeDb("cache object API", () => {
  it("supports get/set/del", async () => {
    const { cache } = cacheModule;

    // Initially empty
    expect(await cache.get("foo")).toBeNull();

    // Set and get
    await cache.set("foo", { bar: 42 }, 60);
    expect(await cache.get("foo")).toEqual({ bar: 42 });

    // Delete
    await cache.del("foo");
    expect(await cache.get("foo")).toBeNull();
  });

  it("supports invalidatePattern", async () => {
    const { cache } = cacheModule;

    await cache.set("ref:cats", ["a"], 60);
    await cache.set("ref:dogs", ["b"], 60);
    await cache.set("other:x", ["c"], 60);

    await cache.invalidatePattern("ref:");

    expect(await cache.get("ref:cats")).toBeNull();
    expect(await cache.get("ref:dogs")).toBeNull();
    expect(await cache.get("other:x")).toEqual(["c"]);
  });

  it("respects TTL expiration", async () => {
    const { cache } = cacheModule;

    await cache.set("ttl-test", "value", 1); // 1 second
    expect(await cache.get("ttl-test")).toBe("value");

    await sleep(1100);
    expect(await cache.get("ttl-test")).toBeNull();
  });
});
