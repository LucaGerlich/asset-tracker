// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost:3000/" }
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock("idb-keyval", () => ({
  createStore: vi.fn(() => "offline-store"),
  get: vi.fn(async (key: string) => mocks.store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    mocks.store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    mocks.store.delete(key);
  }),
  keys: vi.fn(async () => Array.from(mocks.store.keys())),
  clear: vi.fn(async () => {
    mocks.store.clear();
  }),
}));

import {
  classifyReplayStatus,
  clearOfflineQueue,
  clearQueueOnSignOut,
  discardMutation,
  getQueueSnapshot,
  postToServiceWorker,
  REPLAY_LOCK_NAME,
  replayQueue,
  resolveUserAnnouncement,
  type QueuedMutation,
} from "@/lib/offline-queue";

function entry(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: "m1",
    url: "http://localhost:3000/api/assets",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"name":"Laptop"}',
    timestamp: 1,
    retryCount: 0,
    userId: "u1",
    ...overrides,
  };
}

function seed(...entries: QueuedMutation[]): void {
  for (const item of entries) mocks.store.set(item.id, item);
}

function stored(id: string): QueuedMutation | undefined {
  return mocks.store.get(id) as QueuedMutation | undefined;
}

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  mocks.store.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyReplayStatus", () => {
  it.each([
    [200, "succeeded"],
    [201, "succeeded"],
    [204, "succeeded"],
    [400, "dropped"],
    [401, "blocked"],
    [403, "blocked"],
    [404, "dropped"],
    [409, "blocked"],
    [422, "blocked"],
    [429, "retry"],
    [500, "retry"],
    [503, "retry"],
  ])("maps %i to %s", (status, outcome) => {
    expect(classifyReplayStatus(status)).toBe(outcome);
  });

  it("keeps responses it does not know for review instead of dropping them", () => {
    expect(classifyReplayStatus(405)).toBe("blocked");
    expect(classifyReplayStatus(302)).toBe("blocked");
  });
});

describe("replayQueue", () => {
  it("sends the replay marker header with every request", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await replayQueue("u1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/assets");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"name":"Laptop"}');
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-offline-replay": "1",
    });
  });

  it("skips entries that belong to another user without sending them", async () => {
    seed(entry({ id: "m1", userId: "u2" }));

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      succeeded: 0,
      blocked: 0,
      dropped: 0,
      failed: 0,
    });
    expect(stored("m1")).toMatchObject({ userId: "u2" });
    expect(stored("m1")?.status).toBeUndefined();
  });

  it("never sends an entry with an unknown owner and holds it for review", async () => {
    seed(entry({ id: "legacy", userId: null }));

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.blocked).toBe(1);
    expect(stored("legacy")).toMatchObject({
      status: "blocked",
      lastCode: "unknown_owner",
    });
  });

  it("treats entries written before owners were recorded as unknown owner", async () => {
    const legacy: Partial<QueuedMutation> = entry({ id: "old" });
    delete legacy.userId;
    mocks.store.set("old", legacy);

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.blocked).toBe(1);
  });

  it("removes an entry the server accepted", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await replayQueue("u1");

    expect(result).toEqual({
      succeeded: 1,
      blocked: 0,
      dropped: 0,
      failed: 0,
    });
    expect(stored("m1")).toBeUndefined();
  });

  it("keeps a denied entry as blocked with the server's code and message", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: "Organization is read-only",
        code: "org_read_only",
      }),
    );

    const result = await replayQueue("u1");

    expect(result.blocked).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(stored("m1")).toMatchObject({
      status: "blocked",
      lastStatus: 403,
      lastCode: "org_read_only",
      lastError: "Organization is read-only",
      retryCount: 0,
    });
  });

  it("keeps a denied entry even when the body is not JSON", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(
      new Response("<html>nope</html>", { status: 401 }),
    );

    await replayQueue("u1");

    const kept = stored("m1");
    expect(kept).toMatchObject({ status: "blocked", lastStatus: 401 });
    expect(kept?.lastCode).toBeUndefined();
    expect(kept?.lastError).toBeTruthy();
  });

  it.each([401, 409, 422])("blocks on %i", async (status) => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(status, { error: "No" }));

    const result = await replayQueue("u1");

    expect(result.blocked).toBe(1);
    expect(stored("m1")?.status).toBe("blocked");
  });

  it("does not re-send blocked entries on the next pass", async () => {
    seed(entry({ status: "blocked", lastStatus: 403 }));

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      succeeded: 0,
      blocked: 0,
      dropped: 0,
      failed: 0,
    });
    expect(stored("m1")?.status).toBe("blocked");
  });

  it("removes a not-found entry and counts it as dropped", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found" }));

    const result = await replayQueue("u1");

    expect(result).toEqual({
      succeeded: 0,
      blocked: 0,
      dropped: 1,
      failed: 0,
    });
    expect(stored("m1")).toBeUndefined();
  });

  it("removes an invalid entry (400) and counts it as dropped", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "Invalid" }));

    const result = await replayQueue("u1");

    expect(result.dropped).toBe(1);
    expect(stored("m1")).toBeUndefined();
  });

  it("retries a server error and gives up on the third attempt", async () => {
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(503));

    const first = await replayQueue("u1");
    expect(first.failed).toBe(0);
    expect(stored("m1")?.retryCount).toBe(1);

    const second = await replayQueue("u1");
    expect(second.failed).toBe(0);
    expect(stored("m1")?.retryCount).toBe(2);

    const third = await replayQueue("u1");
    expect(third.failed).toBe(1);
    expect(stored("m1")).toBeUndefined();
  });

  it("stops the whole pass on a rate limit and keeps the entries", async () => {
    seed(
      entry({ id: "a", timestamp: 1 }),
      entry({ id: "b", timestamp: 2 }),
      entry({ id: "c", timestamp: 3 }),
    );
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(429, { error: "Too many requests" }));

    const result = await replayQueue("u1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(stored("a")).toBeUndefined();
    expect(stored("b")).toMatchObject({ retryCount: 0 });
    expect(stored("b")?.status).toBeUndefined();
    expect(stored("c")).toBeDefined();
  });

  it("stops and keeps the entry when the network is unreachable", async () => {
    seed(entry({ id: "a", timestamp: 1 }), entry({ id: "b", timestamp: 2 }));
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await replayQueue("u1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      succeeded: 0,
      blocked: 0,
      dropped: 0,
      failed: 0,
    });
    expect(stored("a")).toBeDefined();
    expect(stored("b")).toBeDefined();
  });

  it("replays in the order the changes were made", async () => {
    seed(
      entry({ id: "late", timestamp: 20, url: "http://localhost:3000/api/b" }),
      entry({ id: "early", timestamp: 10, url: "http://localhost:3000/api/a" }),
    );
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await replayQueue("u1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3000/api/a",
      "http://localhost:3000/api/b",
    ]);
  });

  it("drops entries aimed at another origin instead of sending them", async () => {
    seed(entry({ url: "https://analytics.example.com/api/send" }));

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.dropped).toBe(1);
    expect(stored("m1")).toBeUndefined();
  });
});

