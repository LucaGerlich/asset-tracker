### Task 14: Internal API

The control plane's only way into the core: bearer-authenticated routes under `/api/internal/orgs` that list and read organizations, replace entitlements and apply status transitions. Part A adds the building blocks (guard, transitions, batched organization mapper); part B adds the four routes, the audit entity and the static guard test. Each part is one commit.

**Files:**

- Create: `src/lib/control-plane/responses.ts` (error bodies and the JSON body reader, shared by the four routes)
- Create: `src/lib/control-plane/auth.ts`
- Create: `src/lib/control-plane/status-actions.ts`
- Create: `src/lib/control-plane/internal-org.ts`
- Create: `src/app/api/internal/orgs/route.ts`
- Create: `src/app/api/internal/orgs/[id]/route.ts`
- Create: `src/app/api/internal/orgs/[id]/entitlements/route.ts`
- Create: `src/app/api/internal/orgs/[id]/status/route.ts`
- Modify: `src/lib/audit-log.ts` (`AUDIT_ENTITIES.ORGANIZATION`)
- Modify: `src/app/api/__tests__/route-conventions.test.ts` (`WRITE_GUARD_EXEMPT`: the two mutating internal routes)
- Test: `src/lib/__tests__/control-plane-auth.test.ts` (create)
- Test: `src/lib/__tests__/status-actions.test.ts` (create)
- Test: `src/lib/__tests__/internal-org.test.ts` (create)
- Test: `src/app/api/__tests__/internal-orgs.test.ts` (create)
- Test: `src/app/api/__tests__/internal-routes-guard.test.ts` (create)

**Interfaces:**

- Consumes:
  - `isCloudMode` (`src/lib/deployment-mode.ts`) and `stubCloudMode`, `TEST_CONTROL_PLANE_SECRET`, `TEST_NEW_ORG_ENTITLEMENTS` (`tests/setup/cloud-mode.ts`), Task 2.
  - `parseStoredEntitlements`, `resolveEntitlements` (`src/lib/entitlements.ts`) and `getOrgStatus` with the `lockedAt` rule (`src/lib/org-suspension.ts`), Task 6.
  - `controlPlaneSecrets` (`src/lib/control-plane/keys.ts`), `getBillingContacts` and `BillingContact` (`src/lib/control-plane/billing-contact.ts`), Task 12.
  - `entitlementsSchema`, `featuresInOrder`, `isOverLimit`, `Entitlements`, `OrgUsage` (`src/lib/entitlements-shared.ts`) and the `entitlements` and `lockedAt` columns, phase 1a.
  - Existing code: `cursorPaginate` (`src/lib/cursor-pagination.ts`, used by `api/asset/route.ts`), `isGuid` (`src/lib/validation.ts`), `createAuditLog` (`src/lib/audit-log.ts`).
- Produces in `src/lib/control-plane/auth.ts`:
  - `requireControlPlane(req: Request): NextResponse | null`: outside cloud mode 404 `{ error: "Not found", code: "not_found" }` before the request is looked at; bearer missing or not equal, in constant time, to the current or the previous secret 401 `{ error: "Unauthorized", code: "unauthorized" }`; otherwise `null`. It never consults `CRON_SECRET` or cookies.
  - `bearerMatches(header: string | null, secret: string | undefined): boolean` (false for an unset or empty secret).
- Produces in `src/lib/control-plane/status-actions.ts`:
  - `type StatusAction = "suspend" | "lock" | "reactivate"`, `STATUS_ACTIONS`, `statusActionSchema` (zod strict `{ action }`).
  - `statusActionPatch(org: { suspendedAt: Date | null; lockedAt: Date | null }, action: StatusAction, now: Date): StatusPatch` where `StatusPatch = { suspendedAt?: Date | null; lockedAt?: Date | null }` holds only the columns that change (spec section 3: `suspend` only when neither suspended nor locked, `lock` keeps the first lock time, `reactivate` clears both).
- Produces in `src/lib/control-plane/internal-org.ts`:
  - `internalOrgSelect`, `type InternalOrgRow`, `type InternalOrg` (spec section 4.2 exactly, `legacy` included, always set in this release).
  - `toInternalOrgs(rows: readonly InternalOrgRow[]): Promise<InternalOrg[]>`: two `groupBy` usage queries (all assets, active users only) and one `getBillingContacts` call per call, whatever the number of rows; no per-organization query. `entitlements` is the stored value or `null`; `overLimit` is measured against the effective entitlements (`resolveEntitlements`) with the strict `isOverLimit`.
  - `statusSnapshot(row): { status; suspendedAt; lockedAt }` (also the before and after of status audit entries).
- Produces in `src/lib/control-plane/responses.ts`: `controlPlaneError(status, error, code, extras?)`, `invalidOrgId()`, `orgNotFound()`, `validationFailed(zodError)`, `internalFailure()`, `readJsonBody(req)`. Every error body is `{ error, code, ...extras }`; codes: `not_found`, `unauthorized`, `invalid_id`, `org_not_found`, `validation_failed` (with `issues`), `invalid_json`, `internal_error`.
- Routes (every handler starts with `const denied = requireControlPlane(req); if (denied) return denied;`):
  - `GET /api/internal/orgs?createdAfter=&cursor=&limit=` answers `{ orgs: InternalOrg[], nextCursor: string | null }`. `limit` is 1..100 (default 100), `createdAfter` an ISO date or datetime (inclusive), `cursor` the id of the last organization of the previous page (a guid, Prisma cursor with `skip: 1`), ordered `createdAt asc, id asc`. Unknown query parameters are a 400.
  - `GET /api/internal/orgs/:id` answers `{ org }`.
  - `PUT /api/internal/orgs/:id/entitlements` takes a strict `entitlementsSchema` body, stores it with deduplicated features in `GATED_FEATURES` order, answers `{ org }`.
  - `POST /api/internal/orgs/:id/status` takes `{ action }`, answers `{ org }` with the resulting status.
  - `:id` must pass `isGuid` (400), an unknown organization is a 404. Both writes log `createAuditLog({ userId: null, action: "UPDATE", entity: "Organization", entityId, details: { actor: "control-plane", before, after } })`; the status route adds `action` to `details`. A write that changes nothing is still audited, and a status transition with an empty patch skips the database write.

Two typing notes that explain code you will see below. The repo's `tsconfig` is not strict, so narrowing on a bare boolean discriminant does not work: callers test `body.ok === false` (zod's `safeParse` result narrows fine). And Prisma's `groupBy` generics hit TS2615 when passed through `vi.mocked`, so the tests type those two mocks loosely.

## Part A: guard, transitions and the organization mapper

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/control-plane-auth.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";
import { bearerMatches, requireControlPlane } from "@/lib/control-plane/auth";

const PREVIOUS_SECRET = "previous-control-plane-secret-abcdefghijklmnop";
const CRON_SECRET = "cron-secret-that-is-long-enough-0123456789";

function request(authorization?: string, cookie?: string): Request {
  return new Request("http://localhost:3000/api/internal/orgs", {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bearerMatches", () => {
  const secret = "s3cret-value-for-the-bearer-comparison";

  it("accepts exactly `Bearer <secret>`", () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([
    ["a missing header", null],
    ["an empty header", ""],
    ["the bare secret", secret],
    ["another scheme", `Basic ${secret}`],
    ["a lowercase scheme", `bearer ${secret}`],
    ["a trailing space", `Bearer ${secret} `],
    ["a longer token", `Bearer ${secret}x`],
    ["a shorter token", "Bearer s3cret"],
    [
      "a different token of the same length",
      `Bearer ${"x".repeat(secret.length)}`,
    ],
  ])("rejects %s", (_name, header) => {
    expect(bearerMatches(header, secret)).toBe(false);
  });

  it("never matches an unset or empty secret", () => {
    expect(bearerMatches("Bearer undefined", undefined)).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
    expect(bearerMatches("Bearer ", undefined)).toBe(false);
  });

  it("does not fall back to CRON_SECRET for an unset secret", () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    expect(bearerMatches(`Bearer ${CRON_SECRET}`, undefined)).toBe(false);
  });
});

describe("requireControlPlane", () => {
  it("answers 404 outside cloud mode, whatever the request carries", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");

    const denied = requireControlPlane(
      request(`Bearer ${TEST_CONTROL_PLANE_SECRET}`),
    );

    expect(denied?.status).toBe(404);
    expect(await denied?.json()).toEqual({
      error: "Not found",
      code: "not_found",
    });
  });

  it("answers 401 without an Authorization header", async () => {
    stubCloudMode();

    const denied = requireControlPlane(request());

    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({
      error: "Unauthorized",
      code: "unauthorized",
    });
  });

  it("answers 401 for a wrong bearer token", () => {
    stubCloudMode();
    expect(requireControlPlane(request("Bearer wrong"))?.status).toBe(401);
  });

  it("lets the current secret through", () => {
    stubCloudMode();
    expect(
      requireControlPlane(request(`Bearer ${TEST_CONTROL_PLANE_SECRET}`)),
    ).toBeNull();
  });

  it("accepts the previous secret while it is set", () => {
    stubCloudMode();
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", PREVIOUS_SECRET);

    expect(
      requireControlPlane(request(`Bearer ${PREVIOUS_SECRET}`)),
    ).toBeNull();
    expect(
      requireControlPlane(request(`Bearer ${TEST_CONTROL_PLANE_SECRET}`)),
    ).toBeNull();
  });

  it("rejects the previous secret once it is unset", () => {
    stubCloudMode();
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "");

    expect(
      requireControlPlane(request(`Bearer ${PREVIOUS_SECRET}`))?.status,
    ).toBe(401);
  });

  it("does not let an empty bearer token match an unset previous secret", () => {
    stubCloudMode();
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "");

    expect(requireControlPlane(request("Bearer "))?.status).toBe(401);
    expect(requireControlPlane(request("Bearer undefined"))?.status).toBe(401);
  });

  it("never accepts CRON_SECRET, even when the previous secret is unset", () => {
    stubCloudMode();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "");

    expect(requireControlPlane(request(`Bearer ${CRON_SECRET}`))?.status).toBe(
      401,
    );
  });

  it("never accepts a session cookie", () => {
    stubCloudMode();

    expect(
      requireControlPlane(
        request(undefined, "better-auth.session_token=abc.def"),
      )?.status,
    ).toBe(401);
  });
});
```

```ts
// src/lib/__tests__/status-actions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");

