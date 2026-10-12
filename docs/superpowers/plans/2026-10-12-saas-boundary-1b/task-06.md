### Task 6: Entitlements core, control-plane lock and the route guard

This task has two commits. Part A adds the pure resolution, the org access loader and the `lockedAt` precedence (nothing outside the new modules reads them yet). Part B loads the access with the user, replaces `requirePlanFeature` with `requireFeature` and removes the legacy plan module.

**Files:**

- Create: `src/lib/entitlements.ts`
- Create: `src/lib/org-access.ts`
- Modify: `src/lib/entitlements-shared.ts` (add `allowsFeature`)
- Modify: `src/lib/org-suspension.ts` (`lockedAt` field, precedence, select)
- Modify: `src/lib/org-lock-redirect.ts` (select)
- Modify: `src/lib/api-auth.ts` (`AuthUser.entitlements`, both user paths, `requireFeature`)
- Modify: `src/lib/api-keys.ts` (`validateApiKey` org select)
- Modify: `src/lib/__mocks__/api-auth.ts` (`requireFeature` replaces `requirePlanFeature`)
- Modify: `src/app/api/admin/api-keys/route.ts` (POST guard)
- Modify: the 10 procurement route files (13 call sites): `src/app/api/procurement/requests/route.ts`, `requests/[id]/route.ts`, `requests/[id]/submit/route.ts`, `requests/[id]/approve/route.ts`, `requests/[id]/reject/route.ts`, `requests/[id]/generate-po/route.ts`, `orders/route.ts`, `orders/[id]/route.ts`, `orders/[id]/pdf/route.ts`, `orders/[id]/receive/route.ts`
- Modify: `src/app/api/billing/usage/route.ts` (import from `plan-features-shared`)
- Modify: `src/app/api/__tests__/route-conventions.test.ts` (`THROWING_GUARDS`)
- Delete: `src/lib/plan-features.ts` (its only importers are `api-auth.ts` and `billing/usage/route.ts`)
- Test (create): `src/lib/__tests__/entitlements.test.ts`, `src/lib/__tests__/org-access.test.ts`, `src/lib/__tests__/api-keys.test.ts`, `src/lib/__tests__/org-status-selects.test.ts`, `src/app/api/__tests__/entitlement-gates.test.ts`, `src/app/api/__tests__/procurement-feature-gate.test.ts`
- Test (update): `src/lib/__tests__/entitlements-shared.test.ts`, `org-suspension.test.ts`, `org-lock-redirect.test.ts`, `api-auth.test.ts`, `src/app/api/__tests__/organizations-id.test.ts`, `settings-sso.test.ts`, `settings-platform-routes.test.ts`
- Not edited (verified, see Step 10): `workflow-engine.test.ts`, `scim-users.test.ts` keep their `org-suspension` mocks because `getOrgSuspensionStatus` keeps its signature.

**Interfaces:**

- Consumes: `isCloudMode` (Task 2, `src/lib/deployment-mode.ts`); `stubCloudMode`, `TEST_NEW_ORG_ENTITLEMENTS` (Task 2, `tests/setup/cloud-mode.ts`); `parseNewOrgEntitlements` (Task 4, `src/lib/control-plane/config.ts`; it throws an `Error` whose message names `NEW_ORG_ENTITLEMENTS`); `EntitlementError` (Task 1, `src/lib/errors.ts`; `new EntitlementError(feature)`); `UNRESTRICTED`, `featuresInOrder`, `entitlementsSchema`, `GATED_FEATURES` (phase 1a).
- Produces in `entitlements-shared.ts`: `allowsFeature(entitlements: Entitlements, feature: GatedFeature): boolean`.
- Produces in `src/lib/entitlements.ts`:
  - `parseStoredEntitlements(value: unknown): { entitlements: Entitlements; droppedFeatures: string[] } | null` (lenient: unknown feature strings dropped and reported, unknown keys ignored; `null` for SQL/JSON null, `undefined` or an invalid shape)
  - `resolveEntitlements(stored: unknown, context: { orgId: string | null }): Entitlements`
  - `getEffectiveEntitlements(orgId: string | null): Promise<Entitlements>` (not cloud: unrestricted without a query)
  - `hasFeature(orgId: string | null, feature: GatedFeature): Promise<boolean>`
  - `requireEntitlement(orgId: string | null, feature: GatedFeature): Promise<void>` (throws `EntitlementError`)
- Produces in `src/lib/org-access.ts`:
  - `orgAccessSelect = { isActive: true, suspendedAt: true, lockedAt: true, entitlements: true } satisfies Prisma.OrganizationSelect`
  - `interface OrgAccess { status: OrgStatus; entitlements: Entitlements }`
  - `resolveOrgAccess(org: (OrgSuspensionFields & { entitlements?: unknown }) | null, orgId: string | null): OrgAccess` (`OrgSuspensionFields` = `{ isActive: boolean; suspendedAt: Date | null; lockedAt?: Date | null }`)
  - `getOrgAccess(orgId: string | null): Promise<OrgAccess>`
  - `type OrgAccessCache = Map<string, Promise<OrgAccess>>`; `getCachedOrgAccess(orgId: string, cache: OrgAccessCache): Promise<OrgAccess>`
- Modifies `org-suspension.ts`: `OrgSuspensionFields.lockedAt?: Date | null`; `getOrgStatus` returns `locked_out` first when `lockedAt` is set; `getOrgSuspensionStatus` selects `lockedAt`.
- Modifies `api-auth.ts`: `AuthUser.entitlements?: Entitlements` (optional, so the 26 hand-built fixtures keep compiling); both user paths select `orgAccessSelect` and set `orgStatus` and `entitlements` from `resolveOrgAccess`; still one user query. Produces `requireFeature(user: AuthUser, feature: GatedFeature): Promise<void>`; `requirePlanFeature` is gone.
- `THROWING_GUARDS` after this task: `requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requireFeature|requireEntitlement|requireApiCanRequest|getAuthUser`.

---

#### Part A: resolution, org access and the lock precedence

- [ ] **Step 1: Check what the earlier tasks left behind**

Run:

```bash
ls src/lib/entitlements-shared.ts src/lib/control-plane/config.ts tests/setup/cloud-mode.ts
grep -n "export function isCloudMode" src/lib/deployment-mode.ts
grep -n "export function parseNewOrgEntitlements" src/lib/control-plane/config.ts
grep -n "export class EntitlementError" src/lib/errors.ts
grep -n "lockedAt" prisma/schema.prisma
```

Expected: every file is listed and every `grep` prints one line. If one is missing, stop: Tasks 1 to 4 and phase 1a must be done first. Also run `npx prisma generate` once so the client knows `lockedAt` and `entitlements` (it only generates the client; it never touches a database).

- [ ] **Step 2: Write the failing tests for `allowsFeature`**

In `src/lib/__tests__/entitlements-shared.test.ts`, add `allowsFeature` to the existing import and append a describe block.

Before (the import from phase 1a):

```ts
import {
  GATED_FEATURES,
  UNRESTRICTED,
  entitlementsSchema,
  featuresInOrder,
  isOverLimit,
} from "@/lib/entitlements-shared";
```

After:

```ts
import {
  GATED_FEATURES,
  UNRESTRICTED,
  allowsFeature,
  entitlementsSchema,
  featuresInOrder,
  isOverLimit,
} from "@/lib/entitlements-shared";
```

Append at the end of the file:

```ts
describe("allowsFeature", () => {
  const entitlements = {
    features: ["api_keys", "scim"],
    maxAssets: null,
    maxUsers: null,
  } satisfies Parameters<typeof allowsFeature>[0];

  it("is true only for listed features", () => {
    expect(allowsFeature(entitlements, "scim")).toBe(true);
    expect(allowsFeature(entitlements, "procurement")).toBe(false);
  });

  it("is false for every feature when none is listed", () => {
    const none = { features: [], maxAssets: 0, maxUsers: 0 };
    for (const feature of GATED_FEATURES) {
      expect(allowsFeature(none, feature)).toBe(false);
    }
  });

  it("is true for every feature of UNRESTRICTED", () => {
    for (const feature of GATED_FEATURES) {
      expect(allowsFeature(UNRESTRICTED, feature)).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Write the failing resolution tests**

```ts
// src/lib/__tests__/entitlements.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stubCloudMode,
  TEST_NEW_ORG_ENTITLEMENTS,
} from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { EntitlementError, ForbiddenError } from "@/lib/errors";
import { UNRESTRICTED } from "@/lib/entitlements-shared";
import {
  getEffectiveEntitlements,
  hasFeature,
  parseStoredEntitlements,
  requireEntitlement,
  resolveEntitlements,
} from "@/lib/entitlements";