describe("replayQueue and legacy auth entries", () => {
  const authEntry = (overrides: Partial<QueuedMutation> = {}) =>
    entry({
      id: "auth",
      url: "http://localhost:3000/api/auth/sign-in/email",
      body: '{"email":"a@b.c","password":"hunter2"}',
      userId: null,
      ...overrides,
    });

  it("deletes ownerless auth requests without sending or reporting them", async () => {
    seed(
      authEntry(),
      authEntry({ id: "auth-root", url: "http://localhost:3000/api/auth" }),
    );

    const result = await replayQueue("u1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ succeeded: 0, blocked: 0, dropped: 0, failed: 0 });
    expect(mocks.store.size).toBe(0);
  });

  it("deletes them when the page only reads the queue", async () => {
    seed(authEntry(), entry({ id: "mine" }));

    const snapshot = await getQueueSnapshot("u1");

    expect(stored("auth")).toBeUndefined();
    expect(snapshot.pendingCount).toBe(1);
    expect(snapshot.blocked).toEqual([]);
  });

  it("keeps other ownerless entries for review", async () => {
    seed(authEntry({ id: "legacy", url: "http://localhost:3000/api/authors" }));

    const result = await replayQueue("u1");

    expect(result.blocked).toBe(1);
    expect(stored("legacy")?.status).toBe("blocked");
  });
});

describe("replayQueue across tabs", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("runs under the replay lock when the browser has Web Locks", async () => {
    const request = vi.fn(
      async (_name: string, callback: () => Promise<unknown>) => callback(),
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const result = await replayQueue("u1");

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(REPLAY_LOCK_NAME);
    expect(REPLAY_LOCK_NAME).toBe("asset-tracker-offline-replay");
    expect(result.succeeded).toBe(1);
  });

  it("reads the queue only after the lock is granted", async () => {
    const { keys } = await import("idb-keyval");
    vi.mocked(keys).mockClear();
    let grant: () => void = () => {};
    const granted = new Promise<void>((resolve) => (grant = resolve));
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          await granted;
          return callback();
        },
      },
    });
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const replay = replayQueue("u1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(keys).not.toHaveBeenCalled();
    grant();
    const result = await replay;

    expect(keys).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it("runs directly when Web Locks are not available", async () => {
    expect(navigator.locks).toBeFalsy();
    seed(entry());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const result = await replayQueue("u1");

    expect(result.succeeded).toBe(1);
  });
});

