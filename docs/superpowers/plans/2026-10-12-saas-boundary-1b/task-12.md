### Task 12: Control-plane keys, billing contact and `org.created` events

`CONTROL_PLANE_SECRET` is the inbound bearer credential and nothing else: every other use (signing events, signing the billing handoff token in Task 15) works with a key derived from it for that purpose. The billing-contact lookup serves the `org.created` payload and the internal API (Task 14), which passes up to 100 organizations at once, so it is batched. The events module signs and delivers `org.created` after the creating transaction has committed (Task 13 calls `notifyOrgCreated`); delivery is best effort, recovered by the control plane's reconcile, and never reaches the user.

**Files:**

- Create: `src/lib/control-plane/keys.ts`
- Create: `src/lib/control-plane/billing-contact.ts`
- Create: `src/lib/control-plane/events.ts`
- Test: `src/lib/__tests__/control-plane-keys.test.ts` (create)
- Test: `src/lib/__tests__/billing-contact.test.ts` (create)
- Test: `src/lib/__tests__/control-plane-events.test.ts` (create)

**Interfaces:**

- Consumes: `isCloudMode` (`src/lib/deployment-mode.ts`, Task 2); `stubCloudMode` and `TEST_CONTROL_PLANE_SECRET` (`tests/setup/cloud-mode.ts`, Task 2); the `EnvRecord` type (`src/lib/host-routing.ts`); `logger`; `prisma`; `next/server`'s `after`.
- Produces in `src/lib/control-plane/keys.ts` (imports only `node:crypto` and a type; no prisma, no logger):
  - `type KeyPurpose = "events-v1" | "handoff-v1"`
  - `deriveKey(purpose: KeyPurpose, secret?: string): Uint8Array` (`hkdfSync("sha256", secret, "", "asset-tracker/" + purpose, 32)`; `secret` defaults to `process.env.CONTROL_PLANE_SECRET`, read on every call; throws when it is unset or empty)
  - `controlPlaneSecrets(env?: EnvRecord): string[]` (current, then previous, non-empty only)
- Produces in `src/lib/control-plane/billing-contact.ts`:
  - `interface BillingContact { userId: string; email: string; emailVerified: boolean }`
  - `getBillingContacts(orgIds: readonly string[]): Promise<Map<string, BillingContact>>` (one query: `isadmin`, `isActive`, non-null non-empty email, `accessExpiresAt` null or in the future; ordered `creation_date asc, userid asc`; the first row per organization wins; an empty list returns an empty map without a query)
- Produces in `src/lib/control-plane/events.ts`:
  - `interface OrgCreatedPayload { id: string; name: string; slug: string; createdAt: string; billingContact: BillingContact | null }`
  - `signEvent(rawBody: string, timestamp: string, key: Uint8Array): string` (`"sha256=" + hex HMAC-SHA256(key, timestamp + "." + rawBody)`)
  - `deliverEvent(url: string, rawBody: string, options?: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; logContext?: Readonly<Record<string, string>> }): Promise<boolean>` (3 attempts, 5 s timeout via `AbortSignal.timeout`, pause 500 ms then 1000 ms, `redirect: "manual"`, retries only network errors, timeouts, 408, 429 and 5xx; headers `content-type`, `x-event-id`, `x-timestamp` (both fixed across retries) and `x-signature`; logs each failed attempt with its number; never rejects). `logContext` is an additive refinement of the skeleton: the caller passes `{ orgId }` so every log line carries the organization id the spec asks for.
  - `notifyOrgCreated(org: { id: string; name: string; slug: string; createdAt: Date }): void` (returns immediately unless cloud mode and `CONTROL_PLANE_WEBHOOK_URL`; schedules the delivery with `after()`, falling back to a detached promise when `after` throws; reads the billing contact inside the scheduled task; never throws)

Two implementation details to keep. The attempt outcome in `events.ts` uses a string discriminant (`kind`), because the repository compiles without `strictNullChecks` and a boolean discriminant does not narrow there (`tsc` would reject `outcome.retry`). The `after()` mock in the tests spreads the real `next/server` export and replaces only `after`, so `NextRequest` and `NextResponse` keep working in route tests that reuse the pattern (Task 13).