const mockPrisma = vi.mocked(prisma, true);

const PRO = {
  features: ["api_keys", "procurement"],
  maxAssets: 5000,
  maxUsers: 25,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue(null as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseStoredEntitlements", () => {
  it("accepts a valid value untouched", () => {
    expect(parseStoredEntitlements(PRO)).toEqual({
      entitlements: PRO,
      droppedFeatures: [],
    });
  });

  it("drops unknown features, reports them and keeps the rest in canonical order", () => {
    expect(
      parseStoredEntitlements({
        features: ["procurement", "white_label", "api_keys", "sso", "api_keys"],
        maxAssets: null,
        maxUsers: 3,
      }),
    ).toEqual({
      entitlements: {
        features: ["api_keys", "procurement"],
        maxAssets: null,
        maxUsers: 3,
      },
      droppedFeatures: ["white_label", "sso"],
    });
  });

  it("ignores unknown keys instead of rejecting the value", () => {
    expect(
      parseStoredEntitlements({ ...PRO, plan: "professional" })?.entitlements,
    ).toEqual(PRO);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "professional"],
    ["an array", []],
    [
      "features that are not a list",
      { features: "api_keys", maxAssets: null, maxUsers: null },
    ],
    [
      "a feature that is not a string",
      { features: [1], maxAssets: null, maxUsers: null },
    ],
    ["a negative limit", { features: [], maxAssets: -1, maxUsers: null }],
    ["a fractional limit", { features: [], maxAssets: 1.5, maxUsers: null }],
    ["a missing limit", { features: [], maxUsers: null }],
    ["a missing feature list", { maxAssets: null, maxUsers: null }],
  ])("returns null for %s", (_label, value) => {
    expect(parseStoredEntitlements(value)).toBeNull();
  });
});