describe("resolveUserAnnouncement", () => {
  it("announces a signed-in user", () => {
    expect(
      resolveUserAnnouncement({ isPending: false, userId: "u1", error: null }),
    ).toEqual({ userId: "u1" });
  });

  it("announces nobody when the session answered with no user", () => {
    expect(
      resolveUserAnnouncement({ isPending: false, userId: null, error: null }),
    ).toEqual({ userId: null });
  });

  it("announces nobody when the server said unauthorized", () => {
    expect(
      resolveUserAnnouncement({
        isPending: false,
        userId: null,
        error: { status: 401, statusText: "Unauthorized" },
      }),
    ).toEqual({ userId: null });
  });

  it("says nothing while the session is loading", () => {
    expect(
      resolveUserAnnouncement({ isPending: true, userId: null, error: null }),
    ).toBeNull();
  });

  it.each([
    ["a network failure", new TypeError("Failed to fetch")],
    ["a failed lookup", { status: 0, statusText: "" }],
    ["a server error", { status: 503, statusText: "Service Unavailable" }],
  ])("says nothing when the lookup failed with %s", (_label, error) => {
    expect(
      resolveUserAnnouncement({ isPending: false, userId: null, error }),
    ).toBeNull();
  });

  it("keeps announcing a known user even if a later refresh failed", () => {
    expect(
      resolveUserAnnouncement({
        isPending: false,
        userId: "u1",
        error: new TypeError("Failed to fetch"),
      }),
    ).toEqual({ userId: "u1" });
  });
});

describe("getQueueSnapshot", () => {
  it("counts only the user's pending entries and lists their blocked ones", async () => {
    seed(
      entry({ id: "mine-pending", timestamp: 1 }),
      entry({
        id: "mine-blocked",
        timestamp: 2,
        status: "blocked",
        lastStatus: 403,
      }),
      entry({ id: "theirs", timestamp: 3, userId: "u2" }),
      entry({
        id: "theirs-blocked",
        timestamp: 4,
        userId: "u2",
        status: "blocked",
      }),
    );

    const snapshot = await getQueueSnapshot("u1");

    expect(snapshot.pendingCount).toBe(1);
    expect(snapshot.blocked.map((item) => item.id)).toEqual(["mine-blocked"]);
  });

  it("shows entries with an unknown owner to the signed-in user", async () => {
    seed(entry({ id: "legacy", userId: null, status: "blocked" }));

    const snapshot = await getQueueSnapshot("u1");

    expect(snapshot.blocked.map((item) => item.id)).toEqual(["legacy"]);
  });
});

describe("discardMutation", () => {
  it("removes only the given entry", async () => {
    seed(entry({ id: "a" }), entry({ id: "b" }));

    await discardMutation("a");

    expect(stored("a")).toBeUndefined();
    expect(stored("b")).toBeDefined();
  });
});

describe("clearOfflineQueue", () => {
  it("empties the store", async () => {
    seed(entry({ id: "a" }), entry({ id: "b", userId: "u2" }));

    await clearOfflineQueue();

    expect(mocks.store.size).toBe(0);
  });
});

describe("postToServiceWorker", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("posts to the controlling worker", async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: { postMessage } },
    });

    await postToServiceWorker({ type: "SET_USER", userId: "u1" });

    expect(postMessage).toHaveBeenCalledWith({
      type: "SET_USER",
      userId: "u1",
    });
  });

  it("falls back to the active registration before the page is controlled", async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: null,
        getRegistration: vi.fn(async () => ({ active: { postMessage } })),
      },
    });

    await postToServiceWorker({ type: "CLEAR_QUEUE" });

    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_QUEUE" });
  });

  it("does nothing without service worker support", async () => {
    await expect(
      postToServiceWorker({ type: "CLEAR_QUEUE" }),
    ).resolves.toBeUndefined();
  });
});

describe("clearQueueOnSignOut", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("wipes the queue and tells the worker to forget the user", async () => {
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: { postMessage } },
    });
    seed(entry({ id: "a" }), entry({ id: "b", userId: "u2" }));

    await clearQueueOnSignOut();

    expect(mocks.store.size).toBe(0);
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_QUEUE" });
  });

  it("does not throw when IndexedDB is unavailable", async () => {
    const { clear } = await import("idb-keyval");
    vi.mocked(clear).mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    await expect(clearQueueOnSignOut()).resolves.toBeUndefined();
  });
});