- [ ] **Step 1: Write the failing tests for the keys and the billing contact**

The two key vectors below were computed with `hkdfSync("sha256", secret, "", info, 32)` for the 48-character secret in the test; they pin the salt and the `asset-tracker/<purpose>` info string, which the control plane's own tests must reproduce.

```ts
// src/lib/__tests__/control-plane-keys.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { controlPlaneSecrets, deriveKey } from "@/lib/control-plane/keys";

// 48 characters, fixed so the vectors below stay comparable with the control
// plane's own test suite.
const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

const EVENTS_KEY_HEX =
  "6978ee15720fa8268872794d31ab7943a577216fd1073fc06af7ebf6ab16a93c";
const HANDOFF_KEY_HEX =
  "49954b70ca3f5ffbf1006955ff1930eeb95882d407302281d0167b519b5dead7";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deriveKey", () => {
  it("derives the events key (HKDF-SHA256, empty salt, info asset-tracker/events-v1)", () => {
    expect(hex(deriveKey("events-v1", SECRET))).toBe(EVENTS_KEY_HEX);
  });

  it("derives the handoff key (info asset-tracker/handoff-v1)", () => {
    expect(hex(deriveKey("handoff-v1", SECRET))).toBe(HANDOFF_KEY_HEX);
  });

  it("returns 32 bytes as a Uint8Array", () => {
    const key = deriveKey("events-v1", SECRET);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key).toHaveLength(32);
  });

  it("is deterministic and differs per secret", () => {
    expect(hex(deriveKey("events-v1", SECRET))).toBe(
      hex(deriveKey("events-v1", SECRET)),
    );
    expect(hex(deriveKey("events-v1", `${SECRET}x`))).not.toBe(EVENTS_KEY_HEX);
  });

  it("uses CONTROL_PLANE_SECRET when no secret is passed", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", SECRET);

    expect(hex(deriveKey("events-v1"))).toBe(EVENTS_KEY_HEX);
  });

  it("reads the environment on every call", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", SECRET);
    const first = hex(deriveKey("handoff-v1"));
    vi.stubEnv("CONTROL_PLANE_SECRET", `${SECRET}rotated`);

    expect(hex(deriveKey("handoff-v1"))).not.toBe(first);
  });

  it("throws when the secret is unset", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");

    expect(() => deriveKey("events-v1")).toThrow(
      "CONTROL_PLANE_SECRET is not set",
    );
  });

  it("throws for an empty secret passed explicitly", () => {
    expect(() => deriveKey("handoff-v1", "")).toThrow(
      "CONTROL_PLANE_SECRET is not set",
    );
  });
});

describe("controlPlaneSecrets", () => {
  it("lists the current secret first, then the previous one", () => {
    expect(
      controlPlaneSecrets({
        CONTROL_PLANE_SECRET: "current",
        CONTROL_PLANE_SECRET_PREVIOUS: "previous",
      }),
    ).toEqual(["current", "previous"]);
  });

  it("omits an unset or empty previous secret", () => {
    expect(controlPlaneSecrets({ CONTROL_PLANE_SECRET: "current" })).toEqual([
      "current",
    ]);
    expect(
      controlPlaneSecrets({
        CONTROL_PLANE_SECRET: "current",
        CONTROL_PLANE_SECRET_PREVIOUS: "",
      }),
    ).toEqual(["current"]);
  });

  it("returns nothing when neither secret is set", () => {
    expect(controlPlaneSecrets({})).toEqual([]);
    expect(
      controlPlaneSecrets({
        CONTROL_PLANE_SECRET: "",
        CONTROL_PLANE_SECRET_PREVIOUS: "",
      }),
    ).toEqual([]);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "from-env");
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "");

    expect(controlPlaneSecrets()).toEqual(["from-env"]);
  });
});
```

