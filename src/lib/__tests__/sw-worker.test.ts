import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Runs the real public/sw.js (and the rules file it imports) in a vm context
 * with just enough of the worker environment stubbed: no network, an in-memory
 * IndexedDB store and an in-memory Cache Storage.
 */

const USER_KEY = "/__sw-meta/user";
const ORIGIN = "http://localhost:3000";

interface QueuedEntry {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  userId: string | null;
}

interface WorkerOptions {
  /** Pre-existing Cache Storage content, shared between "restarts". */
  cacheStore?: Map<string, string>;
  /** Holds the cold read of the stored user until released. */
  gateColdRead?: boolean;
}

function publicFile(name: string): string {
  return readFileSync(join(process.cwd(), "public", name), "utf8");
}

function startWorker(options: WorkerOptions = {}) {
  const queue = new Map<string, QueuedEntry>();
  const cacheStore = options.cacheStore ?? new Map<string, string>();
  const listeners: Record<string, (event: unknown) => void> = {};
  let releaseRead: () => void = () => {};
  let signalReadStarted: () => void = () => {};
  const readGate = new Promise<void>((resolve) => (releaseRead = resolve));
  const readStarted = new Promise<void>(
    (resolve) => (signalReadStarted = resolve),
  );

  const self = {
    location: { origin: ORIGIN },
    skipWaiting: () => {},
    clients: { claim: () => {}, matchAll: async () => [] },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
  };

  const objectStore = {
    put: (entry: QueuedEntry, key: string) => queue.set(key, entry),
    clear: () => queue.clear(),
  };
  const indexedDB = {
    open: () => {
      const request: { result?: unknown; onsuccess?: () => void } = {};
      setTimeout(() => {
        request.result = {
          transaction: () => {
            const tx: { oncomplete?: () => void; objectStore: unknown } = {
              objectStore: () => objectStore,
            };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
        };
        request.onsuccess?.();
      }, 0);
      return request;
    },
  };

  const caches = {
    keys: async () => [],
    open: async () => ({
      match: async (key: string) => {
        const snapshot = cacheStore.get(key);
        signalReadStarted();
        if (options.gateColdRead) await readGate;
        return snapshot === undefined ? undefined : new Response(snapshot);
      },
      put: async (key: string, response: Response) => {
        cacheStore.set(key, await response.text());
      },
      delete: async (key: string) => cacheStore.delete(key),
    }),
  };

  const context = createContext({
    self,
    indexedDB,
    caches,
    crypto: globalThis.crypto,
    URL,
    Response,
    Promise,
    setTimeout,
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
    importScripts: (path: string) =>
      runInContext(publicFile(path.slice(1)), context),
  });
  runInContext(publicFile("sw.js"), context);

  /** Resolves with the worker's answer, or null when it did not intercept. */
  async function request(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body = "",
  ): Promise<Response | null> {
    const req = {
      method,
      url: `${ORIGIN}${path}`,
      headers: new Headers(headers),
      mode: "cors",
      clone() {
        return this;
      },
      text: async () => body,
    };
    let answer: Promise<Response> | null = null;
    listeners.fetch({
      request: req,
      respondWith: (promise: Promise<Response>) => {
        answer = promise;
      },
    });
    return answer;
  }

  async function message(data: unknown): Promise<void> {
    const pending: Promise<unknown>[] = [];
    listeners.message({
      data,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }

  return {
    queue,
    cacheStore,
    request,
    message,
    readStarted,
    releaseRead,
  };
}

const jsonHeaders = { "content-type": "application/json" };

describe("service worker queueing", () => {
  it("stamps a queued entry with the signed-in user and keeps only safe headers", async () => {
    const worker = startWorker();
    await worker.message({ type: "SET_USER", userId: "u1" });

    const answer = await worker.request(
      "PUT",
      "/api/asset",
      { ...jsonHeaders, cookie: "a=b", "x-expected-version": "3" },
      '{"assetname":"Laptop"}',
    );

    expect((await answer?.json()) as unknown).toMatchObject({ queued: true });
    expect(answer?.status).toBe(202);
    const [entry] = [...worker.queue.values()];
    expect(entry).toMatchObject({
      method: "PUT",
      url: `${ORIGIN}/api/asset`,
      userId: "u1",
      body: '{"assetname":"Laptop"}',
      headers: {
        "content-type": "application/json",
        "x-expected-version": "3",
      },
    });
    expect(entry.headers).not.toHaveProperty("cookie");
  });

  it("stamps null while nobody is signed in", async () => {
    const worker = startWorker();

    await worker.request("POST", "/api/asset", jsonHeaders, '{"a":1}');

    expect([...worker.queue.values()].map((e) => e.userId)).toEqual([null]);
  });

  it("remembers the user across a worker restart", async () => {
    const first = startWorker();
    await first.message({ type: "SET_USER", userId: "u1" });

    const restarted = startWorker({ cacheStore: first.cacheStore });
    await restarted.request("POST", "/api/asset", jsonHeaders, '{"a":1}');

    expect([...restarted.queue.values()].map((e) => e.userId)).toEqual(["u1"]);
  });

  it("lets a SET_USER that arrives during the cold read win", async () => {
    const stored = new Map([[USER_KEY, JSON.stringify({ userId: "old" })]]);
    const worker = startWorker({ cacheStore: stored, gateColdRead: true });

    const answer = worker.request("POST", "/api/asset", jsonHeaders, '{"a":1}');
    await worker.readStarted;
    await worker.message({ type: "SET_USER", userId: "new" });
    worker.releaseRead();
    await (await answer)?.json();

    expect([...worker.queue.values()].map((e) => e.userId)).toEqual(["new"]);
    expect(stored.get(USER_KEY)).toBe(JSON.stringify({ userId: "new" }));
  });

  it("lets a CLEAR_QUEUE that arrives during the cold read win", async () => {
    const stored = new Map([[USER_KEY, JSON.stringify({ userId: "old" })]]);
    const worker = startWorker({ cacheStore: stored, gateColdRead: true });

    const answer = worker.request("POST", "/api/asset", jsonHeaders, '{"a":1}');
    await worker.readStarted;
    await worker.message({ type: "CLEAR_QUEUE" });
    worker.releaseRead();
    await (await answer)?.json();

    expect([...worker.queue.values()].map((e) => e.userId)).toEqual([null]);
  });

  it("clears the queue, the user and the stored user on CLEAR_QUEUE", async () => {
    const worker = startWorker();
    await worker.message({ type: "SET_USER", userId: "u1" });
    await worker.request("POST", "/api/asset", jsonHeaders, '{"a":1}');
    expect(worker.queue.size).toBe(1);
    expect(worker.cacheStore.has(USER_KEY)).toBe(true);

    await worker.message({ type: "CLEAR_QUEUE" });

    expect(worker.queue.size).toBe(0);
    expect(worker.cacheStore.has(USER_KEY)).toBe(false);
    await worker.request("POST", "/api/asset", jsonHeaders, '{"a":2}');
    expect([...worker.queue.values()].map((e) => e.userId)).toEqual([null]);
  });

  it("answers 503 and stores nothing when the body carries a credential", async () => {
    const worker = startWorker();
    await worker.message({ type: "SET_USER", userId: "u1" });

    const answer = await worker.request(
      "PUT",
      "/api/user",
      jsonHeaders,
      '{"userid":"7","password":"hunter2"}',
    );

    expect(answer?.status).toBe(503);
    expect((await answer?.json()) as unknown).toMatchObject({
      code: "offline_not_queued",
    });
    expect(worker.queue.size).toBe(0);
  });

  it("answers 503 and stores nothing for JSON it cannot inspect", async () => {
    const worker = startWorker();

    const answer = await worker.request(
      "POST",
      "/api/asset",
      jsonHeaders,
      '{"broken":',
    );

    expect(answer?.status).toBe(503);
    expect(worker.queue.size).toBe(0);
  });

  it.each([
    ["HEAD", "/api/health"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/user/addUser"],
    ["PUT", "/api/admin/settings/ldap"],
  ])("does not intercept %s %s", async (method, path) => {
    const worker = startWorker();

    expect(await worker.request(method, path, jsonHeaders, "{}")).toBeNull();
    expect(worker.queue.size).toBe(0);
  });

  it("does not intercept a replayed request", async () => {
    const worker = startWorker();

    const answer = await worker.request(
      "POST",
      "/api/asset",
      { ...jsonHeaders, "x-offline-replay": "1" },
      '{"a":1}',
    );

    expect(answer).toBeNull();
  });
});