describe("resolveEntitlements outside cloud mode", () => {
  it("ignores restrictive stored values", () => {
    expect(
      resolveEntitlements(
        { features: [], maxAssets: 0, maxUsers: 0 },
        { orgId: "org-1" },
      ),
    ).toEqual(UNRESTRICTED);
  });

  it("ignores invalid stored values without logging", () => {
    expect(resolveEntitlements("garbage", { orgId: "org-1" })).toEqual(
      UNRESTRICTED,
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("is unrestricted without an organization", () => {
    expect(resolveEntitlements(null, { orgId: null })).toEqual(UNRESTRICTED);
  });

  it("hands out a copy, never the shared constant", () => {
    const result = resolveEntitlements(null, { orgId: null });

    expect(result).not.toBe(UNRESTRICTED);
    expect(result.features).not.toBe(UNRESTRICTED.features);
  });
});

describe("resolveEntitlements in cloud mode", () => {
  beforeEach(() => {
    stubCloudMode();
  });

  it("returns a valid stored value", () => {
    expect(resolveEntitlements(PRO, { orgId: "org-1" })).toEqual(PRO);
  });

  it("filters unknown stored features and logs them with the org id", () => {
    const result = resolveEntitlements(
      { features: ["white_label", "scim"], maxAssets: 5, maxUsers: 2 },
      { orgId: "org-1" },
    );

    expect(result).toEqual({ features: ["scim"], maxAssets: 5, maxUsers: 2 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown features"),
      expect.objectContaining({
        organizationId: "org-1",
        features: ["white_label"],
      }),
    );
  });

  it("uses the new-organization entitlements for a stored NULL (SQL NULL and JSON null both read as null)", () => {
    expect(resolveEntitlements(null, { orgId: "org-1" })).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("uses the new-organization entitlements when the field was not selected", () => {
    expect(resolveEntitlements(undefined, { orgId: "org-1" })).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
  });

  it("uses the new-organization entitlements for an invalid shape and logs an error with the org id", () => {
    const result = resolveEntitlements(
      { features: "everything", maxAssets: null, maxUsers: null },
      { orgId: "org-1" },
    );

    expect(result).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("invalid"),
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("gives a caller without an organization the new-organization entitlements, whatever else is passed", () => {
    expect(resolveEntitlements(null, { orgId: null })).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
    expect(resolveEntitlements(PRO, { orgId: null })).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
  });

  it("reads NEW_ORG_ENTITLEMENTS on every use", () => {
    const first = { features: ["api_keys"], maxAssets: 1, maxUsers: 1 };
    vi.stubEnv("NEW_ORG_ENTITLEMENTS", JSON.stringify(first));
    expect(resolveEntitlements(null, { orgId: "org-1" })).toEqual(first);

    vi.stubEnv(
      "NEW_ORG_ENTITLEMENTS",
      JSON.stringify(TEST_NEW_ORG_ENTITLEMENTS),
    );
    expect(resolveEntitlements(null, { orgId: "org-1" })).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
  });

  it.each([
    ["missing", ""],
    ["not JSON", "{nope"],
    [
      "not a valid value",
      JSON.stringify({
        features: ["white_label"],
        maxAssets: null,
        maxUsers: null,
      }),
    ],
  ])(
    "throws when NEW_ORG_ENTITLEMENTS is %s and it is needed",
    (_label, raw) => {
      vi.stubEnv("NEW_ORG_ENTITLEMENTS", raw);

      expect(() => resolveEntitlements(null, { orgId: "org-1" })).toThrow(
        /NEW_ORG_ENTITLEMENTS/,
      );
      expect(() => resolveEntitlements(null, { orgId: null })).toThrow(
        /NEW_ORG_ENTITLEMENTS/,
      );
    },
  );

  it("does not read NEW_ORG_ENTITLEMENTS when a valid value is stored", () => {
    vi.stubEnv("NEW_ORG_ENTITLEMENTS", "");

    expect(resolveEntitlements(PRO, { orgId: "org-1" })).toEqual(PRO);
  });
});

describe("getEffectiveEntitlements", () => {
  it("is unrestricted outside cloud mode and never queries", async () => {
    expect(await getEffectiveEntitlements("org-1")).toEqual(UNRESTRICTED);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it.each([null, ""])(
    "gives %j the new-organization entitlements in cloud mode without a query",
    async (orgId) => {
      stubCloudMode();

      expect(await getEffectiveEntitlements(orgId)).toEqual(
        TEST_NEW_ORG_ENTITLEMENTS,
      );
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    },
  );

  it("reads only the entitlements column by primary key in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: PRO,
    } as never);

    expect(await getEffectiveEntitlements("org-1")).toEqual(PRO);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { entitlements: true },
    });
  });

  it("falls back to the new-organization entitlements for a missing row", async () => {
    stubCloudMode();

    expect(await getEffectiveEntitlements("org-gone")).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
  });
});

describe("hasFeature and requireEntitlement", () => {
  it("reports granted and missing features in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: PRO,
    } as never);

    expect(await hasFeature("org-1", "procurement")).toBe(true);
    expect(await hasFeature("org-1", "scim")).toBe(false);
  });

  it("allows everything outside cloud mode, even for stale restrictive data", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: { features: [], maxAssets: 0, maxUsers: 0 },
    } as never);

    expect(await hasFeature("org-1", "scim")).toBe(true);
    await expect(requireEntitlement("org-1", "scim")).resolves.toBeUndefined();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("resolves for a granted feature", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: PRO,
    } as never);

    await expect(
      requireEntitlement("org-1", "api_keys"),
    ).resolves.toBeUndefined();
  });

  it("rejects with an EntitlementError for a missing feature", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: PRO,
    } as never);

    const error = await requireEntitlement("org-1", "scim").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(EntitlementError);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({
      code: "feature_not_entitled",
      feature: "scim",
      statusCode: 403,
    });
  });

  it("uses a neutral denial message that names neither a plan nor a price", async () => {
    stubCloudMode();

    const error = await requireEntitlement("org-1", "scim").catch(
      (caught: unknown) => caught,
    );

    expect((error as Error).message).toBe(
      "Forbidden: This feature is not available for your organization",
    );
    expect((error as Error).message).not.toMatch(/plan|price|upgrade/i);
  });

  it("denies a caller without an organization the features the new-organization value lacks", async () => {
    stubCloudMode();

    await expect(requireEntitlement(null, "api_keys")).rejects.toBeInstanceOf(
      EntitlementError,
    );
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
```

```ts
// src/lib/__tests__/org-access.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stubCloudMode,
  TEST_NEW_ORG_ENTITLEMENTS,
} from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { UNRESTRICTED } from "@/lib/entitlements-shared";
import {
  getCachedOrgAccess,
  getOrgAccess,
  orgAccessSelect,
  resolveOrgAccess,
  type OrgAccessCache,
} from "@/lib/org-access";

const mockPrisma = vi.mocked(prisma, true);

const DAY_MS = 24 * 60 * 60 * 1000;
const STORED = { features: ["api_keys", "scim"], maxAssets: 50, maxUsers: 5 };
const activeOrg = {
  isActive: true,
  suspendedAt: null,
  lockedAt: null,
  entitlements: STORED,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue(null as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("orgAccessSelect", () => {
  it("selects the status columns and the entitlements, nothing else", () => {
    expect(orgAccessSelect).toEqual({
      isActive: true,
      suspendedAt: true,
      lockedAt: true,
      entitlements: true,
    });
  });
});

describe("resolveOrgAccess outside cloud mode", () => {
  it("is active and unrestricted whatever the row holds (stale SaaS data)", () => {
    const access = resolveOrgAccess(
      {
        isActive: false,
        suspendedAt: new Date(Date.now() - 30 * DAY_MS),
        lockedAt: new Date(),
        entitlements: { features: [], maxAssets: 0, maxUsers: 0 },
      },
      "org-1",
    );

    expect(access).toEqual({ status: "active", entitlements: UNRESTRICTED });
  });

  it("is active and unrestricted without an organization", () => {
    expect(resolveOrgAccess(null, null)).toEqual({
      status: "active",
      entitlements: UNRESTRICTED,
    });
  });
});

describe("resolveOrgAccess in cloud mode", () => {
  beforeEach(() => {
    stubCloudMode();
  });

  it("combines the derived status with the stored entitlements", () => {
    expect(resolveOrgAccess(activeOrg, "org-1")).toEqual({
      status: "active",
      entitlements: STORED,
    });
  });

  it("locks out an otherwise active org that has lockedAt, and keeps its entitlements", () => {
    expect(
      resolveOrgAccess({ ...activeOrg, lockedAt: new Date() }, "org-1"),
    ).toEqual({ status: "locked_out", entitlements: STORED });
  });

  it("is read-only inside the suspension grace period", () => {
    expect(
      resolveOrgAccess(
        { ...activeOrg, suspendedAt: new Date(Date.now() - 2 * DAY_MS) },
        "org-1",
      ).status,
    ).toBe("read_only");
  });

  it("falls back to the new-organization entitlements when none are stored", () => {
    expect(
      resolveOrgAccess({ ...activeOrg, entitlements: null }, "org-1")
        .entitlements,
    ).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("falls back and logs for an invalid stored value without touching the status", () => {
    const access = resolveOrgAccess(
      { ...activeOrg, entitlements: "garbage" },
      "org-1",
    );

    expect(access).toEqual({
      status: "active",
      entitlements: TEST_NEW_ORG_ENTITLEMENTS,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("gives a caller without an organization an active status and the new-organization entitlements", () => {
    expect(resolveOrgAccess(null, null)).toEqual({
      status: "active",
      entitlements: TEST_NEW_ORG_ENTITLEMENTS,
    });
  });
});

describe("getOrgAccess", () => {
  it("is active and unrestricted outside cloud mode and never queries", async () => {
    expect(await getOrgAccess("org-1")).toEqual({
      status: "active",
      entitlements: UNRESTRICTED,
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("does not query without an organization id in cloud mode", async () => {
    stubCloudMode();

    expect(await getOrgAccess(null)).toEqual({
      status: "active",
      entitlements: TEST_NEW_ORG_ENTITLEMENTS,
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("reads the status and entitlement columns in one query by primary key", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue(activeOrg as never);

    expect(await getOrgAccess("org-1")).toEqual({
      status: "active",
      entitlements: STORED,
    });
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: orgAccessSelect,
    });
  });

  it("treats a missing row as active with the new-organization entitlements", async () => {
    stubCloudMode();

    expect(await getOrgAccess("org-gone")).toEqual({
      status: "active",
      entitlements: TEST_NEW_ORG_ENTITLEMENTS,
    });
  });
});

describe("getCachedOrgAccess", () => {
  beforeEach(() => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue(activeOrg as never);
  });

  it("reads an organization once per cache, even for concurrent callers", async () => {
    const cache: OrgAccessCache = new Map();

    const [first, second] = await Promise.all([
      getCachedOrgAccess("org-1", cache),
      getCachedOrgAccess("org-1", cache),
    ]);
    const third = await getCachedOrgAccess("org-1", cache);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(1);
  });

  it("keeps organizations apart", async () => {
    const cache: OrgAccessCache = new Map();

    await getCachedOrgAccess("org-1", cache);
    await getCachedOrgAccess("org-2", cache);

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(2);
  });

  it("starts fresh with a new cache", async () => {
    await getCachedOrgAccess("org-1", new Map());
    await getCachedOrgAccess("org-1", new Map());

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed read", async () => {
    mockPrisma.organization.findUnique
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(activeOrg as never);
    const cache: OrgAccessCache = new Map();

    await expect(getCachedOrgAccess("org-1", cache)).rejects.toThrow("db down");
    expect(cache.has("org-1")).toBe(false);

    const access = await getCachedOrgAccess("org-1", cache);

    expect(access.status).toBe("active");
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4: Write the failing `lockedAt` tests for the status modules**

Append to `src/lib/__tests__/org-suspension.test.ts`. After Task 2 this file mocks `@/lib/deployment-mode` with an `isCloudMode` mock and its `beforeEach` enables cloud mode; the helper below reaches the same mock by dynamic import, so it does not depend on the local variable names Task 2 chose. `NOW`, `DAY_MS` and `mockPrisma` already exist in the file.

```ts
describe("lockedAt (control-plane lock)", () => {
  async function setCloudMode(enabled: boolean): Promise<void> {
    const { isCloudMode } = await import("@/lib/deployment-mode");
    vi.mocked(isCloudMode).mockReturnValue(enabled);
  }

  beforeEach(async () => {
    await setCloudMode(true);
  });

  it("locks out an otherwise active org", () => {
    expect(
      getOrgStatus({ isActive: true, suspendedAt: null, lockedAt: NOW }),
    ).toBe("locked_out");
  });

  it("beats a fresh suspension that would only be read-only", () => {
    expect(
      getOrgStatus({
        isActive: true,
        suspendedAt: new Date(NOW.getTime() - 2 * DAY_MS),
        lockedAt: NOW,
      }),
    ).toBe("locked_out");
  });

  it("falls through to the existing rules when lockedAt is null or missing", () => {
    expect(
      getOrgStatus({ isActive: true, suspendedAt: null, lockedAt: null }),
    ).toBe("active");
    expect(getOrgStatus({ isActive: true, suspendedAt: null })).toBe("active");
    expect(
      getOrgStatus({
        isActive: true,
        suspendedAt: new Date(NOW.getTime() - 2 * DAY_MS),
        lockedAt: null,
      }),
    ).toBe("read_only");
  });

  it("applies through resolveOrgStatus in cloud mode", () => {
    expect(
      resolveOrgStatus({ isActive: true, suspendedAt: null, lockedAt: NOW }),
    ).toBe("locked_out");
  });

  it("is ignored by resolveOrgStatus outside cloud mode", async () => {
    await setCloudMode(false);

    expect(
      resolveOrgStatus({ isActive: true, suspendedAt: null, lockedAt: NOW }),
    ).toBe("active");
  });

  it("is selected and applied by getOrgSuspensionStatus", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: true,
      suspendedAt: null,
      lockedAt: NOW,
    } as never);

    expect(await getOrgSuspensionStatus("org-1")).toBe("locked_out");
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { isActive: true, suspendedAt: true, lockedAt: true },
    });
  });

  it("is ignored by getOrgSuspensionStatus outside cloud mode, without a query", async () => {
    await setCloudMode(false);
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: true,
      suspendedAt: null,
      lockedAt: NOW,
    } as never);

    expect(await getOrgSuspensionStatus("org-1")).toBe("active");
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
```

In `src/lib/__tests__/org-lock-redirect.test.ts`, change the select assertion of "reads the org with a single user lookup keyed by the session user".

Before:

```ts
      select: {
        organization: { select: { isActive: true, suspendedAt: true } },
      },
```

After:

```ts
      select: {
        organization: {
          select: { isActive: true, suspendedAt: true, lockedAt: true },
        },
      },
```

Append at the end of the same file (a top-level block with its own setup, so it holds whichever way Task 2 prepared the mode in the earlier blocks):

```ts
describe("getLockedRedirect with the control-plane lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.api.getSession.mockResolvedValue({
      user: { id: "user-1" },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects an org locked by the control plane to /suspended", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "x".repeat(48));
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: {
        isActive: true,
        suspendedAt: null,
        lockedAt: new Date(),
      },
    } as never);

    const url = await getLockedRedirect(pageRequest("/assets"));

    expect(url?.pathname).toBe("/suspended");
  });

  it("ignores a stale lockedAt when no control plane is configured and skips the lookups", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: {
        isActive: true,
        suspendedAt: null,
        lockedAt: new Date(),
      },
    } as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
    expect(mockAuth.api.getSession).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
```

The lock must also stay out of tenants' reach. This characterization test passes already (the route copies an explicit whitelist into `update`); it pins that no request body, from an org admin or a super-admin, can write the control-plane columns. Append to `src/app/api/__tests__/organizations-id.test.ts`, which already defines `orgAdmin`, `superAdmin`, `params` and the mocks:

```ts
describe("PUT /api/organizations/[id] and the control-plane columns", () => {
  const forged = {
    name: "Acme",
    lockedAt: null,
    suspendedAt: null,
    entitlements: { features: ["scim"], maxAssets: null, maxUsers: null },
  };

  it.each([
    ["an org admin", false],
    ["a super-admin", true],
  ])(
    "never lets %s write lockedAt, suspendedAt or entitlements",
    async (_label, asSuperAdmin) => {
      if (asSuperAdmin) {
        vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as never);
        vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as never);
      }

      await PUT(
        createMockRequest("/api/organizations/org-uuid-001", {
          method: "PUT",
          body: forged,
        }),
        params,
      );

      const data = mockPrisma.organization.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("lockedAt");
      expect(data).not.toHaveProperty("suspendedAt");
      expect(data).not.toHaveProperty("entitlements");
    },
  );
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/entitlements.test.ts src/lib/__tests__/org-access.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts
```

Expected: FAIL. `entitlements-shared.test.ts` fails on `allowsFeature is not a function`; `entitlements.test.ts` and `org-access.test.ts` fail to load (`@/lib/entitlements` and `@/lib/org-access` do not exist); the new `lockedAt` cases in `org-suspension.test.ts` return `active` instead of `locked_out`; the select assertion and the redirect case in `org-lock-redirect.test.ts` fail. (The `organizations-id.test.ts` addition pins existing behaviour and passes from the start.)

- [ ] **Step 6: Add `allowsFeature`**

In `src/lib/entitlements-shared.ts`, insert before the `featuresInOrder` doc comment.

Before:

```ts
/** Deduplicated features in GATED_FEATURES order, for stable stored values. */
```

After:

```ts
/** Whether the entitlements include a gated feature. */
export function allowsFeature(
  entitlements: Entitlements,
  feature: GatedFeature,
): boolean {
  return entitlements.features.includes(feature);
}

/** Deduplicated features in GATED_FEATURES order, for stable stored values. */
```

- [ ] **Step 7: Write `src/lib/entitlements.ts`**

```ts
// src/lib/entitlements.ts
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isCloudMode } from "@/lib/deployment-mode";
import { parseNewOrgEntitlements } from "@/lib/control-plane/config";
import { EntitlementError } from "@/lib/errors";
import {
  GATED_FEATURES,
  UNRESTRICTED,
  allowsFeature,
  entitlementsSchema,
  featuresInOrder,
  type Entitlements,
  type GatedFeature,
} from "@/lib/entitlements-shared";

/**
 * Server-side entitlement resolution. Imports the database client, so client
 * code uses entitlements-shared.ts instead (the repo's `*-shared.ts` plus
 * server module convention; the `server-only` package is not installed).
 *
 * Outside cloud mode every function answers "unrestricted" and never reads the
 * stored value, so SaaS data restored into a self-hosted database cannot
 * restrict it. In cloud mode the stored value wins; NULL, an invalid value and
 * a caller without an organization all get NEW_ORG_ENTITLEMENTS.
 */

const KNOWN_FEATURES: ReadonlySet<string> = new Set(GATED_FEATURES);

/**
 * The lenient read shape: feature names may be unknown (dropped below) and
 * unknown keys are ignored. The limits reuse the strict write schema.
 */
const storedEntitlementsSchema = z.object({
  features: z.array(z.string()),
  maxAssets: entitlementsSchema.shape.maxAssets,
  maxUsers: entitlementsSchema.shape.maxUsers,
});

export interface ParsedStoredEntitlements {
  entitlements: Entitlements;
  droppedFeatures: string[];
}

function isGatedFeature(value: string): value is GatedFeature {
  return KNOWN_FEATURES.has(value);
}

/** A fresh copy, so no caller can mutate the shared constant. */
function unrestricted(): Entitlements {
  return { ...UNRESTRICTED, features: [...UNRESTRICTED.features] };
}

/**
 * Read a stored value leniently: unknown features are dropped and reported,
 * everything else must match the strict shape. Returns null for SQL NULL, JSON
 * null, undefined or an invalid shape.
 */
export function parseStoredEntitlements(
  value: unknown,
): ParsedStoredEntitlements | null {
  const parsed = storedEntitlementsSchema.safeParse(value);
  if (!parsed.success) return null;

  const { features, maxAssets, maxUsers } = parsed.data;
  return {
    entitlements: {
      features: featuresInOrder(features.filter(isGatedFeature)),
      maxAssets,
      maxUsers,
    },
    droppedFeatures: [...new Set(features.filter((f) => !isGatedFeature(f)))],
  };
}

/**
 * Resolve the effective entitlements from a stored value (spec section 2).
 * Throws in cloud mode when the new-organization value is needed but
 * NEW_ORG_ENTITLEMENTS is missing or invalid; startup validation rejects such
 * an environment first.
 */
export function resolveEntitlements(
  stored: unknown,
  context: { orgId: string | null },
): Entitlements {
  if (!isCloudMode()) return unrestricted();

  if (context.orgId === null || stored === null || stored === undefined) {
    return parseNewOrgEntitlements();
  }

  const parsed = parseStoredEntitlements(stored);
  if (!parsed) {
    logger.error(
      "Stored entitlements are invalid; using the new-organization entitlements",
      { organizationId: context.orgId },
    );
    return parseNewOrgEntitlements();
  }

  if (parsed.droppedFeatures.length > 0) {
    logger.warn("Stored entitlements name unknown features; ignoring them", {
      organizationId: context.orgId,
      features: parsed.droppedFeatures,
    });
  }
  return parsed.entitlements;
}

/**
 * Entitlements by organization id, for callers without a loaded user (SCIM,
 * crons, syncs, server pages). One primary-key read in cloud mode, none
 * otherwise. Routes that hold an AuthUser use user.entitlements instead.
 */
export async function getEffectiveEntitlements(
  orgId: string | null,
): Promise<Entitlements> {
  if (!isCloudMode() || !orgId) {
    return resolveEntitlements(undefined, { orgId: orgId || null });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { entitlements: true },
  });
  return resolveEntitlements(org?.entitlements, { orgId });
}

export async function hasFeature(
  orgId: string | null,
  feature: GatedFeature,
): Promise<boolean> {
  return allowsFeature(await getEffectiveEntitlements(orgId), feature);
}

/** Throws EntitlementError (403, feature_not_entitled) when the feature is missing. */
export async function requireEntitlement(
  orgId: string | null,
  feature: GatedFeature,
): Promise<void> {
  if (!(await hasFeature(orgId, feature))) {
    throw new EntitlementError(feature);
  }
}
```

- [ ] **Step 8: Add the `lockedAt` precedence and selects**

In `src/lib/org-suspension.ts`:

Before:

```ts
export interface OrgSuspensionFields {
  isActive: boolean;
  suspendedAt: Date | null;
}

/**
 * Precedence: an inactive org is locked out first; a suspension is read-only
 * for 14 days and locked out afterwards.
 */
export function getOrgStatus(org: OrgSuspensionFields): OrgStatus {
  if (!org.isActive) return "locked_out";
```

After:

```ts
export interface OrgSuspensionFields {
  isActive: boolean;
  suspendedAt: Date | null;
  /** Control-plane lock, written only by the internal API. Optional so older row shapes still type-check. */
  lockedAt?: Date | null;
}

/**
 * Precedence: a control-plane lock and an inactive org are locked out first; a
 * suspension is read-only for 14 days and locked out afterwards.
 */
export function getOrgStatus(org: OrgSuspensionFields): OrgStatus {
  if (org.lockedAt) return "locked_out";
  if (!org.isActive) return "locked_out";
```

In the same file, in `getOrgSuspensionStatus`:

Before:

```ts
    select: { isActive: true, suspendedAt: true },
```

After:

```ts
    select: { isActive: true, suspendedAt: true, lockedAt: true },
```

In `src/lib/org-lock-redirect.ts`, in `getLockedRedirect`:

Before:

```ts
      select: {
        organization: { select: { isActive: true, suspendedAt: true } },
      },
```

After:

```ts
      select: {
        organization: {
          select: { isActive: true, suspendedAt: true, lockedAt: true },
        },
      },
```

(`resolveOrgStatus` stays as Task 2 left it: outside cloud mode it returns `active` before `getOrgStatus` runs, so a stale `lockedAt` never applies.)

- [ ] **Step 9: Write `src/lib/org-access.ts`**

```ts
// src/lib/org-access.ts
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isCloudMode } from "@/lib/deployment-mode";
import { resolveEntitlements } from "@/lib/entitlements";
import type { Entitlements } from "@/lib/entitlements-shared";
import {
  resolveOrgStatus,
  type OrgStatus,
  type OrgSuspensionFields,
} from "@/lib/org-suspension";

/**
 * Organization status and entitlements from one row. Loaded with the user in
 * the existing organization select (no second query) and by organization id
 * for callers without a user (SCIM, crons, syncs, server pages).
 */

/** The organization columns that decide access. Every select that feeds a status uses this. */
export const orgAccessSelect = {
  isActive: true,
  suspendedAt: true,
  lockedAt: true,
  entitlements: true,
} satisfies Prisma.OrganizationSelect;

export interface OrgAccess {
  status: OrgStatus;
  entitlements: Entitlements;
}

/**
 * Pure: derive access from an organization row loaded with orgAccessSelect.
 * A missing row (or a caller without an organization) is active with the
 * new-organization entitlements; outside cloud mode everything is unrestricted.
 */
export function resolveOrgAccess(
  org: (OrgSuspensionFields & { entitlements?: unknown }) | null,
  orgId: string | null,
): OrgAccess {
  return {
    status: resolveOrgStatus(org),
    entitlements: resolveEntitlements(org?.entitlements, { orgId }),
  };
}

/** One primary-key read in cloud mode, none otherwise. */
export async function getOrgAccess(orgId: string | null): Promise<OrgAccess> {
  if (!isCloudMode() || !orgId) return resolveOrgAccess(null, orgId || null);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: orgAccessSelect,
  });
  return resolveOrgAccess(org, orgId);
}

/** Per-run memo of access reads, keyed by organization id. */
export type OrgAccessCache = Map<string, Promise<OrgAccess>>;

/**
 * getOrgAccess memoised for the duration of one run (cron, sync, workflow
 * pass). Concurrent callers share one read; a failed read is not kept.
 */
export function getCachedOrgAccess(
  orgId: string,
  cache: OrgAccessCache,
): Promise<OrgAccess> {
  const cached = cache.get(orgId);
  if (cached) return cached;

  const pending = getOrgAccess(orgId).catch((error: unknown) => {
    cache.delete(orgId);
    throw error;
  });
  cache.set(orgId, pending);
  return pending;
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/entitlements.test.ts src/lib/__tests__/org-access.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/app/api/__tests__/organizations-id.test.ts src/lib/__tests__/workflow-engine.test.ts src/app/api/__tests__/scim-users.test.ts src/app/api/__tests__/billing-portal.test.ts src/app/api/__tests__/billing-checkout.test.ts
```

Expected: PASS. The last four files are regression runs (`workflow-engine` and `scim-users` mock `org-suspension`, `billing-portal` and `billing-checkout` run it for real); none of them needs an edit, because `getOrgSuspensionStatus` keeps its signature.

Then:

```bash
npx tsc --noEmit -p .
npx eslint src/lib/entitlements-shared.ts src/lib/entitlements.ts src/lib/org-access.ts src/lib/org-suspension.ts src/lib/org-lock-redirect.ts src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/entitlements.test.ts src/lib/__tests__/org-access.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/app/api/__tests__/organizations-id.test.ts
```

Expected: no errors.

- [ ] **Step 11: Commit Part A**

```bash
git add src/lib/entitlements-shared.ts src/lib/entitlements.ts src/lib/org-access.ts src/lib/org-suspension.ts src/lib/org-lock-redirect.ts src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/entitlements.test.ts src/lib/__tests__/org-access.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/app/api/__tests__/organizations-id.test.ts
git commit -m "feat: resolve per-organization entitlements and the control-plane lock" -m "Add entitlements.ts (lenient stored-value parsing, cloud/self-hosted resolution) and
org-access.ts (status plus entitlements from one org row, per-run memo). lockedAt now wins
over every other status rule; self-hosted deployments still ignore stored values."
```

---

#### Part B: load the access with the user, swap the guard

- [ ] **Step 12: Write the failing tests for the user paths and the guard**

In `src/lib/__tests__/api-auth.test.ts`:

1. Extend the imports and add a logger mock.

Before:

```ts
vi.mock("@/lib/super-admin", () => ({
  isSuperAdmin: vi.fn(),
}));

import { headers } from "next/headers";
import {
  requireApiAuth,
  requireApiAdmin,
  requireApiCanRequest,
  requireSuperAdmin,
  requirePermission,
  requireWritableOrg,
} from "@/lib/api-auth";
```

After:

```ts
vi.mock("@/lib/super-admin", () => ({
  isSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/logger");

import { headers } from "next/headers";
import {
  getAuthUser,
  requireApiAuth,
  requireApiAdmin,
  requireApiCanRequest,
  requireFeature,
  requireSuperAdmin,
  requirePermission,
  requireWritableOrg,
  type AuthUser,
} from "@/lib/api-auth";
```

Before:

```ts
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
```

After:

```ts
import {
  EntitlementError,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/errors";
import { UNRESTRICTED, type Entitlements } from "@/lib/entitlements-shared";
import {
  stubCloudMode,
  TEST_NEW_ORG_ENTITLEMENTS,
} from "../../../tests/setup/cloud-mode";
```

and change the `vitest` import line `import { describe, it, expect, vi, beforeEach } from "vitest";` to `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`.

2. The fixture carries the full access row.

Before:

```ts
  organization: { isActive: true, suspendedAt: null },
};
```

After:

```ts
  organization: {
    isActive: true,
    suspendedAt: null,
    lockedAt: null,
    entitlements: null,
  },
};
```

3. The status assertions pass the whole row through.

Before (test "derives orgStatus from the org row loaded with the user"):

```ts
expect(mockResolveOrgStatus).toHaveBeenCalledWith({
  isActive: true,
  suspendedAt: null,
});
expect(user.orgStatus).toBe("read_only");
```

After:

```ts
expect(mockResolveOrgStatus).toHaveBeenCalledWith(activeDbUser.organization);
expect(user.orgStatus).toBe("read_only");
```

Before (test "blocks an API-key user of a locked org", the fixture):

```ts
        organization: { isActive: false, suspendedAt: null },
```

After:

```ts
        organization: {
          isActive: true,
          suspendedAt: null,
          lockedAt: new Date("2026-10-01T00:00:00Z"),
          entitlements: null,
        },
```

Before (same test, the final assertion):

```ts
expect(mockResolveOrgStatus).toHaveBeenCalledWith({
  isActive: false,
  suspendedAt: null,
});
```

After:

```ts
expect(mockResolveOrgStatus).toHaveBeenCalledWith(
  expect.objectContaining({ lockedAt: new Date("2026-10-01T00:00:00Z") }),
);
```

4. Append at the end of the file:

```ts
describe("organization access loaded with the user", () => {
  beforeEach(() => {
    mockPrisma.organization.findUnique.mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const stored = { features: ["api_keys"], maxAssets: 10, maxUsers: 2 };

  function dbUserWithEntitlements(entitlements: unknown) {
    return {
      ...activeDbUser,
      organization: { ...activeDbUser.organization, entitlements },
    };
  }

  it("selects the status and entitlement columns with the user, in one query", async () => {
    await requireApiAuth();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    const args = mockPrisma.user.findUnique.mock.calls[0][0] as {
      select: { organization: unknown };
    };
    expect(args.select.organization).toEqual({
      select: {
        isActive: true,
        suspendedAt: true,
        lockedAt: true,
        entitlements: true,
      },
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("exposes the stored entitlements of the user's organization", async () => {
    stubCloudMode();
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUserWithEntitlements(stored) as never,
    );

    const user = await requireApiAuth();

    expect(user.entitlements).toEqual(stored);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to the new-organization entitlements when none are stored", async () => {
    stubCloudMode();

    const user = await requireApiAuth();

    expect(user.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("gives an organization-less user the new-organization entitlements", async () => {
    stubCloudMode();
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      organizationId: null,
      organization: null,
    } as never);

    const user = await requireApiAuth();

    expect(user.organizationId).toBeUndefined();
    expect(user.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("ignores restrictive stored entitlements outside cloud mode", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUserWithEntitlements({
        features: [],
        maxAssets: 0,
        maxUsers: 0,
      }) as never,
    );

    const user = await requireApiAuth();

    expect(user.entitlements).toEqual(UNRESTRICTED);
  });

  it("carries the entitlements on the API-key path too", async () => {
    stubCloudMode();
    vi.mocked(validateApiKey).mockResolvedValue({
      id: "key-1",
      scopes: ["asset:view"],
      user: dbUserWithEntitlements(stored),
    } as never);
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );

    const user = await getAuthUser();

    expect(user.apiKeyId).toBe("key-1");
    expect(user.entitlements).toEqual(stored);
    expect(mockResolveOrgStatus).toHaveBeenCalledWith(
      expect.objectContaining({ entitlements: stored }),
    );
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

describe("requireFeature", () => {
  beforeEach(() => {
    mockPrisma.organization.findUnique.mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const granted = {
    features: ["scim"],
    maxAssets: null,
    maxUsers: null,
  } satisfies Entitlements;

  function userWith(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
      id: "user-1",
      organizationId: "org-1",
      orgStatus: "active",
      ...overrides,
    };
  }

  it("passes when the user's entitlements include the feature", async () => {
    stubCloudMode();

    await expect(
      requireFeature(userWith({ entitlements: granted }), "scim"),
    ).resolves.toBeUndefined();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("throws an EntitlementError when they do not", async () => {
    stubCloudMode();
    const guarded = requireFeature(
      userWith({ entitlements: granted }),
      "procurement",
    );

    await expect(guarded).rejects.toBeInstanceOf(EntitlementError);
    await expect(guarded).rejects.toBeInstanceOf(ForbiddenError);
    await expect(guarded).rejects.toMatchObject({
      code: "feature_not_entitled",
      feature: "procurement",
    });
    await expect(guarded).rejects.toThrow(
      "Forbidden: This feature is not available for your organization",
    );
  });

  it("looks the organization up when the user carries no entitlements", async () => {
    stubCloudMode();
    mockPrisma.organization.findUnique.mockResolvedValue({
      entitlements: granted,
    } as never);

    await expect(requireFeature(userWith(), "scim")).resolves.toBeUndefined();
    await expect(requireFeature(userWith(), "api_keys")).rejects.toMatchObject({
      code: "feature_not_entitled",
    });
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { entitlements: true },
    });
  });

  it("denies a user without an organization what the new-organization entitlements lack, without a query", async () => {
    stubCloudMode();

    await expect(
      requireFeature(userWith({ organizationId: undefined }), "api_keys"),
    ).rejects.toBeInstanceOf(EntitlementError);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("always passes outside cloud mode, whatever the user carries", async () => {
    await expect(
      requireFeature(
        userWith({
          entitlements: { features: [], maxAssets: 0, maxUsers: 0 },
        }),
        "scim",
      ),
    ).resolves.toBeUndefined();
    await expect(
      requireFeature(userWith({ organizationId: undefined }), "api_keys"),
    ).resolves.toBeUndefined();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
```

Create the select pin for the API-key path:

```ts
// src/lib/__tests__/api-keys.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.apiKey.findMany.mockResolvedValue([]);
});

describe("validateApiKey", () => {
  it("loads the organization status and entitlement columns with the key's user", async () => {
    await expect(
      validateApiKey("at_live_0123456789abcdef"),
    ).resolves.toBeNull();

    const args = mockPrisma.apiKey.findMany.mock.calls[0][0] as {
      include: { user: { select: { organization: unknown } } };
    };
    expect(args.include.user.select.organization).toEqual({
      select: {
        isActive: true,
        suspendedAt: true,
        lockedAt: true,
        entitlements: true,
      },
    });
  });

  it("rejects a key that is not an API key without querying", async () => {
    await expect(validateApiKey("not-a-key")).resolves.toBeNull();
    expect(mockPrisma.apiKey.findMany).not.toHaveBeenCalled();
  });
});
```

Create the scan that keeps a forgotten `lockedAt` from silently disabling the lock:

```ts
// src/lib/__tests__/org-status-selects.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__" || name === "__mocks__") return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (name.endsWith(".test.ts")) return [];
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("organization status selects", () => {
  it("select lockedAt wherever they select suspendedAt, or the control-plane lock silently stops applying", () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return (
          source.includes("suspendedAt: true") &&
          !source.includes("lockedAt: true")
        );
      })
      .map((file) => path.relative(SRC_DIR, file));

    expect(offenders).toEqual([]);
  });
});
```

Create the gate tests that run the real guards end to end (session, org status, entitlements, route):

```ts
// src/app/api/__tests__/entitlement-gates.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";

// The real guards run here (session, org status, entitlements): the point is
// that what the database holds for the user's organization decides the
// answer, through the single query that loads the user.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-keys", () => ({
  validateApiKey: vi.fn(),
  generateApiKey: vi.fn().mockResolvedValue({
    key: "at_live_test",
    prefix: "at_live_",
    hash: "hash",
  }),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi
    .fn()
    .mockResolvedValue({ organization: { id: "org-1" } }),
  scopeToOrganization: vi.fn((where: object) => ({
    ...where,
    organizationId: "org-1",
  })),
}));

import { GET as listOrders } from "@/app/api/procurement/orders/route";
import { POST as createApiKey } from "@/app/api/admin/api-keys/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);

const DAY_MS = 24 * 60 * 60 * 1000;
const PROCUREMENT_ONLY = {
  features: ["procurement"],
  maxAssets: null,
  maxUsers: null,
};
const API_KEYS_ONLY = {
  features: ["api_keys"],
  maxAssets: null,
  maxUsers: null,
};
const NOTHING = { features: [], maxAssets: 100, maxUsers: 3 };
const DENIED_MESSAGE =
  "Forbidden: This feature is not available for your organization";

interface OrgRow {
  isActive: boolean;
  suspendedAt: Date | null;
  lockedAt: Date | null;
  entitlements: unknown;
}

/** An admin whose organization row is the default row plus the overrides; null means no organization. */
function givenAdminOf(overrides: Partial<OrgRow> | null): void {
  const organization =
    overrides === null
      ? null
      : {
          isActive: true,
          suspendedAt: null,
          lockedAt: null,
          entitlements: null,
          ...overrides,
        };
  mockPrisma.user.findUnique.mockResolvedValue({
    userid: "user-1",
    username: "ada",
    firstname: "Ada",
    lastname: "Admin",
    email: "ada@example.com",
    isadmin: true,
    canrequest: true,
    organizationId: organization ? "org-1" : null,
    departmentId: null,
    isActive: true,
    organization,
  } as never);
}

const listProcurementOrders = () =>
  listOrders(createMockRequest("/api/procurement/orders"));
const createKey = () =>
  createApiKey(
    createMockRequest("/api/admin/api-keys", {
      method: "POST",
      body: { name: "CI", scopes: ["asset:view"] },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cloud mode", () => {
  beforeEach(() => {
    stubCloudMode();
  });

  it("answers 403 feature_not_entitled on a procurement route when the org lacks the feature", async () => {
    givenAdminOf({ entitlements: API_KEYS_ONLY });

    const { status, body } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(403);
    expect(body).toEqual({
      error: DENIED_MESSAGE,
      code: "feature_not_entitled",
      feature: "procurement",
    });
    expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("serves the route when the org has the feature", async () => {
    givenAdminOf({ entitlements: PROCUREMENT_ONLY });

    const { status } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(200);
    expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalled();
  });

  it("treats NULL entitlements as the new-organization entitlements", async () => {
    givenAdminOf({ entitlements: null });

    const { status } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(403);
  });

  it("treats an invalid stored value like NULL and logs it with the org id", async () => {
    givenAdminOf({
      entitlements: { features: "everything", maxAssets: null, maxUsers: null },
    });

    const { status } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(403);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("invalid"),
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("ignores unknown stored features and keeps the known ones", async () => {
    givenAdminOf({
      entitlements: {
        features: ["white_label", "procurement"],
        maxAssets: null,
        maxUsers: null,
      },
    });

    const { status } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(200);
  });

  it("gives an admin without an organization only the new-organization features", async () => {
    givenAdminOf(null);

    expect((await listProcurementOrders()).status).toBe(403);

    vi.stubEnv("NEW_ORG_ENTITLEMENTS", JSON.stringify(PROCUREMENT_ONLY));
    expect((await listProcurementOrders()).status).toBe(200);
    expect((await createKey()).status).toBe(403);
  });

  it("lets a control-plane lock beat a granted feature", async () => {
    givenAdminOf({ entitlements: PROCUREMENT_ONLY, lockedAt: new Date() });

    const { status, body } = await parseResponse(await listProcurementOrders());

    expect(status).toBe(403);
    expect(body).toEqual({
      error: "Forbidden: Organization suspended",
      code: "org_locked",
    });
  });

  it("refuses to create an API key without the api_keys feature and creates nothing", async () => {
    givenAdminOf({ entitlements: PROCUREMENT_ONLY });

    const { status, body } = await parseResponse(await createKey());

    expect(status).toBe(403);
    expect(body).toEqual({
      error: DENIED_MESSAGE,
      code: "feature_not_entitled",
      feature: "api_keys",
    });
    expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
  });

  it("creates an API key when the org has the api_keys feature", async () => {
    givenAdminOf({ entitlements: API_KEYS_ONLY });

    const { status } = await parseResponse(await createKey());

    expect(status).toBe(201);
    expect(mockPrisma.apiKey.create).toHaveBeenCalledTimes(1);
  });
});

describe("outside cloud mode (stale SaaS data)", () => {
  const staleSaasRow: Partial<OrgRow> = {
    suspendedAt: new Date(Date.now() - 400 * DAY_MS),
    lockedAt: new Date(),
    entitlements: NOTHING,
  };

  beforeEach(() => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
  });

  it("ignores restrictive entitlements, a lock and an old suspension on every gate", async () => {
    givenAdminOf(staleSaasRow);

    expect((await listProcurementOrders()).status).toBe(200);
    expect((await createKey()).status).toBe(201);
  });

  it("gives an admin without an organization every feature", async () => {
    givenAdminOf(null);

    expect((await listProcurementOrders()).status).toBe(200);
    expect((await createKey()).status).toBe(201);
  });
});
```

Create the static check that every gate was swapped and none was missed:

```ts
// src/app/api/__tests__/procurement-feature-gate.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "..");
const HANDLER =
  /export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE)\b/g;
const PROCUREMENT_GATE = /requireFeature\(\s*user,\s*"procurement"\s*\)/g;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

const allRoutes = routeFiles(API_DIR).map((full) => ({
  rel: path.relative(API_DIR, full),
  src: readFileSync(full, "utf8"),
}));

const procurementRoutes = allRoutes.filter((f) =>
  f.rel.startsWith(`procurement${path.sep}`),
);

describe("entitlement gates in routes", () => {
  it("finds the procurement routes", () => {
    expect(procurementRoutes.length).toBeGreaterThan(0);
  });

  it('gates every exported procurement handler with requireFeature(user, "procurement")', () => {
    const offenders = procurementRoutes
      .filter(
        (f) =>
          (f.src.match(PROCUREMENT_GATE)?.length ?? 0) !==
          [...f.src.matchAll(HANDLER)].length,
      )
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  it("gates API key creation on api_keys", () => {
    const route = allRoutes.find((f) => f.rel === "admin/api-keys/route.ts");

    expect(route?.src).toMatch(/requireFeature\(\s*user,\s*"api_keys"\s*\)/);
  });

  it("leaves no route on the removed plan guard", () => {
    const offenders = allRoutes
      .filter((f) => f.src.includes("requirePlanFeature"))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });
});
```

Update the two settings tests (they assert SSO and LDAP are not gated on the caller). In `src/app/api/__tests__/settings-sso.test.ts` and `src/app/api/__tests__/settings-platform-routes.test.ts` the import block and the assertion change.

Before (both files):

```ts
import {
  requirePlanFeature,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
```

After (both files):

```ts
import {
  requireFeature,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
```

Before (`settings-sso.test.ts`):

```ts
it("does not gate SSO on the caller's plan (operator-level setting)", async () => {
  const res = await put({
    settings: [{ key: "sso.enabled", value: "true" }],
  });

  expect(res.status).toBe(200);
  expect(requirePlanFeature).not.toHaveBeenCalled();
});
```

After:

```ts
it("does not gate SSO on the caller's entitlements (operator-level setting)", async () => {
  const res = await put({
    settings: [{ key: "sso.enabled", value: "true" }],
  });

  expect(res.status).toBe(200);
  expect(requireFeature).not.toHaveBeenCalled();
});
```

Before (`settings-platform-routes.test.ts`):

```ts
it("does not gate the route on the caller's plan", async () => {
  await send({ settings: [{ key: route.allowedKey, value: "value" }] });

  expect(requirePlanFeature).not.toHaveBeenCalled();
});
```

After:

```ts
it("does not gate the route on the caller's entitlements", async () => {
  await send({ settings: [{ key: route.allowedKey, value: "value" }] });

  expect(requireFeature).not.toHaveBeenCalled();
});
```

- [ ] **Step 13: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/lib/__tests__/api-auth.test.ts src/lib/__tests__/api-keys.test.ts src/lib/__tests__/org-status-selects.test.ts src/app/api/__tests__/entitlement-gates.test.ts src/app/api/__tests__/procurement-feature-gate.test.ts src/app/api/__tests__/settings-sso.test.ts src/app/api/__tests__/settings-platform-routes.test.ts
```

Expected: FAIL. `api-auth.test.ts` (no `requireFeature` export, the select still lacks `lockedAt` and `entitlements`), `api-keys.test.ts` (old select), `org-status-selects.test.ts` (lists `lib/api-auth.ts` and `lib/api-keys.ts`), `entitlement-gates.test.ts` (routes still call `requirePlanFeature`, which reads the plan column), `procurement-feature-gate.test.ts`, and the two settings tests (`No "requireFeature" export is defined on the mock`).

- [ ] **Step 14: Load the access with the user and add `requireFeature`**

In `src/lib/api-auth.ts`:

Imports. Before:

```ts
import { resolveOrgStatus, type OrgStatus } from "./org-suspension";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { isSuperAdmin } from "./super-admin";
import {
  isPlanFeatureEnabled,
  getRequiredPlan,
  type PlanFeature,
} from "./plan-features";
```

After:

```ts
import type { OrgStatus } from "./org-suspension";
import { orgAccessSelect, resolveOrgAccess } from "./org-access";
import { isCloudMode } from "./deployment-mode";
import { getEffectiveEntitlements } from "./entitlements";
import {
  allowsFeature,
  type Entitlements,
  type GatedFeature,
} from "./entitlements-shared";
import { EntitlementError, ForbiddenError, UnauthorizedError } from "./errors";
import { isSuperAdmin } from "./super-admin";
```

`AuthUser`. Before:

```ts
  /** Suspension state of the user's organization, loaded with the user */
  orgStatus: OrgStatus;
}
```

After:

```ts
  /** Suspension state of the user's organization, loaded with the user */
  orgStatus: OrgStatus;
  /** Entitlements of the user's organization, loaded with the user (optional so hand-built users keep compiling) */
  entitlements?: Entitlements;
}
```

API-key path (`authenticateWithApiKey`). Before:

```ts
  const dbUser = record.user;
  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: dbUser.userid,
```

After:

```ts
  const dbUser = record.user;
  if (!dbUser || !dbUser.isActive) return null;

  const access = resolveOrgAccess(
    dbUser.organization ?? null,
    dbUser.organizationId ?? null,
  );

  return {
    id: dbUser.userid,
```

Before:

```ts
    organizationId: dbUser.organizationId || undefined,
    orgStatus: resolveOrgStatus(dbUser.organization ?? null),
    apiKeyId: record.id,
```

After:

```ts
    organizationId: dbUser.organizationId || undefined,
    orgStatus: access.status,
    entitlements: access.entitlements,
    apiKeyId: record.id,
```

Session path (`getAuthUser`). Before:

```ts
      organization: { select: { isActive: true, suspendedAt: true } },
```

After:

```ts
      organization: { select: orgAccessSelect },
```

Before:

```ts
  if (!dbUser || !dbUser.isActive) {
    throw new UnauthorizedError();
  }

  return {
    id: dbUser.userid,
```

After:

```ts
  if (!dbUser || !dbUser.isActive) {
    throw new UnauthorizedError();
  }

  const access = resolveOrgAccess(
    dbUser.organization ?? null,
    dbUser.organizationId ?? null,
  );

  return {
    id: dbUser.userid,
```

Before:

```ts
    departmentId: dbUser.departmentId,
    orgStatus: resolveOrgStatus(dbUser.organization ?? null),
  };
```

After:

```ts
    departmentId: dbUser.departmentId,
    orgStatus: access.status,
    entitlements: access.entitlements,
  };
```

The guard. Before:

```ts
/**
 * Require that the user's org has a plan that includes a specific feature.
 * Self-hosted mode: always passes. Call after requireApiAuth/requireApiAdmin.
 */
export async function requirePlanFeature(
  user: AuthUser,
  feature: PlanFeature,
): Promise<void> {
  const enabled = await isPlanFeatureEnabled(user.organizationId, feature);
  if (!enabled) {
    const required = getRequiredPlan(feature);
    throw new ForbiddenError(
      "feature_not_entitled",
      `This feature requires the ${required} plan. Please upgrade.`,
    );
  }
}
```

After:

```ts
/**
 * Require that the user's organization is entitled to a gated feature. Uses
 * the entitlements loaded with the user (no extra query) and falls back to a
 * lookup by organization id for a hand-built user. Outside cloud mode it
 * always passes. Throws EntitlementError (403, feature_not_entitled). Call
 * after requireApiAuth/requireApiAdmin/requirePermission.
 */
export async function requireFeature(
  user: AuthUser,
  feature: GatedFeature,
): Promise<void> {
  if (!isCloudMode()) return;

  const entitlements =
    user.entitlements ??
    (await getEffectiveEntitlements(user.organizationId ?? null));
  if (!allowsFeature(entitlements, feature)) {
    throw new EntitlementError(feature);
  }
}
```

In `src/lib/api-keys.ts`:

Before:

```ts
import prisma from "./prisma";
```

After:

```ts
import prisma from "./prisma";
import { orgAccessSelect } from "./org-access";
```

Before:

```ts
          organization: { select: { isActive: true, suspendedAt: true } },
```

After:

```ts
          organization: { select: orgAccessSelect },
```

In `src/lib/__mocks__/api-auth.ts`:

Before:

```ts
 * Routes gained new guards over time (requirePlanFeature, requireWritableOrg,
```

After:

```ts
 * Routes gained new guards over time (requireFeature, requireWritableOrg,
```

Before:

```ts
export const requirePlanFeature = vi.fn().mockResolvedValue(undefined);
```

After:

```ts
export const requireFeature = vi.fn().mockResolvedValue(undefined);
```

- [ ] **Step 15: Swap the 14 call sites and the guard list**

The 13 procurement call sites and the API key creation call are a pure rename of the guard: same arguments, same position after `requirePermission`/`requireWritableOrg`. Three shapes occur.

Multi-line import (the seven procurement files `requests/route.ts`, `requests/[id]/route.ts`, `requests/[id]/submit`, `approve`, `reject`, `generate-po` and `orders/[id]/receive`, plus `admin/api-keys/route.ts`). Before:

```ts
  requirePlanFeature,
```

After:

```ts
  requireFeature,
```

Single-line import (`orders/route.ts`, `orders/[id]/route.ts`, `orders/[id]/pdf/route.ts`). Before:

```ts
import { requirePermission, requirePlanFeature } from "@/lib/api-auth";
```

After:

```ts
import { requirePermission, requireFeature } from "@/lib/api-auth";
```

Call (13 times in procurement with `"procurement"`, once in `admin/api-keys/route.ts` with `"api_keys"`). Before:

```ts
await requirePlanFeature(user, "procurement");
```

After:

```ts
await requireFeature(user, "procurement");
```

Apply the rename to exactly those files:

```bash
grep -rl "requirePlanFeature" src/app/api/procurement src/app/api/admin/api-keys | xargs perl -pi -e 's/requirePlanFeature/requireFeature/g'
```

Then, in `src/app/api/__tests__/route-conventions.test.ts`, before:

```ts
/\b(requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requirePlanFeature|requireApiCanRequest|getAuthUser)\s*\(/;
```

After:

```ts
/\b(requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requireFeature|requireEntitlement|requireApiCanRequest|getAuthUser)\s*\(/;
```

Verify that no reference to the removed guard is left (the static test file names it on purpose, so it is excluded):

```bash
grep -rn "requirePlanFeature" src | grep -v "procurement-feature-gate.test.ts"
```

Expected: no output.

- [ ] **Step 16: Remove the legacy plan module**

`billing/usage` only needs the pure helpers, which `plan-features-shared.ts` already exports. In `src/app/api/billing/usage/route.ts`:

Before:

```ts
import { getPlanFeatures, getPlanDisplayInfo } from "@/lib/plan-features";
import type { PlanKey } from "@/lib/plan-features-shared";
```

After:

```ts
import {
  getPlanFeatures,
  getPlanDisplayInfo,
  type PlanKey,
} from "@/lib/plan-features-shared";
```

Then:

```bash
grep -rn "lib/plan-features\"\|\./plan-features\"\|getOrgPlan\|isPlanFeatureEnabled" src tests | grep -v "^src/lib/plan-features.ts:"
git rm src/lib/plan-features.ts
```

Expected: the `grep` prints nothing (only the module itself still mentions its own functions), and `git rm` removes the file.

- [ ] **Step 17: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/lib/__tests__/api-auth.test.ts src/lib/__tests__/api-keys.test.ts src/lib/__tests__/org-status-selects.test.ts src/app/api/__tests__/entitlement-gates.test.ts src/app/api/__tests__/procurement-feature-gate.test.ts src/app/api/__tests__/settings-sso.test.ts src/app/api/__tests__/settings-platform-routes.test.ts src/app/api/__tests__/route-conventions.test.ts
```

Expected: PASS.

Then the checks:

```bash
npx tsc --noEmit -p .
npx eslint src/lib/api-auth.ts src/lib/api-keys.ts src/lib/__mocks__/api-auth.ts src/lib/__tests__/api-auth.test.ts src/lib/__tests__/api-keys.test.ts src/lib/__tests__/org-status-selects.test.ts src/app/api/admin/api-keys/route.ts src/app/api/billing/usage/route.ts src/app/api/procurement src/app/api/__tests__/entitlement-gates.test.ts src/app/api/__tests__/procurement-feature-gate.test.ts src/app/api/__tests__/settings-sso.test.ts src/app/api/__tests__/settings-platform-routes.test.ts src/app/api/__tests__/route-conventions.test.ts
```

Expected: no errors.

This task changes `api-auth.ts` and its automock, which almost every route test loads, so run the whole suite before the commit:

```bash
npx vitest run
```

Expected: PASS. If a test fails with `NEW_ORG_ENTITLEMENTS` named in the error, it enables cloud mode by stubbing only `CONTROL_PLANE_SECRET` while running the real `getAuthUser` on an org row without `entitlements` (the likely files are `billing-checkout.test.ts` and `billing-portal.test.ts`); replace that stub with `stubCloudMode()` from `tests/setup/cloud-mode.ts` and add `vi.unstubAllEnvs()` to its `afterEach`. Any other failure is a regression of this task: fix it before committing.

- [ ] **Step 18: Commit Part B**

```bash
git add src/lib/api-auth.ts src/lib/api-keys.ts src/lib/__mocks__/api-auth.ts src/lib/__tests__/api-auth.test.ts src/lib/__tests__/api-keys.test.ts src/lib/__tests__/org-status-selects.test.ts src/app/api/admin/api-keys/route.ts src/app/api/billing/usage/route.ts src/app/api/procurement src/app/api/__tests__/entitlement-gates.test.ts src/app/api/__tests__/procurement-feature-gate.test.ts src/app/api/__tests__/settings-sso.test.ts src/app/api/__tests__/settings-platform-routes.test.ts src/app/api/__tests__/route-conventions.test.ts
git commit -m "feat: gate routes on organization entitlements instead of the legacy plan" -m "Load the org access (status, lockedAt, entitlements) with the user on the session and API-key
paths, add AuthUser.entitlements and requireFeature in place of requirePlanFeature, swap the
13 procurement call sites and API key creation, and delete the legacy plan-features module."
```