```ts
// src/lib/__tests__/billing-contact.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { getBillingContacts } from "@/lib/control-plane/billing-contact";

const mockPrisma = vi.mocked(prisma, true);

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

function admin(
  organizationId: string | null,
  userid: string,
  email: string | null,
  emailVerified = false,
) {
  return { organizationId, userid, email, emailVerified };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findMany.mockResolvedValue([]);
});

describe("getBillingContacts", () => {
  it("asks for active admins with an email, oldest first, in one query", async () => {
    await getBillingContacts([ORG_A, ORG_B]);

    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: { in: [ORG_A, ORG_B] },
        isadmin: true,
        isActive: true,
        AND: [{ email: { not: null } }, { email: { not: "" } }],
        OR: [
          { accessExpiresAt: null },
          { accessExpiresAt: { gt: expect.any(Date) } },
        ],
      },
      orderBy: [{ creation_date: "asc" }, { userid: "asc" }],
      select: {
        organizationId: true,
        userid: true,
        email: true,
        emailVerified: true,
      },
    });
  });

  it("lets the first row of each organization win", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      admin(ORG_A, "u-oldest", "oldest@a.test", true),
      admin(ORG_B, "u-b", "b@b.test"),
      admin(ORG_A, "u-newer", "newer@a.test"),
    ] as never);

    const contacts = await getBillingContacts([ORG_A, ORG_B]);

    expect(contacts.get(ORG_A)).toEqual({
      userId: "u-oldest",
      email: "oldest@a.test",
      emailVerified: true,
    });
    expect(contacts.get(ORG_B)).toEqual({
      userId: "u-b",
      email: "b@b.test",
      emailVerified: false,
    });
  });

  it("leaves out an organization without a qualifying admin", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      admin(ORG_A, "u-a", "a@a.test"),
    ] as never);

    const contacts = await getBillingContacts([ORG_A, ORG_B]);

    expect(contacts.has(ORG_A)).toBe(true);
    expect(contacts.has(ORG_B)).toBe(false);
  });

  it("ignores rows without an organization or an email", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      admin(null, "u-orphan", "orphan@a.test"),
      admin(ORG_A, "u-no-mail", null),
      admin(ORG_A, "u-ok", "ok@a.test"),
    ] as never);

    const contacts = await getBillingContacts([ORG_A]);

    expect(contacts.get(ORG_A)?.userId).toBe("u-ok");
    expect(contacts.size).toBe(1);
  });

  it("does not query for an empty list", async () => {
    const contacts = await getBillingContacts([]);

    expect(contacts.size).toBe(0);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("passes the expiry cut-off as the current time", async () => {
    const before = Date.now();

    await getBillingContacts([ORG_A]);

    const where = mockPrisma.user.findMany.mock.calls[0][0]?.where as {
      OR: [unknown, { accessExpiresAt: { gt: Date } }];
    };
    const cutoff = where.OR[1].accessExpiresAt.gt.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(Date.now());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/control-plane/keys"` and `"@/lib/control-plane/billing-contact"`).

- [ ] **Step 3: Write the key and billing-contact modules**

```ts
// src/lib/control-plane/keys.ts
import { hkdfSync } from "node:crypto";
import type { EnvRecord } from "@/lib/host-routing";

/**
 * Purpose keys derived from CONTROL_PLANE_SECRET (SaaS boundary spec, 4.1).
 *
 * The secret itself is only ever the bearer credential of inbound calls. Every
 * other use (signing events, signing the billing handoff token) works with a
 * key derived for that purpose, so a leaked signature key never reveals the
 * bearer credential and keys of different purposes never match.
 */
export type KeyPurpose = "events-v1" | "handoff-v1";

const KEY_BYTES = 32;
const INFO_PREFIX = "asset-tracker/";

/**
 * HKDF-SHA256 with an empty salt and the info string `asset-tracker/<purpose>`.
 * Throws when no secret is available, so a caller can never sign with a key
 * derived from an empty string.
 */
export function deriveKey(
  purpose: KeyPurpose,
  secret: string | undefined = process.env.CONTROL_PLANE_SECRET,
): Uint8Array {
  if (!secret) {
    throw new Error("CONTROL_PLANE_SECRET is not set");
  }
  return new Uint8Array(
    hkdfSync("sha256", secret, "", `${INFO_PREFIX}${purpose}`, KEY_BYTES),
  );
}

/**
 * The secrets the core accepts as a bearer, current first. Only non-empty
 * values are returned, so an unset previous secret can never match anything.
 */
export function controlPlaneSecrets(env: EnvRecord = process.env): string[] {
  return [env.CONTROL_PLANE_SECRET, env.CONTROL_PLANE_SECRET_PREVIOUS].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}
```