import {
  statusActionPatch,
  statusActionSchema,
  type StatusAction,
  type StatusFields,
} from "@/lib/control-plane/status-actions";
import { getOrgStatus } from "@/lib/org-suspension";

const NOW = new Date("2026-10-12T10:00:00.000Z");
const EARLIER = new Date("2026-10-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const active: StatusFields = { suspendedAt: null, lockedAt: null };
const suspended: StatusFields = { suspendedAt: EARLIER, lockedAt: null };
const locked: StatusFields = { suspendedAt: null, lockedAt: EARLIER };
const lockedAndSuspended: StatusFields = {
  suspendedAt: EARLIER,
  lockedAt: EARLIER,
};

describe("statusActionPatch: suspend", () => {
  it("starts the grace period for an active organization", () => {
    expect(statusActionPatch(active, "suspend", NOW)).toEqual({
      suspendedAt: NOW,
    });
  });

  it("is a no-op for a suspended organization, so the grace period is not restarted", () => {
    expect(statusActionPatch(suspended, "suspend", NOW)).toEqual({});
  });

  it("is a no-op for a locked organization", () => {
    expect(statusActionPatch(locked, "suspend", NOW)).toEqual({});
    expect(statusActionPatch(lockedAndSuspended, "suspend", NOW)).toEqual({});
  });
});

describe("statusActionPatch: lock", () => {
  it("sets lockedAt for an active organization", () => {
    expect(statusActionPatch(active, "lock", NOW)).toEqual({ lockedAt: NOW });
  });

  it("keeps a running suspension and only adds the lock", () => {
    expect(statusActionPatch(suspended, "lock", NOW)).toEqual({
      lockedAt: NOW,
    });
  });

  it("keeps the first lock time when it is already locked", () => {
    expect(statusActionPatch(locked, "lock", NOW)).toEqual({});
    expect(statusActionPatch(lockedAndSuspended, "lock", NOW)).toEqual({});
  });
});

describe("statusActionPatch: reactivate", () => {
  it("clears the lock", () => {
    expect(statusActionPatch(locked, "reactivate", NOW)).toEqual({
      lockedAt: null,
    });
  });

  it("clears the suspension", () => {
    expect(statusActionPatch(suspended, "reactivate", NOW)).toEqual({
      suspendedAt: null,
    });
  });

  it("clears both", () => {
    expect(statusActionPatch(lockedAndSuspended, "reactivate", NOW)).toEqual({
      lockedAt: null,
      suspendedAt: null,
    });
  });

  it("is a no-op for an active organization", () => {
    expect(statusActionPatch(active, "reactivate", NOW)).toEqual({});
  });
});

describe("statusActionPatch", () => {
  it.each<StatusAction>(["suspend", "lock", "reactivate"])(
    "is idempotent for %s: applying the patch again changes nothing",
    (action) => {
      for (const start of [active, suspended, locked, lockedAndSuspended]) {
        const once = { ...start, ...statusActionPatch(start, action, NOW) };
        expect(statusActionPatch(once, action, NOW)).toEqual({});
      }
    },
  );

  it("does not mutate its input", () => {
    const input: StatusFields = { suspendedAt: null, lockedAt: null };
    statusActionPatch(input, "lock", NOW);
    expect(input).toEqual({ suspendedAt: null, lockedAt: null });
  });
});

describe("the resulting status", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function statusAfter(start: StatusFields, action: StatusAction) {
    const next = { ...start, ...statusActionPatch(start, action, NOW) };
    return getOrgStatus({ isActive: true, ...next });
  }

  it("suspend makes an active organization read-only", () => {
    expect(statusAfter(active, "suspend")).toBe("read_only");
  });

  it("lock locks out an active and a suspended organization", () => {
    expect(statusAfter(active, "lock")).toBe("locked_out");
    expect(statusAfter(suspended, "lock")).toBe("locked_out");
  });

  it("reactivate returns a locked, suspended or locked-out organization to active", () => {
    expect(statusAfter(locked, "reactivate")).toBe("active");
    expect(statusAfter(suspended, "reactivate")).toBe("active");
    expect(statusAfter(lockedAndSuspended, "reactivate")).toBe("active");
    expect(
      statusAfter(
        { suspendedAt: new Date(NOW.getTime() - 30 * DAY_MS), lockedAt: null },
        "reactivate",
      ),
    ).toBe("active");
  });

  it("does not touch the operator-owned isActive flag", () => {
    const next = {
      ...locked,
      ...statusActionPatch(locked, "reactivate", NOW),
    };
    expect(getOrgStatus({ isActive: false, ...next })).toBe("locked_out");
  });

  it("keeps a lock in force when the legacy billing path clears suspendedAt", () => {
    // The Stripe webhook writes suspendedAt: null on payment success.
    expect(
      getOrgStatus({ isActive: true, suspendedAt: null, lockedAt: EARLIER }),
    ).toBe("locked_out");
  });
});

describe("statusActionSchema", () => {
  it.each(["suspend", "lock", "reactivate"])("accepts %s", (action) => {
    expect(statusActionSchema.parse({ action })).toEqual({ action });
  });

  it.each([
    ["an unknown action", { action: "delete" }],
    ["a missing action", {}],
    ["a non-string action", { action: 1 }],
    ["an extra key", { action: "lock", force: true }],
    ["null", null],
  ])("rejects %s", (_name, body) => {
    expect(statusActionSchema.safeParse(body).success).toBe(false);
  });
});
```

```ts
// src/lib/__tests__/internal-org.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/control-plane/billing-contact", () => ({
  getBillingContacts: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getBillingContacts } from "@/lib/control-plane/billing-contact";
import {
  internalOrgSelect,
  statusSnapshot,
  toInternalOrgs,
  type InternalOrgRow,
} from "@/lib/control-plane/internal-org";

const mockPrisma = vi.mocked(prisma, true);
// Prisma's groupBy generics do not survive vi.mocked (TS2615), so these two
// mocks are typed loosely.
const assetGroupBy = prisma.asset.groupBy as unknown as Mock;
const userGroupBy = prisma.user.groupBy as unknown as Mock;
const mockBillingContacts = vi.mocked(getBillingContacts);

