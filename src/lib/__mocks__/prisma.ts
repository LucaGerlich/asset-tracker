import { vi } from "vitest";

/**
 * Vitest automock for the Prisma client (`@/lib/prisma`).
 *
 * A test file opts in with a bare `vi.mock("@/lib/prisma")` (no factory) and
 * Vitest loads this module automatically. Every model is generated on first
 * access via a Proxy, so the mock never goes stale when a route starts calling
 * a new model or a different method (e.g. `findFirst` for org scoping) — the
 * previous hand-written factories broke precisely because they enumerated a
 * fixed subset of methods.
 *
 * Defaults are intentionally "empty but valid" (findFirst → null, findMany → [],
 * count → 0) so an unmocked call returns a benign value instead of throwing.
 * A test overrides only what it cares about:
 *
 *   vi.mocked(prisma.asset.findFirst).mockResolvedValue(mockAsset);
 */

type ModelMock = ReturnType<typeof createModelMock>;

function createModelMock() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findFirstOrThrow: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
    findUniqueOrThrow: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({}),
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

const models = new Map<string, ModelMock>();

// Client-level ($-prefixed) methods. $transaction supports both the array form
// and the interactive-callback form (passing the proxy as the tx client).
const clientMethods: Record<string, unknown> = {
  $executeRaw: vi.fn().mockResolvedValue(0),
  $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  $queryRaw: vi.fn().mockResolvedValue([]),
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
};

// Any other $-prefixed access ($extends, $use, $on, …) resolves to a cached
// callable so client-level wrappers don't blow up at import time.
const dollarMethods = new Map<string, ReturnType<typeof vi.fn>>();

const prismaMock: Record<string | symbol, unknown> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") return undefined; // not a thenable
      if (prop in clientMethods) return clientMethods[prop];
      if (prop.startsWith("$")) {
        if (!dollarMethods.has(prop)) dollarMethods.set(prop, vi.fn());
        return dollarMethods.get(prop);
      }
      if (!models.has(prop)) models.set(prop, createModelMock());
      return models.get(prop);
    },
  },
);

// Interactive transactions run the callback with the same mocked client.
clientMethods.$transaction = vi.fn((arg: unknown) =>
  typeof arg === "function"
    ? (arg as (tx: unknown) => unknown)(prismaMock)
    : Promise.all(arg as unknown[]),
);

// $extends returns an extended client — return the same mock so chaining works.
(clientMethods.$extends as unknown) = vi.fn(() => prismaMock);

export default prismaMock;