```ts
// src/lib/control-plane/billing-contact.ts
import prisma from "@/lib/prisma";

/**
 * The person the control plane writes to about an organization's billing: its
 * oldest active admin that has an email address.
 */
export interface BillingContact {
  userId: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Billing contacts for several organizations with one query (the internal list
 * endpoint passes up to 100 ids, so a lookup per organization would be N+1).
 *
 * Rules, in the query so the database does the filtering:
 * - an admin (`isadmin`) that is active (`isActive`) with a non-empty email;
 * - whose time-limited access (`accessExpiresAt`) has not run out. The expiry
 *   cron runs once a day, so an expired admin can still be flagged active;
 * - the oldest first by `creation_date`, ties broken by `userid`, so the result
 *   is deterministic. The first row per organization wins.
 *
 * Organizations without such an admin are absent from the map. `emailVerified`
 * is reported as stored: native sign-ups never set it, so a consumer must not
 * require it.
 */
export async function getBillingContacts(
  orgIds: readonly string[],
): Promise<Map<string, BillingContact>> {
  const contacts = new Map<string, BillingContact>();
  if (orgIds.length === 0) return contacts;

  const admins = await prisma.user.findMany({
    where: {
      organizationId: { in: [...orgIds] },
      isadmin: true,
      isActive: true,
      AND: [{ email: { not: null } }, { email: { not: "" } }],
      OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }],
    },
    orderBy: [{ creation_date: "asc" }, { userid: "asc" }],
    select: {
      organizationId: true,
      userid: true,
      email: true,
      emailVerified: true,
    },
  });

  for (const admin of admins) {
    if (!admin.organizationId || !admin.email) continue;
    if (contacts.has(admin.organizationId)) continue;
    contacts.set(admin.organizationId, {
      userId: admin.userid,
      email: admin.email,
      emailVerified: admin.emailVerified,
    });
  }
  return contacts;
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts`
Expected: PASS (18 tests).

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/control-plane/keys.ts src/lib/control-plane/billing-contact.ts src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/control-plane/keys.ts src/lib/control-plane/billing-contact.ts src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts
git commit -m "feat: add control-plane key derivation and the billing contact lookup"
```

- [ ] **Step 6: Write the failing tests for the events**

The signature vector uses the key bytes `0..31`, the timestamp `1760256000` and the body `{"id":"o1"}`. The header test recomputes the key with `hkdfSync` directly instead of calling `deriveKey`, so a wrong purpose string in `keys.ts` cannot hide behind a matching mistake in `events.ts`.

```ts
// src/lib/__tests__/control-plane-events.test.ts
import { createHmac, hkdfSync } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/logger");
vi.mock("@/lib/prisma");

// `after()` only works inside a request scope. The mock records what was
// scheduled so a test can run it, or makes `after` throw like it does in a
// script.
const afterMock = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
  failWith: null as Error | null,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    if (afterMock.failWith) throw afterMock.failWith;
    afterMock.scheduled.push(task);
  },
}));

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  deliverEvent,
  notifyOrgCreated,
  signEvent,
  type OrgCreatedPayload,
} from "@/lib/control-plane/events";

const mockPrisma = vi.mocked(prisma, true);
const mockLogger = vi.mocked(logger, true);

const URL_OK = "https://control.example.com/hooks/org-created";
const BODY = '{"id":"o1"}';

const ORG = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme",
  slug: "acme",
  createdAt: new Date("2026-10-12T08:00:00.000Z"),
};

function eventsKey(): Uint8Array {
  return new Uint8Array(
    hkdfSync(
      "sha256",
      TEST_CONTROL_PLANE_SECRET,
      "",
      "asset-tracker/events-v1",
      32,
    ),
  );
}

function response(status: number): Response {
  return new Response(null, { status });
}

function fakeFetch(...results: Array<Response | Error>) {
  const queue = [...results];
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("fetch called more often than expected");
    if (next instanceof Error) throw next;
    return next;
  });
}