const NOW = new Date("2026-10-12T10:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const ORG_C = "33333333-3333-4333-8333-333333333333";

function orgRow(overrides: Partial<InternalOrgRow> = {}): InternalOrgRow {
  return {
    id: ORG_A,
    name: "Acme",
    slug: "acme",
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
    isActive: true,
    suspendedAt: null,
    lockedAt: null,
    entitlements: { features: ["api_keys"], maxAssets: 100, maxUsers: 3 },
    plan: "professional",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    trialEndsAt: null,
    ...overrides,
  };
}

function useUsage(
  assets: Record<string, number>,
  users: Record<string, number>,
) {
  const rows = (counts: Record<string, number>) =>
    Object.entries(counts).map(([organizationId, count]) => ({
      organizationId,
      _count: { _all: count },
    }));
  assetGroupBy.mockResolvedValue(rows(assets) as never);
  userGroupBy.mockResolvedValue(rows(users) as never);
}

async function mapOne(row: InternalOrgRow) {
  const [org] = await toInternalOrgs([row]);
  return org;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  stubCloudMode();
  useUsage({}, {});
  mockBillingContacts.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("internalOrgSelect", () => {
  it("selects exactly the columns the internal API reports", () => {
    expect(Object.keys(internalOrgSelect).sort()).toEqual([
      "createdAt",
      "entitlements",
      "id",
      "isActive",
      "lockedAt",
      "name",
      "plan",
      "slug",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "suspendedAt",
      "trialEndsAt",
    ]);
  });
});

describe("toInternalOrgs: queries", () => {
  it("returns an empty list without any query", async () => {
    expect(await toInternalOrgs([])).toEqual([]);
    expect(assetGroupBy).not.toHaveBeenCalled();
    expect(userGroupBy).not.toHaveBeenCalled();
    expect(mockBillingContacts).not.toHaveBeenCalled();
  });

  it("uses a fixed number of queries however many organizations it maps", async () => {
    const rows = [
      orgRow({ id: ORG_A }),
      orgRow({ id: ORG_B, slug: "b" }),
      orgRow({ id: ORG_C, slug: "c" }),
    ];

    await toInternalOrgs(rows);

    expect(assetGroupBy).toHaveBeenCalledTimes(1);
    expect(userGroupBy).toHaveBeenCalledTimes(1);
    expect(mockBillingContacts).toHaveBeenCalledTimes(1);
    expect(mockBillingContacts).toHaveBeenCalledWith([ORG_A, ORG_B, ORG_C]);
    expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("counts all assets but only active users, per organization id", async () => {
    await toInternalOrgs([orgRow({ id: ORG_A }), orgRow({ id: ORG_B })]);

    expect(assetGroupBy).toHaveBeenCalledWith({
      by: ["organizationId"],
      where: { organizationId: { in: [ORG_A, ORG_B] } },
      _count: { _all: true },
    });
    expect(userGroupBy).toHaveBeenCalledWith({
      by: ["organizationId"],
      where: { organizationId: { in: [ORG_A, ORG_B] }, isActive: true },
      _count: { _all: true },
    });
  });
});

describe("toInternalOrgs: fields", () => {
  it("maps the identity, timestamps and legacy billing columns", async () => {
    const org = await mapOne(
      orgRow({
        trialEndsAt: new Date("2026-10-20T00:00:00.000Z"),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        plan: "starter",
      }),
    );

    expect(org).toMatchObject({
      id: ORG_A,
      name: "Acme",
      slug: "acme",
      createdAt: "2026-09-01T08:00:00.000Z",
      isActive: true,
      suspendedAt: null,
      lockedAt: null,
      legacy: {
        plan: "starter",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        trialEndsAt: "2026-10-20T00:00:00.000Z",
      },
    });
  });

  it("reports a missing trial end as null", async () => {
    const org = await mapOne(orgRow({ trialEndsAt: null }));
    expect(org.legacy?.trialEndsAt).toBeNull();
  });

  it("maps usage from the grouped counts and defaults to zero", async () => {
    useUsage({ [ORG_A]: 7 }, { [ORG_A]: 2, [ORG_B]: 5 });

    const [a, b, c] = await toInternalOrgs([
      orgRow({ id: ORG_A }),
      orgRow({ id: ORG_B }),
      orgRow({ id: ORG_C }),
    ]);

    expect(a.usage).toEqual({ assets: 7, users: 2 });
    expect(b.usage).toEqual({ assets: 0, users: 5 });
    expect(c.usage).toEqual({ assets: 0, users: 0 });
  });

  it("attaches the billing contact of each organization, or null", async () => {
    const contact = {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "owner@acme.test",
      emailVerified: true,
    };
    mockBillingContacts.mockResolvedValue(new Map([[ORG_A, contact]]));

    const [a, b] = await toInternalOrgs([
      orgRow({ id: ORG_A }),
      orgRow({ id: ORG_B }),
    ]);

    expect(a.billingContact).toEqual(contact);
    expect(b.billingContact).toBeNull();
  });
});

describe("toInternalOrgs: status", () => {
  it("is active without suspension or lock", async () => {
    expect((await mapOne(orgRow())).status).toBe("active");
  });

  it("is read_only inside the 14 day grace period", async () => {
    const suspendedAt = new Date(NOW.getTime() - 3 * DAY_MS);

    const org = await mapOne(orgRow({ suspendedAt }));

    expect(org.status).toBe("read_only");
    expect(org.suspendedAt).toBe(suspendedAt.toISOString());
  });

  it("is locked_out after the grace period", async () => {
    const org = await mapOne(
      orgRow({ suspendedAt: new Date(NOW.getTime() - 20 * DAY_MS) }),
    );
    expect(org.status).toBe("locked_out");
  });

  it("is locked_out with lockedAt, which beats an active organization", async () => {
    const lockedAt = new Date(NOW.getTime() - DAY_MS);

    const org = await mapOne(orgRow({ lockedAt }));

    expect(org.status).toBe("locked_out");
    expect(org.lockedAt).toBe(lockedAt.toISOString());
    expect(org.isActive).toBe(true);
  });

  it("is locked_out for an inactive organization and reports isActive", async () => {
    const org = await mapOne(orgRow({ isActive: false }));
    expect(org.status).toBe("locked_out");
    expect(org.isActive).toBe(false);
  });
});

describe("statusSnapshot", () => {
  it("reports the status with ISO timestamps", () => {
    const suspendedAt = new Date(NOW.getTime() - DAY_MS);
    expect(
      statusSnapshot({ isActive: true, suspendedAt, lockedAt: null }),
    ).toEqual({
      status: "read_only",
      suspendedAt: suspendedAt.toISOString(),
      lockedAt: null,
    });
  });
});

describe("toInternalOrgs: entitlements and overLimit", () => {
  it("reports the stored entitlements", async () => {
    const org = await mapOne(
      orgRow({
        entitlements: {
          features: ["api_keys", "scim"],
          maxAssets: 5,
          maxUsers: null,
        },
      }),
    );
    expect(org.entitlements).toEqual({
      features: ["api_keys", "scim"],
      maxAssets: 5,
      maxUsers: null,
    });
  });

  it("filters unknown features out of the stored value", async () => {
    const org = await mapOne(
      orgRow({
        entitlements: {
          features: ["api_keys", "white_label"],
          maxAssets: null,
          maxUsers: null,
        },
      }),
    );
    expect(org.entitlements?.features).toEqual(["api_keys"]);
  });

  it.each([
    ["SQL NULL", null],
    ["an invalid shape", { plan: "pro" }],
    ["a string", "professional"],
  ])("reports null for %s", async (_name, entitlements) => {
    const org = await mapOne(orgRow({ entitlements: entitlements as never }));
    expect(org.entitlements).toBeNull();
  });

  it("is not over the limit at the limit", async () => {
    useUsage({ [ORG_A]: 100 }, { [ORG_A]: 3 });
    expect((await mapOne(orgRow())).overLimit).toBe(false);
  });

  it("is over the limit above the asset limit", async () => {
    useUsage({ [ORG_A]: 101 }, { [ORG_A]: 0 });
    expect((await mapOne(orgRow())).overLimit).toBe(true);
  });

  it("is over the limit above the user limit", async () => {
    useUsage({ [ORG_A]: 0 }, { [ORG_A]: 4 });
    expect((await mapOne(orgRow())).overLimit).toBe(true);
  });

  it("never applies a null limit", async () => {
    useUsage({ [ORG_A]: 1_000_000 }, { [ORG_A]: 1_000_000 });
    const org = await mapOne(
      orgRow({
        entitlements: { features: [], maxAssets: null, maxUsers: null },
      }),
    );
    expect(org.overLimit).toBe(false);
  });

  it("treats a zero limit as a real limit", async () => {
    useUsage({ [ORG_A]: 1 }, {});
    const org = await mapOne(
      orgRow({
        entitlements: { features: [], maxAssets: 0, maxUsers: null },
      }),
    );
    expect(org.overLimit).toBe(true);
  });

  it("measures an organization without stored entitlements against NEW_ORG_ENTITLEMENTS", async () => {
    const above = (TEST_NEW_ORG_ENTITLEMENTS.maxAssets ?? 0) + 1;
    useUsage({ [ORG_A]: above }, {});

    const org = await mapOne(orgRow({ entitlements: null }));

    expect(org.entitlements).toBeNull();
    expect(org.overLimit).toBe(true);
  });

  it("measures an organization with an invalid stored value against NEW_ORG_ENTITLEMENTS", async () => {
    const above = (TEST_NEW_ORG_ENTITLEMENTS.maxUsers ?? 0) + 1;
    useUsage({}, { [ORG_A]: above });

    const org = await mapOne(orgRow({ entitlements: { broken: true } }));

    expect(org.entitlements).toBeNull();
    expect(org.overLimit).toBe(true);
  });

  it("fails loudly when NEW_ORG_ENTITLEMENTS is missing", async () => {
    vi.stubEnv("NEW_ORG_ENTITLEMENTS", "");
    await expect(mapOne(orgRow({ entitlements: null }))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/control-plane-auth.test.ts src/lib/__tests__/status-actions.test.ts src/lib/__tests__/internal-org.test.ts`
Expected: FAIL, all three files, `Cannot find package '@/lib/control-plane/auth'` (and `status-actions`, `internal-org`).

- [ ] **Step 3: Write the modules**

```ts
// src/lib/control-plane/responses.ts
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * JSON bodies of the internal API. Every error is `{ error, code, ...extras }`.
 * None of them carries a stack trace or the message of an unexpected error.
 */
export function controlPlaneError(
  status: number,
  error: string,
  code: string,
  extras: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error, code, ...extras }, { status });
}

export function invalidOrgId(): NextResponse {
  return controlPlaneError(400, "Invalid organization id", "invalid_id");
}

export function orgNotFound(): NextResponse {
  return controlPlaneError(404, "Organization not found", "org_not_found");
}

export function validationFailed(error: ZodError): NextResponse {
  return controlPlaneError(400, "Validation failed", "validation_failed", {
    issues: error.issues,
  });
}

export function internalFailure(): NextResponse {
  return controlPlaneError(500, "Internal server error", "internal_error");
}

export type JsonBody =
  { ok: true; data: unknown } | { ok: false; response: NextResponse };

/**
 * Reads a JSON request body. Callers test `body.ok === false`: narrowing on a
 * bare boolean does not work with the repo's non-strict tsconfig.
 */
export async function readJsonBody(req: Request): Promise<JsonBody> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return {
      ok: false,
      response: controlPlaneError(
        400,
        "Request body must be valid JSON",
        "invalid_json",
      ),
    };
  }
}
```

```ts
// src/lib/control-plane/auth.ts
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { isCloudMode } from "@/lib/deployment-mode";
import { controlPlaneSecrets } from "@/lib/control-plane/keys";
import { controlPlaneError } from "@/lib/control-plane/responses";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Constant-time check of an Authorization header against `Bearer <secret>`.
 * Both sides are hashed first, so the comparison time depends neither on the
 * contents nor on the length of either value. An unset or empty secret never
 * matches. (`isValidCronAuth` is not used on purpose: its default parameter
 * falls back to CRON_SECRET when the secret argument is undefined.)
 */
export function bearerMatches(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!header || !secret) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * Guard for every /api/internal/* handler; it must be the first statement:
 *
 *   const denied = requireControlPlane(req);
 *   if (denied) return denied;
 *
 * Answers 404 outside cloud mode (before looking at the request at all) and
 * 401 unless the bearer token is the current or the previous control-plane
 * secret. CRON_SECRET and session cookies never authenticate.
 */
export function requireControlPlane(req: Request): NextResponse | null {
  if (!isCloudMode()) {
    return controlPlaneError(404, "Not found", "not_found");
  }

  const header = req.headers.get("authorization");
  const matches = controlPlaneSecrets().map((secret) =>
    bearerMatches(header, secret),
  );
  if (!matches.includes(true)) {
    return controlPlaneError(401, "Unauthorized", "unauthorized");
  }

  return null;
}
```

`bearerMatches` hashes both sides before the constant-time compare, so neither the contents nor the length of the secret influences the timing. It is not built on `isValidCronAuth`: that helper's default parameter falls back to `CRON_SECRET` when the secret argument is `undefined`, which is exactly what an unset `CONTROL_PLANE_SECRET_PREVIOUS` would pass. `controlPlaneSecrets()` (Task 12) returns the non-empty secrets only, so an unset previous secret is never compared at all.

```ts
// src/lib/control-plane/status-actions.ts
import { z } from "zod";

export const STATUS_ACTIONS = ["suspend", "lock", "reactivate"] as const;

export type StatusAction = (typeof STATUS_ACTIONS)[number];

export const statusActionSchema = z.strictObject({
  action: z.enum(STATUS_ACTIONS),
});

export interface StatusFields {
  suspendedAt: Date | null;
  lockedAt: Date | null;
}

/** Only the columns that change; an empty patch means "already there". */
export interface StatusPatch {
  suspendedAt?: Date | null;
  lockedAt?: Date | null;
}

/**
 * The control plane's status transitions, applied to the current state.
 * Every action is idempotent and none touches the operator-owned `isActive`.
 *
 * - suspend: starts the read-only grace period, but only for an org that is
 *   neither suspended nor locked (a repeated suspend must not restart it).
 * - lock: sets `lockedAt` once; the first lock time is kept.
 * - reactivate: clears both `lockedAt` and `suspendedAt`.
 */
export function statusActionPatch(
  org: StatusFields,
  action: StatusAction,
  now: Date,
): StatusPatch {
  if (action === "suspend") {
    return !org.lockedAt && !org.suspendedAt ? { suspendedAt: now } : {};
  }

  if (action === "lock") {
    return org.lockedAt ? {} : { lockedAt: now };
  }

  return {
    ...(org.lockedAt ? { lockedAt: null } : {}),
    ...(org.suspendedAt ? { suspendedAt: null } : {}),
  };
}
```

```ts
// src/lib/control-plane/internal-org.ts
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrgStatus, type OrgStatus } from "@/lib/org-suspension";
import {
  parseStoredEntitlements,
  resolveEntitlements,
} from "@/lib/entitlements";
import {
  isOverLimit,
  type Entitlements,
  type OrgUsage,
} from "@/lib/entitlements-shared";
import {
  getBillingContacts,
  type BillingContact,
} from "@/lib/control-plane/billing-contact";

/** The organization columns the internal API reads (billing ones included). */
export const internalOrgSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  isActive: true,
  suspendedAt: true,
  lockedAt: true,
  entitlements: true,
  plan: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  trialEndsAt: true,
} satisfies Prisma.OrganizationSelect;

export type InternalOrgRow = Prisma.OrganizationGetPayload<{
  select: typeof internalOrgSelect;
}>;

export interface InternalOrgLegacy {
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
}

/** The wire shape of an organization (spec section 4.2). */
export interface InternalOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: OrgStatus;
  isActive: boolean;
  suspendedAt: string | null;
  lockedAt: string | null;
  /** The stored value, or null when unset or invalid. Not the effective one. */
  entitlements: Entitlements | null;
  usage: OrgUsage;
  /** Measured against the effective entitlements; strictly above a limit. */
  overLimit: boolean;
  billingContact: BillingContact | null;
  /** Until phase 3a removes the legacy billing columns. */
  legacy?: InternalOrgLegacy;
}

export interface StatusSnapshot {
  status: OrgStatus;
  suspendedAt: string | null;
  lockedAt: string | null;
}

/** Status plus the two timestamps; also the before/after of status audits. */
export function statusSnapshot(
  row: Pick<InternalOrgRow, "isActive" | "suspendedAt" | "lockedAt">,
): StatusSnapshot {
  return {
    status: getOrgStatus(row),
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    lockedAt: row.lockedAt?.toISOString() ?? null,
  };
}

interface OrgCountRow {
  organizationId: string | null;
  _count: { _all: number };
}

function countsByOrg(rows: readonly OrgCountRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.organizationId) counts.set(row.organizationId, row._count._all);
  }
  return counts;
}

