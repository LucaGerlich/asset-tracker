import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module for clean cache state between tests
let cacheModule: typeof import("../cache");

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  // Ensure no REDIS_URL so tests use in-memory backend
  delete process.env.REDIS_URL;
  cacheModule = await import("../cache");
});

describe("cached", () => {
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
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");

    await cacheModule.cached("key", fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);

    const result = await cacheModule.cached("key", fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe("new");

    vi.useRealTimers();
  });

  it("does not re-fetch before TTL expires", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue("value");

    await cacheModule.cached("key", fetcher, 5000);
    vi.advanceTimersByTime(4999);
    await cacheModule.cached("key", fetcher, 5000);
    expect(fetcher).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("uses default TTL of 5 minutes", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue("value");

    await cacheModule.cached("key", fetcher);
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    await cacheModule.cached("key", fetcher);
    expect(fetcher).toHaveBeenCalledOnce(); // Still cached

    vi.advanceTimersByTime(2 * 60 * 1000); // 6 minutes total
    await cacheModule.cached("key", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // Re-fetched

    vi.useRealTimers();
  });
});

describe("invalidateCache", () => {
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

describe("invalidateCacheByPrefix", () => {
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

describe("clearCache", () => {
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

describe("cache object API", () => {
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
    vi.useFakeTimers();
    const { cache } = cacheModule;

    await cache.set("ttl-test", "value", 10); // 10 seconds
    expect(await cache.get("ttl-test")).toBe("value");

    vi.advanceTimersByTime(11_000); // 11 seconds
    expect(await cache.get("ttl-test")).toBeNull();

    vi.useRealTimers();
  });
});