function sentHeaders(
  fetchImpl: ReturnType<typeof fakeFetch>,
  call = 0,
): Record<string, string> {
  return fetchImpl.mock.calls[call][1]?.headers as Record<string, string>;
}

async function runScheduled(): Promise<void> {
  const tasks = afterMock.scheduled.splice(0);
  await Promise.all(tasks.map((task) => task()));
}

beforeEach(() => {
  vi.clearAllMocks();
  afterMock.scheduled.length = 0;
  afterMock.failWith = null;
  mockPrisma.user.findMany.mockResolvedValue([]);
  stubCloudMode();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("signEvent", () => {
  it("matches the fixed test vector", () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index);

    expect(signEvent(BODY, "1760256000", key)).toBe(
      "sha256=dd0c9fd70a374b2337078ed0e6928e2e0f9449546b58eddfb1586053e9444693",
    );
  });

  it("signs the timestamp, a dot and the raw body", () => {
    const key = eventsKey();
    const expected = createHmac("sha256", key)
      .update(`1700000000.${BODY}`)
      .digest("hex");

    expect(signEvent(BODY, "1700000000", key)).toBe(`sha256=${expected}`);
  });

  it("changes with the body, the timestamp and the key", () => {
    const key = eventsKey();
    const base = signEvent(BODY, "1700000000", key);

    expect(signEvent('{"id":"o2"}', "1700000000", key)).not.toBe(base);
    expect(signEvent(BODY, "1700000001", key)).not.toBe(base);
    expect(signEvent(BODY, "1700000000", new Uint8Array(32))).not.toBe(base);
  });
});