function buildInternalOrg(
  row: InternalOrgRow,
  usage: OrgUsage,
  billingContact: BillingContact | null,
): InternalOrg {
  const effective = resolveEntitlements(row.entitlements, { orgId: row.id });

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt.toISOString(),
    ...statusSnapshot(row),
    isActive: row.isActive,
    entitlements:
      parseStoredEntitlements(row.entitlements)?.entitlements ?? null,
    usage,
    overLimit: isOverLimit(effective, usage),
    billingContact,
    legacy: {
      plan: row.plan,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    },
  };
}

/**
 * Maps organization rows to the wire shape with a fixed number of queries, so
 * a page of 100 organizations costs the same as one: two groupBy usage
 * counts (all assets, active users) and one billing contact lookup.
 * Never add a per-organization query here.
 */
export async function toInternalOrgs(
  rows: readonly InternalOrgRow[],
): Promise<InternalOrg[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [assetRows, userRows, contacts] = await Promise.all([
    prisma.asset.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, isActive: true },
      _count: { _all: true },
    }),
    getBillingContacts(ids),
  ]);
  const assets = countsByOrg(assetRows);
  const users = countsByOrg(userRows);

  return rows.map((row) =>
    buildInternalOrg(
      row,
      { assets: assets.get(row.id) ?? 0, users: users.get(row.id) ?? 0 },
      contacts.get(row.id) ?? null,
    ),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/control-plane-auth.test.ts src/lib/__tests__/status-actions.test.ts src/lib/__tests__/internal-org.test.ts`
Expected: PASS (all three files).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/control-plane/responses.ts src/lib/control-plane/auth.ts src/lib/control-plane/status-actions.ts src/lib/control-plane/internal-org.ts src/lib/__tests__/control-plane-auth.test.ts src/lib/__tests__/status-actions.test.ts src/lib/__tests__/internal-org.test.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/control-plane/responses.ts src/lib/control-plane/auth.ts src/lib/control-plane/status-actions.ts src/lib/control-plane/internal-org.ts src/lib/__tests__/control-plane-auth.test.ts src/lib/__tests__/status-actions.test.ts src/lib/__tests__/internal-org.test.ts
git commit -m "feat: add control-plane auth, status transitions and the internal org mapper"
```

## Part B: the internal routes

- [ ] **Step 7: Write the failing tests**

The route tests cover every case of spec section 9 "Internal API" and the status tests: 404 outside cloud mode before any other check, 401 for a missing or wrong token, for `CRON_SECRET` and for a session cookie, the previous secret only while it is set, a non-guid id, an unknown organization, strict bodies, the audit entry, one `groupBy` pair per list request, and the transition table end to end.

```ts
// src/app/api/__tests__/internal-orgs.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { NextRequest } from "next/server";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";
import {
  TEST_CONTROL_PLANE_SECRET,
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { ORGANIZATION: "Organization" },
}));
vi.mock("@/lib/control-plane/billing-contact", () => ({
  getBillingContacts: vi.fn(),
}));

import { GET as listOrgs } from "@/app/api/internal/orgs/route";
import { GET as getOrg } from "@/app/api/internal/orgs/[id]/route";
import { PUT as putEntitlements } from "@/app/api/internal/orgs/[id]/entitlements/route";
import { POST as postStatus } from "@/app/api/internal/orgs/[id]/status/route";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit-log";
import { getBillingContacts } from "@/lib/control-plane/billing-contact";
import {
  internalOrgSelect,
  type InternalOrg,
  type InternalOrgRow,
} from "@/lib/control-plane/internal-org";

const mockPrisma = vi.mocked(prisma, true);
// Prisma's groupBy generics do not survive vi.mocked (TS2615), so these two
// mocks are typed loosely.
const assetGroupBy = prisma.asset.groupBy as unknown as Mock;
const userGroupBy = prisma.user.groupBy as unknown as Mock;
const mockBillingContacts = vi.mocked(getBillingContacts);

const NOW = new Date("2026-10-12T10:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const ORG_ID = "3f6c1f0e-8b0a-4c63-9d1e-2f5a7c9b1a10";
const ORG_B = "5a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const ORG_C = "6b2e3d4c-5f60-4b7c-9d8e-0f1a2b3c4d5e";
const PREVIOUS_SECRET = "previous-control-plane-secret-abcdefghijklmnop";
const CRON_SECRET = "cron-secret-that-is-long-enough-0123456789";

const STORED = { features: ["api_keys"], maxAssets: 100, maxUsers: 3 };
const VALID_BODY = {
  features: ["procurement", "api_keys"],
  maxAssets: 500,
  maxUsers: null,
};

const authorized = { authorization: `Bearer ${TEST_CONTROL_PLANE_SECRET}` };
const params = (id: string = ORG_ID) => ({ params: Promise.resolve({ id }) });

function orgRow(overrides: Partial<InternalOrgRow> = {}): InternalOrgRow {
  return {
    id: ORG_ID,
    name: "Acme",
    slug: "acme",
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
    isActive: true,
    suspendedAt: null,
    lockedAt: null,
    entitlements: STORED,
    plan: "professional",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    trialEndsAt: null,
    ...overrides,
  };
}

/** Makes `row` the stored organization: reads return it, updates merge into it. */
function givenOrg(overrides: Partial<InternalOrgRow> = {}): InternalOrgRow {
  const row = orgRow(overrides);
  mockPrisma.organization.findUnique.mockResolvedValue(row as never);
  mockPrisma.organization.update.mockImplementation((async ({
    data,
  }: {
    data: Partial<InternalOrgRow>;
  }) => ({ ...row, ...data })) as never);
  return row;
}

type OrgBody = { org: InternalOrg };
type ListBody = { orgs: InternalOrg[]; nextCursor: string | null };
type ErrorBody = { error: string; code: string; issues?: unknown[] };

function listRequest(query = "", headers: Record<string, string> = authorized) {
  return createMockRequest(`/api/internal/orgs${query}`, { headers });
}

function putRequest(body: Record<string, unknown> = VALID_BODY, id = ORG_ID) {
  return createMockRequest(`/api/internal/orgs/${id}/entitlements`, {
    method: "PUT",
    body,
    headers: authorized,
  });
}

function statusRequest(body: Record<string, unknown>, id = ORG_ID) {
  return createMockRequest(`/api/internal/orgs/${id}/status`, {
    method: "POST",
    body,
    headers: authorized,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCloudMode();
  vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  givenOrg();
  mockPrisma.organization.findMany.mockResolvedValue([]);
  assetGroupBy.mockResolvedValue([] as never);
  userGroupBy.mockResolvedValue([] as never);
  mockBillingContacts.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// -- Authentication ---------------------------------------------------------

type Call = (headers: Record<string, string>, id?: string) => Promise<Response>;

const CALLS: Array<[string, Call]> = [
  [
    "GET /api/internal/orgs",
    (headers) => listOrgs(createMockRequest("/api/internal/orgs", { headers })),
  ],
  [
    "GET /api/internal/orgs/:id",
    (headers, id = ORG_ID) =>
      getOrg(
        createMockRequest(`/api/internal/orgs/${id}`, { headers }),
        params(id),
      ),
  ],
  [
    "PUT /api/internal/orgs/:id/entitlements",
    (headers, id = ORG_ID) =>
      putEntitlements(
        createMockRequest(`/api/internal/orgs/${id}/entitlements`, {
          method: "PUT",
          body: VALID_BODY,
          headers,
        }),
        params(id),
      ),
  ],
  [
    "POST /api/internal/orgs/:id/status",
    (headers, id = ORG_ID) =>
      postStatus(
        createMockRequest(`/api/internal/orgs/${id}/status`, {
          method: "POST",
          body: { action: "lock" },
          headers,
        }),
        params(id),
      ),
  ],
];

function expectNoDatabaseAccess() {
  expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
  expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  expect(assetGroupBy).not.toHaveBeenCalled();
  expect(createAuditLog).not.toHaveBeenCalled();
}

describe.each(CALLS)("%s: authentication", (_name, call) => {
  it("answers 404 outside cloud mode before any other check", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");

    // An invalid id and a valid-looking token: still 404, nothing else runs.
    const { status, body } = await parseResponse<ErrorBody>(
      await call(authorized, "not-a-uuid"),
    );

    expect(status).toBe(404);
    expect(body).toEqual({ error: "Not found", code: "not_found" });
    expectNoDatabaseAccess();
  });

  it("answers 401 without a token", async () => {
    const { status, body } = await parseResponse<ErrorBody>(await call({}));

    expect(status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized", code: "unauthorized" });
    expectNoDatabaseAccess();
  });

  it("answers 401 for a wrong token", async () => {
    const res = await call({ authorization: "Bearer wrong-token" });
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  it("answers 401 before it validates the id", async () => {
    const res = await call({}, "not-a-uuid");
    expect(res.status).toBe(401);
  });

  it("never accepts CRON_SECRET as the token", async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    const res = await call({ authorization: `Bearer ${CRON_SECRET}` });
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  it("never accepts a session cookie", async () => {
    const res = await call({ cookie: "better-auth.session_token=abc.def" });
    expect(res.status).toBe(401);
    expectNoDatabaseAccess();
  });

  it("rejects an empty token while the previous secret is unset", async () => {
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
    expect((await call({ authorization: "Bearer undefined" })).status).toBe(
      401,
    );
  });

  it("rejects the previous secret once it is unset", async () => {
    const res = await call({ authorization: `Bearer ${PREVIOUS_SECRET}` });
    expect(res.status).toBe(401);
  });

  it("accepts the previous secret while it is set", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", PREVIOUS_SECRET);
    const res = await call({ authorization: `Bearer ${PREVIOUS_SECRET}` });
    expect(res.status).toBe(200);
  });

  it("accepts the current secret", async () => {
    expect((await call(authorized)).status).toBe(200);
  });
});

// -- GET /api/internal/orgs --------------------------------------------------

describe("GET /api/internal/orgs", () => {
  it("returns organizations oldest first with the default page size", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgRow({ id: ORG_ID }),
      orgRow({ id: ORG_B, slug: "b" }),
    ] as never);

    const { status, body } = await parseResponse<ListBody>(
      await listOrgs(listRequest()),
    );

    expect(status).toBe(200);
    expect(body.orgs.map((org) => org.id)).toEqual([ORG_ID, ORG_B]);
    expect(body.nextCursor).toBeNull();
    expect(mockPrisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.findMany.mock.calls[0][0]).toEqual({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 101,
      select: internalOrgSelect,
    });
  });

  it("returns the full wire shape of an organization", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([orgRow()] as never);
    assetGroupBy.mockResolvedValue([
      { organizationId: ORG_ID, _count: { _all: 7 } },
    ] as never);
    userGroupBy.mockResolvedValue([
      { organizationId: ORG_ID, _count: { _all: 2 } },
    ] as never);
    const contact = {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "owner@acme.test",
      emailVerified: true,
    };
    mockBillingContacts.mockResolvedValue(new Map([[ORG_ID, contact]]));

    const { body } = await parseResponse<ListBody>(
      await listOrgs(listRequest()),
    );

    expect(body.orgs[0]).toEqual({
      id: ORG_ID,
      name: "Acme",
      slug: "acme",
      createdAt: "2026-09-01T08:00:00.000Z",
      status: "active",
      isActive: true,
      suspendedAt: null,
      lockedAt: null,
      entitlements: STORED,
      usage: { assets: 7, users: 2 },
      overLimit: false,
      billingContact: contact,
      legacy: {
        plan: "professional",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        trialEndsAt: null,
      },
    });
  });

  it("returns the last id of a full page as nextCursor", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgRow({ id: ORG_ID }),
      orgRow({ id: ORG_B }),
      orgRow({ id: ORG_C }),
    ] as never);

    const { body } = await parseResponse<ListBody>(
      await listOrgs(listRequest("?limit=2")),
    );

    expect(body.orgs.map((org) => org.id)).toEqual([ORG_ID, ORG_B]);
    expect(body.nextCursor).toBe(ORG_B);
    expect(mockPrisma.organization.findMany.mock.calls[0][0]).toMatchObject({
      take: 3,
    });
  });

  it("returns a null nextCursor on the last page", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgRow({ id: ORG_ID }),
      orgRow({ id: ORG_B }),
    ] as never);

    const { body } = await parseResponse<ListBody>(
      await listOrgs(listRequest("?limit=2")),
    );

    expect(body.nextCursor).toBeNull();
  });

  it("continues after the cursor without repeating it", async () => {
    await listOrgs(listRequest(`?cursor=${ORG_B}`));

    expect(mockPrisma.organization.findMany.mock.calls[0][0]).toMatchObject({
      cursor: { id: ORG_B },
      skip: 1,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("includes organizations created exactly at createdAfter", async () => {
    await listOrgs(listRequest("?createdAfter=2026-09-01T08:00:00.000Z"));

    expect(mockPrisma.organization.findMany.mock.calls[0][0]).toMatchObject({
      where: { createdAt: { gte: new Date("2026-09-01T08:00:00.000Z") } },
    });
  });

  it("accepts a plain date for createdAfter", async () => {
    await listOrgs(listRequest("?createdAfter=2026-09-01"));

    expect(mockPrisma.organization.findMany.mock.calls[0][0]).toMatchObject({
      where: { createdAt: { gte: new Date("2026-09-01T00:00:00.000Z") } },
    });
  });

  it.each([
    ["a zero limit", "?limit=0"],
    ["a limit above 100", "?limit=101"],
    ["a fractional limit", "?limit=1.5"],
    ["a non-numeric limit", "?limit=many"],
    ["an empty limit", "?limit="],
    ["a createdAfter that is not a date", "?createdAfter=yesterday"],
    ["a createdAfter without a date", "?createdAfter="],
    ["a cursor that is not a uuid", "?cursor=not-a-uuid"],
    ["an unknown parameter", "?createAfter=2026-09-01"],
  ])("answers 400 for %s", async (_name, query) => {
    const { status, body } = await parseResponse<ErrorBody>(
      await listOrgs(listRequest(query)),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("validation_failed");
    expect(body.issues?.length).toBeGreaterThan(0);
    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("accepts a limit of 1 and of 100", async () => {
    expect((await listOrgs(listRequest("?limit=1"))).status).toBe(200);
    expect((await listOrgs(listRequest("?limit=100"))).status).toBe(200);
  });

  it("runs the usage and contact queries once per request, not per organization", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgRow({ id: ORG_ID }),
      orgRow({ id: ORG_B }),
      orgRow({ id: ORG_C }),
    ] as never);

    await listOrgs(listRequest());

    expect(assetGroupBy).toHaveBeenCalledTimes(1);
    expect(userGroupBy).toHaveBeenCalledTimes(1);
    expect(mockBillingContacts).toHaveBeenCalledTimes(1);
  });

  it("answers an empty page without usage queries", async () => {
    const { status, body } = await parseResponse<ListBody>(
      await listOrgs(listRequest()),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ orgs: [], nextCursor: null });
    expect(assetGroupBy).not.toHaveBeenCalled();
  });

  it("answers 500 without leaking the error", async () => {
    mockPrisma.organization.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://user:secret@db:5432/app"),
    );

    const res = await listOrgs(listRequest());
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: "Internal server error",
      code: "internal_error",
    });
    expect(text).not.toContain("postgres://");
  });
});

// -- GET /api/internal/orgs/:id ----------------------------------------------

describe("GET /api/internal/orgs/:id", () => {
  const read = (id = ORG_ID) =>
    getOrg(
      createMockRequest(`/api/internal/orgs/${id}`, { headers: authorized }),
      params(id),
    );

  it("returns the organization", async () => {
    const { status, body } = await parseResponse<OrgBody>(await read());

    expect(status).toBe(200);
    expect(body.org).toMatchObject({
      id: ORG_ID,
      status: "active",
      entitlements: STORED,
    });
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: internalOrgSelect,
    });
  });

  it("reports the legacy billing fields until phase 3a", async () => {
    const { body } = await parseResponse<OrgBody>(await read());

    expect(body.org.legacy).toEqual({
      plan: "professional",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      trialEndsAt: null,
    });
  });

  it("reports a locked organization as locked_out", async () => {
    const lockedAt = new Date(NOW.getTime() - DAY_MS);
    givenOrg({ lockedAt });

    const { body } = await parseResponse<OrgBody>(await read());

    expect(body.org.status).toBe("locked_out");
    expect(body.org.lockedAt).toBe(lockedAt.toISOString());
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const { status, body } = await parseResponse<ErrorBody>(
      await read("not-a-uuid"),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("invalid_id");
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown organization", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const { status, body } = await parseResponse<ErrorBody>(await read());

    expect(status).toBe(404);
    expect(body.code).toBe("org_not_found");
  });

  it("answers 500 without leaking the error", async () => {
    mockPrisma.organization.findUnique.mockRejectedValue(
      new Error("relation organizations does not exist"),
    );

    const res = await read();
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain("relation");
  });
});

// -- PUT /api/internal/orgs/:id/entitlements ---------------------------------

describe("PUT /api/internal/orgs/:id/entitlements", () => {
  it("stores the entitlements in canonical form and answers with the organization", async () => {
    const { status, body } = await parseResponse<OrgBody>(
      await putEntitlements(putRequest(), params()),
    );

    const stored = {
      features: ["api_keys", "procurement"],
      maxAssets: 500,
      maxUsers: null,
    };
    expect(status).toBe(200);
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { entitlements: stored },
      select: internalOrgSelect,
    });
    expect(body.org.entitlements).toEqual(stored);
  });

  it("deduplicates features", async () => {
    await putEntitlements(
      putRequest({
        features: ["scim", "api_keys", "scim"],
        maxAssets: null,
        maxUsers: null,
      }),
      params(),
    );

    const data = mockPrisma.organization.update.mock.calls[0][0].data as {
      entitlements: { features: string[] };
    };
    expect(data.entitlements.features).toEqual(["api_keys", "scim"]);
  });

  it("accepts zero and null limits", async () => {
    const res = await putEntitlements(
      putRequest({ features: [], maxAssets: 0, maxUsers: null }),
      params(),
    );
    expect(res.status).toBe(200);
  });

  it("never writes a JSON null", async () => {
    await putEntitlements(putRequest(), params());

    const data = mockPrisma.organization.update.mock.calls[0][0].data as {
      entitlements: unknown;
    };
    expect(data.entitlements).toEqual(expect.any(Object));
    expect(data.entitlements).not.toBeNull();
  });

  it("reports an over-limit organization against the new limits", async () => {
    assetGroupBy.mockResolvedValue([
      { organizationId: ORG_ID, _count: { _all: 11 } },
    ] as never);

    const { body } = await parseResponse<OrgBody>(
      await putEntitlements(
        putRequest({ features: [], maxAssets: 10, maxUsers: null }),
        params(),
      ),
    );

    expect(body.org.overLimit).toBe(true);
  });

  it("writes an audit entry with the actor, the old and the new value", async () => {
    await putEntitlements(putRequest(), params());

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith({
      userId: null,
      action: "UPDATE",
      entity: "Organization",
      entityId: ORG_ID,
      details: {
        actor: "control-plane",
        before: { entitlements: STORED },
        after: {
          entitlements: {
            features: ["api_keys", "procurement"],
            maxAssets: 500,
            maxUsers: null,
          },
        },
      },
    });
  });

  it("records a missing old value as null in the audit entry", async () => {
    givenOrg({ entitlements: null });

    await putEntitlements(putRequest(), params());

    expect(vi.mocked(createAuditLog).mock.calls[0][0].details?.before).toEqual({
      entitlements: null,
    });
  });

  it.each([
    [
      "an unknown feature",
      { features: ["white_label"], maxAssets: null, maxUsers: null },
    ],
    [
      "an unknown key",
      { features: [], maxAssets: null, maxUsers: null, plan: "pro" },
    ],
    ["a missing limit", { features: [], maxAssets: null }],
    ["a negative limit", { features: [], maxAssets: -1, maxUsers: null }],
    ["a fractional limit", { features: [], maxAssets: 1.5, maxUsers: null }],
    ["a string limit", { features: [], maxAssets: "10", maxUsers: null }],
    [
      "a non-array features value",
      { features: "api_keys", maxAssets: null, maxUsers: null },
    ],
    ["an empty object", {}],
  ])(
    "answers 400 with the issues for %s and writes nothing",
    async (_name, body) => {
      const res = await putEntitlements(putRequest(body), params());
      const parsed = await parseResponse<ErrorBody>(res);

      expect(parsed.status).toBe(400);
      expect(parsed.body.code).toBe("validation_failed");
      expect(parsed.body.issues?.length).toBeGreaterThan(0);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    },
  );

  it("answers 400 for a body that is not JSON", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/internal/orgs/${ORG_ID}/entitlements`,
      { method: "PUT", body: "{not json", headers: authorized },
    );

    const { status, body } = await parseResponse<ErrorBody>(
      await putEntitlements(req, params()),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("invalid_json");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const { status, body } = await parseResponse<ErrorBody>(
      await putEntitlements(putRequest(VALID_BODY, "42"), params("42")),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("invalid_id");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown organization and writes nothing", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const { status, body } = await parseResponse<ErrorBody>(
      await putEntitlements(putRequest(), params()),
    );

    expect(status).toBe(404);
    expect(body.code).toBe("org_not_found");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("works for a locked organization", async () => {
    givenOrg({ lockedAt: NOW });

    const res = await putEntitlements(putRequest(), params());

    expect(res.status).toBe(200);
  });

  it("answers 500 without leaking the error", async () => {
    mockPrisma.organization.update.mockRejectedValue(
      new Error("deadlock detected on table organizations"),
    );

    const res = await putEntitlements(putRequest(), params());
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain("deadlock");
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});

// -- POST /api/internal/orgs/:id/status --------------------------------------

describe("POST /api/internal/orgs/:id/status", () => {
  it("suspend puts an active organization into read-only", async () => {
    const { status, body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "suspend" }), params()),
    );

    expect(status).toBe(200);
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { suspendedAt: NOW },
      select: internalOrgSelect,
    });
    expect(body.org.status).toBe("read_only");
    expect(body.org.suspendedAt).toBe(NOW.toISOString());
  });

  it("suspend is a no-op for an organization that is already suspended", async () => {
    const suspendedAt = new Date(NOW.getTime() - 5 * DAY_MS);
    givenOrg({ suspendedAt });

    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "suspend" }), params()),
    );

    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(body.org.status).toBe("read_only");
    expect(body.org.suspendedAt).toBe(suspendedAt.toISOString());
  });

  it("suspend does not soften a lock", async () => {
    givenOrg({ lockedAt: new Date(NOW.getTime() - DAY_MS) });

    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "suspend" }), params()),
    );

    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(body.org.status).toBe("locked_out");
  });

  it("lock locks out an active organization", async () => {
    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "lock" }), params()),
    );

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { lockedAt: NOW },
      select: internalOrgSelect,
    });
    expect(body.org.status).toBe("locked_out");
    expect(body.org.lockedAt).toBe(NOW.toISOString());
  });

  it("lock keeps the first lock time", async () => {
    const lockedAt = new Date(NOW.getTime() - 3 * DAY_MS);
    givenOrg({ lockedAt });

    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "lock" }), params()),
    );

    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(body.org.lockedAt).toBe(lockedAt.toISOString());
  });

  it("reactivate clears the lock and the suspension", async () => {
    givenOrg({
      lockedAt: new Date(NOW.getTime() - DAY_MS),
      suspendedAt: new Date(NOW.getTime() - 20 * DAY_MS),
    });

    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "reactivate" }), params()),
    );

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { lockedAt: null, suspendedAt: null },
      select: internalOrgSelect,
    });
    expect(body.org.status).toBe("active");
    expect(body.org.lockedAt).toBeNull();
    expect(body.org.suspendedAt).toBeNull();
  });

  it("reactivate leaves the operator-owned isActive flag alone", async () => {
    givenOrg({ isActive: false, lockedAt: NOW });

    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "reactivate" }), params()),
    );

    const data = mockPrisma.organization.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("isActive");
    expect(body.org.isActive).toBe(false);
    expect(body.org.status).toBe("locked_out");
  });

  it("reactivate is a no-op for an active organization", async () => {
    const { body } = await parseResponse<OrgBody>(
      await postStatus(statusRequest({ action: "reactivate" }), params()),
    );

    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(body.org.status).toBe("active");
  });

  it("writes an audit entry with the action and the status before and after", async () => {
    await postStatus(statusRequest({ action: "lock" }), params());

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith({
      userId: null,
      action: "UPDATE",
      entity: "Organization",
      entityId: ORG_ID,
      details: {
        actor: "control-plane",
        action: "lock",
        before: { status: "active", suspendedAt: null, lockedAt: null },
        after: {
          status: "locked_out",
          suspendedAt: null,
          lockedAt: NOW.toISOString(),
        },
      },
    });
  });

  it("audits a transition that changed nothing", async () => {
    await postStatus(statusRequest({ action: "reactivate" }), params());
    expect(createAuditLog).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an unknown action", { action: "delete" }],
    ["a missing action", {}],
    ["an extra key", { action: "lock", force: true }],
  ])("answers 400 for %s and writes nothing", async (_name, body) => {
    const res = await postStatus(statusRequest(body), params());
    const parsed = await parseResponse<ErrorBody>(res);

    expect(parsed.status).toBe(400);
    expect(parsed.body.code).toBe("validation_failed");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/internal/orgs/${ORG_ID}/status`,
      { method: "POST", body: "lock", headers: authorized },
    );

    const { status, body } = await parseResponse<ErrorBody>(
      await postStatus(req, params()),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("invalid_json");
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const { status, body } = await parseResponse<ErrorBody>(
      await postStatus(statusRequest({ action: "lock" }, "x"), params("x")),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("invalid_id");
  });

  it("answers 404 for an unknown organization and writes nothing", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const { status, body } = await parseResponse<ErrorBody>(
      await postStatus(statusRequest({ action: "lock" }), params()),
    );

    expect(status).toBe(404);
    expect(body.code).toBe("org_not_found");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("answers 500 without leaking the error", async () => {
    mockPrisma.organization.update.mockRejectedValue(
      new Error("could not serialize access"),
    );

    const res = await postStatus(statusRequest({ action: "lock" }), params());
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain("serialize");
  });
});

describe("the effective entitlements behind overLimit", () => {
  it("fall back to NEW_ORG_ENTITLEMENTS for an organization without a stored value", async () => {
    givenOrg({ entitlements: null });
    userGroupBy.mockResolvedValue([
      {
        organizationId: ORG_ID,
        _count: { _all: (TEST_NEW_ORG_ENTITLEMENTS.maxUsers ?? 0) + 1 },
      },
    ] as never);

    const { body } = await parseResponse<OrgBody>(
      await getOrg(
        createMockRequest(`/api/internal/orgs/${ORG_ID}`, {
          headers: authorized,
        }),
        params(),
      ),
    );

    expect(body.org.entitlements).toBeNull();
    expect(body.org.overLimit).toBe(true);
  });
});
```

The static test walks `src/app/api/internal/**/route.ts` (same walker as `route-conventions.test.ts`) and asserts that every exported handler calls `requireControlPlane(` before it touches the params, the request body, the query or the database, and that no internal route (nor `auth.ts`) uses session, API key or cron authentication. It reads the code without comments, so a comment can neither satisfy nor break a check.

```ts
// src/app/api/__tests__/internal-routes-guard.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "..");
const INTERNAL_DIR = path.join(API_DIR, "internal");
const CONTROL_PLANE_AUTH = path.resolve(
  API_DIR,
  "../../lib/control-plane/auth.ts",
);

/** Every exported HTTP method handler, whatever the method. */
const HTTP_HANDLER =
  /export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g;

/** Anything that would authenticate a caller another way, or read the body. */
const BEFORE_THE_GUARD =
  /await\s+params|prisma\.|\.json\(\)|searchParams|req\.url|headers\(\)/;

/** Session, API key and cron authentication must never reach the internal API. */
const OTHER_AUTH =
  /\b(getAuthUser|requireApiAuth|requireApiAdmin|requireSuperAdmin|requirePermission|isValidCronAuth|CRON_SECRET|cookies)\b/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

/** Source code without comments, so a comment cannot satisfy or break a check. */
function readCode(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const files = routeFiles(INTERNAL_DIR).map((full) => ({
  rel: path.relative(API_DIR, full),
  src: readCode(full),
}));

/** The source of each handler: from its export up to the next export. */
function handlerSources(src: string): string[] {
  const starts = [...src.matchAll(HTTP_HANDLER)].map((m) => m.index ?? 0);
  return starts.map((start, i) =>
    src.slice(start, starts[i + 1] ?? src.length),
  );
}

describe("internal API routes", () => {
  it("finds the internal routes", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((f) => f.rel).sort()).toEqual(
      expect.arrayContaining([
        "internal/orgs/[id]/entitlements/route.ts",
        "internal/orgs/[id]/route.ts",
        "internal/orgs/[id]/status/route.ts",
        "internal/orgs/route.ts",
      ]),
    );
  });

  it("exports its handlers as declarations, so this test sees all of them", () => {
    const offenders = files
      .filter(
        (f) => /export\s*\{/.test(f.src) || /export\s+default/.test(f.src),
      )
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("calls requireControlPlane in every exported handler", () => {
    const offenders = files
      .filter((f) => {
        const handlers = handlerSources(f.src);
        return (
          handlers.length === 0 ||
          handlers.some((source) => !source.includes("requireControlPlane("))
        );
      })
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("calls requireControlPlane before anything else in each handler", () => {
    const offenders = files
      .filter((f) =>
        handlerSources(f.src).some((source) => {
          const guard = source.indexOf("requireControlPlane(");
          const other = source.search(BEFORE_THE_GUARD);
          return guard === -1 || (other !== -1 && other < guard);
        }),
      )
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("returns the guard's response unchanged", () => {
    const offenders = files
      .filter((f) => !f.src.includes("if (denied) return denied;"))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("uses no other authentication", () => {
    const offenders = files
      .filter((f) => OTHER_AUTH.test(f.src))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

describe("requireControlPlane", () => {
  it("never consults CRON_SECRET, the cron helper or cookies", () => {
    const src = readCode(CONTROL_PLANE_AUTH);
    expect(src).not.toMatch(/CRON_SECRET|cron-auth|isValidCronAuth|cookie/i);
  });
});
```

Task 6 already pins that no organization route can write `lockedAt`, `suspendedAt` or `entitlements` (its block in `organizations-id.test.ts`), so this task adds no test there.

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/internal-orgs.test.ts src/app/api/__tests__/internal-routes-guard.test.ts`
Expected: FAIL for `internal-orgs.test.ts` (`Cannot find package '@/app/api/internal/orgs/route'`) and for `internal-routes-guard.test.ts` (`ENOENT ... scandir '.../src/app/api/internal'`).

- [ ] **Step 9: Write the routes, the audit entity and the convention exemption**

```ts
// src/app/api/internal/orgs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { cursorPaginate } from "@/lib/cursor-pagination";
import { logger } from "@/lib/logger";
import { requireControlPlane } from "@/lib/control-plane/auth";
import {
  internalOrgSelect,
  toInternalOrgs,
  type InternalOrgRow,
} from "@/lib/control-plane/internal-org";
import {
  internalFailure,
  validationFailed,
} from "@/lib/control-plane/responses";

const MAX_LIMIT = 100;

const listQuerySchema = z.strictObject({
  createdAfter: z
    .union([z.iso.datetime({ offset: true }), z.iso.date()])
    .optional(),
  cursor: z.guid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

/**
 * Lists organizations for the control plane's reconcile, oldest first.
 * `createdAfter` is inclusive, `cursor` is the id of the last organization of
 * the previous page, and `nextCursor` is null on the last page.
 */
export async function GET(req: Request) {
  const denied = requireControlPlane(req);
  if (denied) return denied;

  try {
    const query = listQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    if (!query.success) return validationFailed(query.error);
    const { createdAfter, cursor, limit = MAX_LIMIT } = query.data;

    const page = await cursorPaginate<InternalOrgRow>(prisma.organization, {
      where: createdAfter
        ? { createdAt: { gte: new Date(createdAfter) } }
        : undefined,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      cursorField: "id",
      limit,
      cursor,
      select: internalOrgSelect,
    });

    return NextResponse.json({
      orgs: await toInternalOrgs(page.items),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    logger.error("Internal organization list failed", { error });
    return internalFailure();
  }
}
```

```ts
// src/app/api/internal/orgs/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { requireControlPlane } from "@/lib/control-plane/auth";
import {
  internalOrgSelect,
  toInternalOrgs,
} from "@/lib/control-plane/internal-org";
import {
  internalFailure,
  invalidOrgId,
  orgNotFound,
} from "@/lib/control-plane/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const denied = requireControlPlane(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!isGuid(id)) return invalidOrgId();

    const row = await prisma.organization.findUnique({
      where: { id },
      select: internalOrgSelect,
    });
    if (!row) return orgNotFound();

    const [org] = await toInternalOrgs([row]);
    return NextResponse.json({ org });
  } catch (error) {
    logger.error("Internal organization read failed", { error });
    return internalFailure();
  }
}
```

```ts
// src/app/api/internal/orgs/[id]/entitlements/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  entitlementsSchema,
  featuresInOrder,
  type Entitlements,
} from "@/lib/entitlements-shared";
import { requireControlPlane } from "@/lib/control-plane/auth";
import {
  internalOrgSelect,
  toInternalOrgs,
} from "@/lib/control-plane/internal-org";
import {
  internalFailure,
  invalidOrgId,
  orgNotFound,
  readJsonBody,
  validationFailed,
} from "@/lib/control-plane/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Replaces an organization's stored entitlements. The body is strict (unknown
 * keys and unknown features are a 400); readers stay lenient. Last writer
 * wins: the control plane serialises its writes per organization.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const denied = requireControlPlane(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!isGuid(id)) return invalidOrgId();

    const body = await readJsonBody(req);
    if (body.ok === false) return body.response;
    const parsed = entitlementsSchema.safeParse(body.data);
    if (!parsed.success) return validationFailed(parsed.error);

    const before = await prisma.organization.findUnique({
      where: { id },
      select: internalOrgSelect,
    });
    if (!before) return orgNotFound();

    // Stored in canonical form: no duplicates, features in GATED_FEATURES order.
    const entitlements: Entitlements = {
      ...parsed.data,
      features: featuresInOrder(parsed.data.features),
    };
    const updated = await prisma.organization.update({
      where: { id },
      data: { entitlements },
      select: internalOrgSelect,
    });

    await createAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ORGANIZATION,
      entityId: id,
      details: {
        actor: "control-plane",
        before: { entitlements: before.entitlements ?? null },
        after: { entitlements },
      },
    });

    const [org] = await toInternalOrgs([updated]);
    return NextResponse.json({ org });
  } catch (error) {
    logger.error("Internal entitlements update failed", { error });
    return internalFailure();
  }
}
```

```ts
// src/app/api/internal/orgs/[id]/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { requireControlPlane } from "@/lib/control-plane/auth";
import {
  internalOrgSelect,
  statusSnapshot,
  toInternalOrgs,
} from "@/lib/control-plane/internal-org";
import {
  internalFailure,
  invalidOrgId,
  orgNotFound,
  readJsonBody,
  validationFailed,
} from "@/lib/control-plane/responses";
import {
  statusActionPatch,
  statusActionSchema,
} from "@/lib/control-plane/status-actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Applies a status transition (suspend, lock, reactivate) to the current
 * state and answers with the resulting organization. A transition that
 * changes nothing writes nothing but is still audited.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const denied = requireControlPlane(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!isGuid(id)) return invalidOrgId();

    const body = await readJsonBody(req);
    if (body.ok === false) return body.response;
    const parsed = statusActionSchema.safeParse(body.data);
    if (!parsed.success) return validationFailed(parsed.error);
    const { action } = parsed.data;

    const before = await prisma.organization.findUnique({
      where: { id },
      select: internalOrgSelect,
    });
    if (!before) return orgNotFound();

    const patch = statusActionPatch(before, action, new Date());
    const updated =
      Object.keys(patch).length === 0
        ? before
        : await prisma.organization.update({
            where: { id },
            data: patch,
            select: internalOrgSelect,
          });

    await createAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ORGANIZATION,
      entityId: id,
      details: {
        actor: "control-plane",
        action,
        before: statusSnapshot(before),
        after: statusSnapshot(updated),
      },
    });

    const [org] = await toInternalOrgs([updated]);
    return NextResponse.json({ org });
  } catch (error) {
    logger.error("Internal status change failed", { error });
    return internalFailure();
  }
}
```

In `src/lib/audit-log.ts`, add one entry to `AUDIT_ENTITIES`, directly after the `INTUNE_SYNC` line. Before:

```ts
  INTUNE_SYNC: "intune_sync",
