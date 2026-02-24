import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module for clean cache state between tests
let cacheModule: typeof import("../cache");

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
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
    cacheModule.invalidateCache("key");
    const result = await cacheModule.cached("key", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toBe("second");
  });

  it("does not affect other keys", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A");
    const fetcherB = vi.fn().mockResolvedValue("B");

    await cacheModule.cached("keyA", fetcherA);
    await cacheModule.cached("keyB", fetcherB);

    cacheModule.invalidateCache("keyA");

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

    cacheModule.invalidateCacheByPrefix("user:");

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

    cacheModule.clearCache();

    await cacheModule.cached("keyA", fetcherA);
    await cacheModule.cached("keyB", fetcherB);

    expect(fetcherA).toHaveBeenCalledTimes(2);
    expect(fetcherB).toHaveBeenCalledTimes(2);
  });
});