describe("deliverEvent", () => {
  it("posts the raw body once with the signed headers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T08:00:00.000Z"));
    const fetchImpl = fakeFetch(response(200));
    const sleep = vi.fn(async () => undefined);

    const delivered = await deliverEvent(URL_OK, BODY, { fetchImpl, sleep });

    expect(delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(URL_OK);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(BODY);
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const headers = sentHeaders(fetchImpl);
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-timestamp"]).toBe(timestamp);
    expect(headers["x-event-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const expected = createHmac("sha256", eventsKey())
      .update(`${timestamp}.${BODY}`)
      .digest("hex");
    expect(headers["x-signature"]).toBe(`sha256=${expected}`);
  });

  it("gives every attempt a 5 second timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await deliverEvent(URL_OK, BODY, {
      fetchImpl: fakeFetch(response(200)),
      sleep: async () => undefined,
    });

    expect(timeout).toHaveBeenCalledWith(5_000);
  });

  it("retries 5xx, 429 and 408 with a pause of 500 ms then 1000 ms", async () => {
    const fetchImpl = fakeFetch(response(503), response(429), response(200));
    const sleep = vi.fn(async () => undefined);

    const delivered = await deliverEvent(URL_OK, BODY, { fetchImpl, sleep });

    expect(delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("retries a request timeout (408)", async () => {
    const fetchImpl = fakeFetch(response(408), response(204));

    const delivered = await deliverEvent(URL_OK, BODY, {
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries network errors and timeouts", async () => {
    const timeoutError = new DOMException("timed out", "TimeoutError");
    const fetchImpl = fakeFetch(
      new TypeError("fetch failed"),
      timeoutError,
      response(200),
    );

    const delivered = await deliverEvent(URL_OK, BODY, {
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("gives up after three attempts and does not sleep after the last", async () => {
    const fetchImpl = fakeFetch(response(500), response(500), response(500));
    const sleep = vi.fn(async () => undefined);

    const delivered = await deliverEvent(URL_OK, BODY, { fetchImpl, sleep });

    expect(delivered).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 410, 422])(
    "does not retry a %s",
    async (status) => {
      const fetchImpl = fakeFetch(response(status));
      const sleep = vi.fn(async () => undefined);

      const delivered = await deliverEvent(URL_OK, BODY, { fetchImpl, sleep });

      expect(delivered).toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it("treats a redirect as a failure and does not follow or retry it", async () => {
    const fetchImpl = fakeFetch(
      new Response(null, {
        status: 302,
        headers: { location: "https://elsewhere.example.com/" },
      }),
    );

    const delivered = await deliverEvent(URL_OK, BODY, {
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(delivered).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the event id, the timestamp and the signature across retries", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T08:00:00.000Z"));
    const fetchImpl = fakeFetch(response(500), response(500), response(200));
    // Each pause moves the clock on, so a timestamp computed per attempt
    // would differ between the calls.
    const sleep = vi.fn(async (ms: number) => {
      vi.setSystemTime(Date.now() + ms + 5_000);
    });

    await deliverEvent(URL_OK, BODY, { fetchImpl, sleep });

    const [first, second, third] = [0, 1, 2].map((call) =>
      sentHeaders(fetchImpl, call),
    );
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(fetchImpl.mock.calls.map((call) => call[1]?.body)).toEqual([
      BODY,
      BODY,
      BODY,
    ]);
  });

  it("logs every failed attempt with its number and the log context", async () => {
    const fetchImpl = fakeFetch(
      response(502),
      new TypeError("fetch failed"),
      response(500),
    );

    await deliverEvent(URL_OK, BODY, {
      fetchImpl,
      sleep: async () => undefined,
      logContext: { orgId: ORG.id },
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        orgId: ORG.id,
        attempt: 1,
        status: 502,
        target: "https://control.example.com",
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orgId: ORG.id, attempt: 2, status: null }),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orgId: ORG.id, attempt: 3, status: 500 }),
    );
  });

  it("never logs the path of the receiver URL", async () => {
    await deliverEvent("https://control.example.com/hooks/secret-path", BODY, {
      fetchImpl: fakeFetch(response(400)),
      sleep: async () => undefined,
    });

    const logged = JSON.stringify([
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ]);
    expect(logged).not.toContain("secret-path");
  });

  it("fails without any attempt for an invalid URL", async () => {
    const fetchImpl = fakeFetch(response(200));

    const delivered = await deliverEvent("not a url", BODY, { fetchImpl });

    expect(delivered).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails without any attempt when the secret is unset", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
    const fetchImpl = fakeFetch(response(200));

    const delivered = await deliverEvent(URL_OK, BODY, { fetchImpl });

    expect(delivered).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the global fetch by default", async () => {
    const globalFetch = fakeFetch(response(200));
    vi.stubGlobal("fetch", globalFetch);

    const delivered = await deliverEvent(URL_OK, BODY);

    expect(delivered).toBe(true);
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });
});

describe("notifyOrgCreated", () => {
  beforeEach(() => {
    vi.stubEnv("CONTROL_PLANE_WEBHOOK_URL", URL_OK);
  });

  it("schedules the delivery with after() and sends nothing before it runs", () => {
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);

    expect(afterMock.scheduled).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("sends the signed org.created payload with the billing contact", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        organizationId: ORG.id,
        userid: "user-1",
        email: "admin@acme.test",
        emailVerified: false,
      },
    ] as never);
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);
    await runScheduled();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(URL_OK);
    const body = fetchImpl.mock.calls[0][1]?.body as string;
    const payload: OrgCreatedPayload = JSON.parse(body);
    expect(payload).toEqual({
      id: ORG.id,
      name: "Acme",
      slug: "acme",
      createdAt: "2026-10-12T08:00:00.000Z",
      billingContact: {
        userId: "user-1",
        email: "admin@acme.test",
        emailVerified: false,
      },
    });
    const headers = sentHeaders(fetchImpl);
    expect(headers["x-signature"]).toBe(
      signEvent(body, headers["x-timestamp"], eventsKey()),
    );
  });

  it("looks the billing contact up inside the scheduled task, for this org only", async () => {
    vi.stubGlobal("fetch", fakeFetch(response(200)));

    notifyOrgCreated(ORG);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    await runScheduled();

    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany.mock.calls[0][0]?.where).toMatchObject({
      organizationId: { in: [ORG.id] },
    });
  });

  it("sends billingContact null for an organization without an admin", async () => {
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);
    await runScheduled();

    const payload = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(payload.billingContact).toBeNull();
  });

  it("still delivers when the billing contact lookup fails", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("db down"));
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);
    await runScheduled();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetchImpl.mock.calls[0][1]?.body as string).billingContact,
    ).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("does nothing without CONTROL_PLANE_WEBHOOK_URL", async () => {
    vi.stubEnv("CONTROL_PLANE_WEBHOOK_URL", "");
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);
    await runScheduled();

    expect(afterMock.scheduled).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("does nothing outside cloud mode, even with a URL", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    notifyOrgCreated(ORG);
    await runScheduled();

    expect(afterMock.scheduled).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("runs the delivery detached when after() is unavailable", async () => {
    afterMock.failWith = new Error(
      "`after` was called outside a request scope",
    );
    const fetchImpl = fakeFetch(response(200));
    vi.stubGlobal("fetch", fetchImpl);

    expect(() => notifyOrgCreated(ORG)).not.toThrow();

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  });

  it("does not throw and logs when the receiver answers with an error", async () => {
    vi.stubGlobal("fetch", fakeFetch(response(400)));

    expect(() => notifyOrgCreated(ORG)).not.toThrow();
    await runScheduled();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("not delivered"),
      expect.objectContaining({ orgId: ORG.id }),
    );
  });

  it("does not throw while the receiver is down", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchImpl);

    expect(() => notifyOrgCreated(ORG)).not.toThrow();
    const settled = runScheduled();
    await vi.advanceTimersByTimeAsync(2_000);
    await settled;

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("not delivered"),
      expect.objectContaining({ orgId: ORG.id }),
    );
  });

  it("does not throw for a malformed organization", async () => {
    const broken = { id: ORG.id, name: "x", slug: "x" } as never;
    vi.stubGlobal("fetch", fakeFetch(response(200)));

    expect(() => notifyOrgCreated(broken)).not.toThrow();
    await runScheduled();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      expect.objectContaining({ orgId: ORG.id }),
    );
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/control-plane-events.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/control-plane/events"`).

- [ ] **Step 8: Write the events module**

```ts
// src/lib/control-plane/events.ts
import { createHmac, randomUUID } from "node:crypto";
import { after } from "next/server";
import { isCloudMode } from "@/lib/deployment-mode";
import { logger } from "@/lib/logger";
import { getBillingContacts, type BillingContact } from "./billing-contact";
import { deriveKey } from "./keys";

/**
 * Events from the core to the control plane (SaaS boundary spec, 4.4). The only
 * event is `org.created`. Delivery is best effort: the control plane's nightly
 * reconcile (`GET /api/internal/orgs?createdAfter=`) recovers anything missed,
 * so a failure is logged and never reaches the user.
 */

export interface OrgCreatedPayload {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  billingContact: BillingContact | null;
}

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 5_000;
/** Pause before attempt 2 and before attempt 3. */
const BACKOFF_MS: readonly number[] = [500, 1_000];

/** `sha256=` + hex HMAC-SHA256 over `<timestamp>.<rawBody>`. */
export function signEvent(
  rawBody: string,
  timestamp: string,
  key: Uint8Array,
): string {
  const digest = createHmac("sha256", key)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `sha256=${digest}`;
}

export interface DeliverEventOptions {
  /** Test seam: defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Test seam: defaults to a timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Added to every log line, for example `{ orgId }`. */
  logContext?: Readonly<Record<string, string>>;
}

// A string discriminant: the repository compiles without strictNullChecks,
// where a boolean discriminant does not narrow.
type AttemptOutcome =
  | { kind: "delivered" }
  | { kind: "failed"; retry: boolean; status: number | null; error?: unknown };

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Network errors and timeouts are retried, and so are 408, 429 and 5xx. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The body is not needed; a failed cancel changes nothing.
  }
}

async function attemptOnce(
  fetchImpl: typeof fetch,
  url: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<AttemptOutcome> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: rawBody,
      // A redirect is never followed: the receiver is configured, not
      // discovered, and a 3xx would resend the signed body elsewhere.
      redirect: "manual",
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    await discardBody(response);
    if (response.ok) return { kind: "delivered" };
    return {
      kind: "failed",
      retry: isRetryableStatus(response.status),
      status: response.status,
    };
  } catch (error) {
    return { kind: "failed", retry: true, status: null, error };
  }
}

/**
 * POSTs one signed event. Up to 3 attempts with a 5 s timeout each and a pause
 * of 500 ms then 1000 ms between them. `rawBody` is sent byte for byte, and the
 * event id and the timestamp are fixed across attempts, so the receiver can
 * deduplicate a retry. Resolves `true` when a 2xx arrived, `false` otherwise;
 * it never rejects.
 */
export async function deliverEvent(
  url: string,
  rawBody: string,
  options: DeliverEventOptions = {},
): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const context = options.logContext ?? {};

  let target: string;
  let headers: Record<string, string>;
  try {
    // Logged instead of the full URL: the path of an operator-set URL may
    // carry a secret.
    target = new URL(url).origin;
    const timestamp = String(Math.floor(Date.now() / 1000));
    headers = {
      "content-type": "application/json",
      "x-event-id": randomUUID(),
      "x-timestamp": timestamp,
      "x-signature": signEvent(rawBody, timestamp, deriveKey("events-v1")),
    };
  } catch (error) {
    logger.error("Control plane event could not be prepared", {
      ...context,
      error,
    });
    return false;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptOnce(fetchImpl, url, rawBody, headers);
    if (outcome.kind === "delivered") return true;

    const willRetry = outcome.retry && attempt < MAX_ATTEMPTS;
    const details = {
      ...context,
      eventId: headers["x-event-id"],
      attempt,
      target,
      status: outcome.status,
      error: outcome.error,
    };
    if (willRetry) {
      logger.warn("Control plane event delivery failed, retrying", details);
    } else {
      logger.error("Control plane event delivery failed", details);
      return false;
    }
    await sleep(BACKOFF_MS[attempt - 1]);
  }
  return false;
}

interface OrgCreatedSource {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

async function lookupBillingContact(
  orgId: string,
): Promise<BillingContact | null> {
  try {
    return (await getBillingContacts([orgId])).get(orgId) ?? null;
  } catch (error) {
    logger.warn(
      "Billing contact lookup failed; sending org.created without it",
      {
        orgId,
        error,
      },
    );
    return null;
  }
}

/** Runs inside `after()` (or detached); never rejects. */
async function sendOrgCreated(
  org: OrgCreatedSource,
  url: string,
): Promise<void> {
  try {
    // Read here, after the creating transaction has committed: the admin does
    // not exist yet when the organization row is written.
    const payload: OrgCreatedPayload = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
      billingContact: await lookupBillingContact(org.id),
    };
    const delivered = await deliverEvent(url, JSON.stringify(payload), {
      logContext: { orgId: org.id, event: "org.created" },
    });
    if (!delivered) {
      logger.error("org.created was not delivered; reconcile will pick it up", {
        orgId: org.id,
      });
    }
  } catch (error) {
    logger.error("org.created event failed", { orgId: org.id, error });
  }
}

/**
 * Announces a new organization to the control plane. Call it after the
 * transaction that created the organization has resolved. Does nothing outside
 * cloud mode or without CONTROL_PLANE_WEBHOOK_URL. Delivery runs in `after()`
 * so the response is not held up; outside a request scope (scripts, tests)
 * `after` throws and the delivery runs detached instead. Never throws.
 */
export function notifyOrgCreated(org: OrgCreatedSource): void {
  try {
    if (!isCloudMode()) return;
    const url = process.env.CONTROL_PLANE_WEBHOOK_URL;
    if (!url) return;

    const task = (): Promise<void> => sendOrgCreated(org, url);
    try {
      after(task);
    } catch {
      void task();
    }
  } catch (error) {
    logger.error("Could not schedule the org.created event", { error });
  }
}
```

- [ ] **Step 9: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts src/lib/__tests__/control-plane-events.test.ts`
Expected: PASS (51 tests).

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/control-plane src/lib/__tests__/control-plane-keys.test.ts src/lib/__tests__/billing-contact.test.ts src/lib/__tests__/control-plane-events.test.ts`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add src/lib/control-plane/events.ts src/lib/__tests__/control-plane-events.test.ts
git commit -m "feat: deliver signed org.created events to the control plane"
```