```

After:

```ts
  INTUNE_SYNC: "intune_sync",
  // Capitalised on purpose: it is the spelling existing audit rows already use.
  ORGANIZATION: "Organization",
```

The tenant audit viewer's `ENTITY_OPTIONS` (a client component that mirrors this list) is deliberately left alone: control-plane entries have no user, so the viewer, which filters by the user's organization, never shows them.

In `src/app/api/__tests__/route-conventions.test.ts`, add the two mutating internal routes to `WRITE_GUARD_EXEMPT`: a locked or read-only organization must stay changeable by the control plane, and these handlers authenticate with the control-plane secret instead of a user. Insert the two lines directly after the `"team/invite/[token]/route.ts",` entry. Before:

```ts
  "team/invite/[token]/route.ts",
```

After:

```ts
  "team/invite/[token]/route.ts",
  "internal/orgs/[id]/entitlements/route.ts",
  "internal/orgs/[id]/status/route.ts",
```

The two GET routes need no exemption (they are not mutating), and none of the four files uses a `THROWING_GUARDS` guard, so the "maps guard errors through apiErrorResponse" convention does not apply to them. Later tasks that add exemptions (Task 15 adds `billing/handoff/route.ts`) append after these two lines.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/__tests__/internal-orgs.test.ts src/app/api/__tests__/internal-routes-guard.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

- [ ] **Step 11: Type-check, lint and run the whole suite**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/app/api/internal src/lib/audit-log.ts src/app/api/__tests__/internal-orgs.test.ts src/app/api/__tests__/internal-routes-guard.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: no output.

Run: `npx vitest run`
Expected: PASS (this task changes `audit-log.ts` and the convention test, which other tests share).

- [ ] **Step 12: Commit**

```bash
git add src/app/api/internal src/lib/audit-log.ts src/app/api/__tests__/internal-orgs.test.ts src/app/api/__tests__/internal-routes-guard.test.ts src/app/api/__tests__/route-conventions.test.ts
git commit -m "feat: add the internal organization API for the control plane" -m "Bearer-authenticated list, read, entitlements and status routes under /api/internal/orgs." -m "Answers 404 outside cloud mode; CRON_SECRET and session cookies never authenticate."
```
