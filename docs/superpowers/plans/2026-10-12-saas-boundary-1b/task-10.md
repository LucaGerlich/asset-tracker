### Task 10: Limits core and the route creators

Today `src/lib/tenant-limits.ts` reads the legacy `maxAssets` and `maxUsers` columns, uses `-1` for "unlimited", counts every user including deactivated ones, falls back to the session's organization when it gets no argument (SCIM has no session, so its check silently allows everything) and allows org-less callers. This task replaces it with a module on top of `getEffectiveEntitlements` (Task 6), moves the seven route creators to it with an explicit organization, and removes the "Upgrade your plan" strings. Task 11 does the SCIM, SSO and sync creators. Pending invitations do not reserve a seat: invite create checks the current seats and invite accept checks again.

**Files:**

- Rewrite: `src/lib/tenant-limits.ts`
- Modify: `src/app/api/asset/route.ts`, `src/app/api/asset/addAsset/route.ts`, `src/app/api/import/route.ts`, `src/app/api/procurement/orders/[id]/receive/route.ts`, `src/app/api/user/addUser/route.ts`, `src/app/api/team/invite/route.ts`, `src/app/api/team/invite/[token]/route.ts`
- Modify: `src/app/api/scim/v2/Users/route.ts` (one line, so the file still compiles; Task 11 reworks it)
- Modify: `docs/DEVELOPER_GUIDE.md`, `docs/DEVELOPMENT_NOTES.md`
- Test: `src/lib/__tests__/tenant-limits.test.ts` (rewrite)
- Test: `src/app/api/__tests__/creator-limits.test.ts` (create: addAsset, addUser, import, procurement receive)
- Test: `src/app/api/__tests__/route-conventions.test.ts` (`THROWING_GUARDS`)
- Test: `src/app/api/__tests__/asset-crud.test.ts`, `team-invite-create.test.ts`, `team-invite-accept.test.ts`, `import-row-errors.test.ts`, `import-user-privilege.test.ts`, `email-ownership-routes.test.ts` (these mock `@/lib/tenant-limits`; move them to the new API and add the denial cases)

**Interfaces:**

- Consumes: `getEffectiveEntitlements(orgId)` (`src/lib/entitlements.ts`, Task 6); `isCloudMode` (Task 2); `LimitError`, `LimitResource` and `ForbiddenError` with code `organization_required` (Task 1); `stubCloudMode` (`tests/setup/cloud-mode.ts`, Task 2).
- Produces in `src/lib/tenant-limits.ts`:
  - `interface LimitResult { allowed: boolean; current: number; max: number | null }`. `current` is `0` when `max` is `null`: an unlimited resource runs no count query.
  - `checkAssetLimit(orgId: string | null, adding = 1): Promise<LimitResult>` and `checkUserLimit(orgId: string | null, adding = 1): Promise<LimitResult>`. Not in cloud mode: `{ allowed: true, current: 0, max: null }` without a query. Cloud and no org: `{ allowed: false, current: 0, max: 0 }`. Otherwise the effective entitlements plus a count (all assets of the org; users with `isActive: true`), `allowed = max === null || current + adding <= max`.
  - `requireAssetCapacity(orgId: string | null, adding = 1): Promise<void>` and `requireUserCapacity(orgId: string | null, adding = 1): Promise<void>`. Cloud and no org: `ForbiddenError("organization_required", "An organization is required")`. Not allowed: `LimitError(resource, max)`.
  - `remainingCapacity(orgId: string, resource: LimitResource): Promise<number | null>`. `null` is unlimited (also outside cloud mode, without a query); never below `0`.
- The `check*` functions stay for callers that answer in their own format (Task 11: SCIM, SSO hook). Only the `require*` functions throw, so only they join `THROWING_GUARDS`.
- A caller with nothing to add must skip the check: `adding = 0` still fails for an organization that is already over its limit.

- [ ] **Step 1: Write the failing core test**

Replace the whole of `src/lib/__tests__/tenant-limits.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/entitlements", () => ({
  getEffectiveEntitlements: vi.fn(),
}));

import {
  checkAssetLimit,
  checkUserLimit,
  remainingCapacity,
  requireAssetCapacity,
  requireUserCapacity,
} from "../tenant-limits";
import prisma from "@/lib/prisma";
import { getEffectiveEntitlements } from "@/lib/entitlements";
import { ForbiddenError, LimitError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);
const mockEntitlements = vi.mocked(getEffectiveEntitlements);

function limits(maxAssets: number | null, maxUsers: number | null) {
  mockEntitlements.mockResolvedValue({ features: [], maxAssets, maxUsers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.asset.count.mockResolvedValue(0);
  mockPrisma.user.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("outside cloud mode", () => {
  it("never limits and never queries", async () => {
    expect(await checkAssetLimit("org-1", 5000)).toEqual({
      allowed: true,
      current: 0,
      max: null,
    });
    expect(await checkUserLimit("org-1", 5000)).toEqual({
      allowed: true,
      current: 0,
      max: null,
    });
    expect(mockEntitlements).not.toHaveBeenCalled();
    expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("lets an organization-less creation through", async () => {
    expect(await checkAssetLimit(null)).toMatchObject({ allowed: true });
    await expect(requireAssetCapacity(null)).resolves.toBeUndefined();
    await expect(requireUserCapacity(null)).resolves.toBeUndefined();
  });

  it("reports unlimited headroom without querying", async () => {
    expect(await remainingCapacity("org-1", "assets")).toBeNull();
    expect(await remainingCapacity("org-1", "users")).toBeNull();
    expect(mockEntitlements).not.toHaveBeenCalled();
  });
});

describe("in cloud mode", () => {
  beforeEach(() => {
    stubCloudMode();
    limits(100, 3);
  });

  describe("checkAssetLimit", () => {
    it("allows while there is room and reports the usage", async () => {
      mockPrisma.asset.count.mockResolvedValue(50);

      expect(await checkAssetLimit("org-1")).toEqual({
        allowed: true,
        current: 50,
        max: 100,
      });
    });

    it("reads the entitlements and the count of the given organization", async () => {
      await checkAssetLimit("org-1");

      expect(mockEntitlements).toHaveBeenCalledWith("org-1");
      expect(mockPrisma.asset.count).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
      });
    });

    it("blocks when the organization is at its limit", async () => {
      mockPrisma.asset.count.mockResolvedValue(100);

      expect(await checkAssetLimit("org-1")).toEqual({
        allowed: false,
        current: 100,
        max: 100,
      });
    });

    it("allows adding exactly up to the limit and blocks one more", async () => {
      mockPrisma.asset.count.mockResolvedValue(95);

      expect((await checkAssetLimit("org-1", 5)).allowed).toBe(true);
      expect((await checkAssetLimit("org-1", 6)).allowed).toBe(false);
    });

    it("blocks creation when the organization is already over its limit", async () => {
      mockPrisma.asset.count.mockResolvedValue(120);

      expect(await checkAssetLimit("org-1")).toEqual({
        allowed: false,
        current: 120,
        max: 100,
      });
    });

    it("treats a null limit as unlimited and runs no count", async () => {
      limits(null, null);

      expect(await checkAssetLimit("org-1", 1_000_000)).toEqual({
        allowed: true,
        current: 0,
        max: null,
      });
      expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    });

    it("treats a zero limit as a real limit", async () => {
      limits(0, 0);

      expect((await checkAssetLimit("org-1")).allowed).toBe(false);
    });

    it("denies an organization-less creation without querying", async () => {
      expect(await checkAssetLimit(null)).toEqual({
        allowed: false,
        current: 0,
        max: 0,
      });
      expect(mockEntitlements).not.toHaveBeenCalled();
      expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    });
  });

  describe("checkUserLimit", () => {
    it("counts active users only", async () => {
      await checkUserLimit("org-1");

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: "org-1", isActive: true },
      });
    });

    it("blocks when the active users reach the limit", async () => {
      mockPrisma.user.count.mockResolvedValue(3);

      expect(await checkUserLimit("org-1")).toEqual({
        allowed: false,
        current: 3,
        max: 3,
      });
    });

    it("allows while a seat is free", async () => {
      mockPrisma.user.count.mockResolvedValue(2);

      expect((await checkUserLimit("org-1")).allowed).toBe(true);
    });

    it("blocks adding more users than seats are free", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      expect((await checkUserLimit("org-1", 2)).allowed).toBe(true);
      expect((await checkUserLimit("org-1", 3)).allowed).toBe(false);
    });

    it("uses the user limit, not the asset limit", async () => {
      limits(null, 1);
      mockPrisma.user.count.mockResolvedValue(1);

      expect((await checkUserLimit("org-1")).allowed).toBe(false);
    });

    it("denies an organization-less creation", async () => {
      expect(await checkUserLimit(null)).toEqual({
        allowed: false,
        current: 0,
        max: 0,
      });
    });
  });

  describe("requireAssetCapacity", () => {
    it("resolves while there is room", async () => {
      mockPrisma.asset.count.mockResolvedValue(10);

      await expect(requireAssetCapacity("org-1")).resolves.toBeUndefined();
    });

    it("throws a LimitError carrying the resource and the limit", async () => {
      mockPrisma.asset.count.mockResolvedValue(100);

      const denial = await requireAssetCapacity("org-1").catch(
        (error: unknown) => error,
      );

      expect(denial).toBeInstanceOf(LimitError);
      expect(denial).toBeInstanceOf(ForbiddenError);
      expect(denial).toMatchObject({
        code: "limit_reached",
        resource: "assets",
        max: 100,
        statusCode: 403,
      });
    });

    it("passes the number of records to add", async () => {
      mockPrisma.asset.count.mockResolvedValue(95);

      await expect(requireAssetCapacity("org-1", 5)).resolves.toBeUndefined();
      await expect(requireAssetCapacity("org-1", 6)).rejects.toBeInstanceOf(
        LimitError,
      );
    });

    it("refuses an organization-less creation with organization_required", async () => {
      const denial = await requireAssetCapacity(null).catch(
        (error: unknown) => error,
      );

      expect(denial).toBeInstanceOf(ForbiddenError);
      expect(denial).not.toBeInstanceOf(LimitError);
      expect(denial).toMatchObject({ code: "organization_required" });
      expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    });

    it("names no plan or price in the denial", async () => {
      mockPrisma.asset.count.mockResolvedValue(100);

      const denial = (await requireAssetCapacity("org-1").catch(
        (error: unknown) => error,
      )) as Error;

      expect(denial.message).toBe(
        "Forbidden: Your organization has reached its asset limit",
      );
      expect(denial.message).not.toMatch(/plan|upgrade|price/i);
    });
  });

  describe("requireUserCapacity", () => {
    it("throws a LimitError for users at the limit", async () => {
      mockPrisma.user.count.mockResolvedValue(3);

      await expect(requireUserCapacity("org-1")).rejects.toMatchObject({
        code: "limit_reached",
        resource: "users",
        max: 3,
      });
    });

    it("resolves when a seat is free", async () => {
      mockPrisma.user.count.mockResolvedValue(2);

      await expect(requireUserCapacity("org-1")).resolves.toBeUndefined();
    });

    it("refuses an organization-less creation with organization_required", async () => {
      await expect(requireUserCapacity(null)).rejects.toMatchObject({
        code: "organization_required",
      });
    });
  });

  describe("remainingCapacity", () => {
    it("returns the free room", async () => {
      mockPrisma.asset.count.mockResolvedValue(40);

      expect(await remainingCapacity("org-1", "assets")).toBe(60);
    });

    it("counts active users only", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      expect(await remainingCapacity("org-1", "users")).toBe(2);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: "org-1", isActive: true },
      });
    });

    it("never goes below zero for an organization over its limit", async () => {
      mockPrisma.asset.count.mockResolvedValue(150);

      expect(await remainingCapacity("org-1", "assets")).toBe(0);
    });

    it("returns null for an unlimited resource without counting", async () => {
      limits(null, null);

      expect(await remainingCapacity("org-1", "assets")).toBeNull();
      expect(mockPrisma.asset.count).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/tenant-limits.test.ts`
Expected: FAIL. The old module has no `requireAssetCapacity`, `requireUserCapacity` or `remainingCapacity`, reads the session's organization and returns `max: -1`; 28 of the 29 tests fail.

- [ ] **Step 3: Rewrite the module**

Replace the whole of `src/lib/tenant-limits.ts`:

```ts
import prisma from "@/lib/prisma";
import { isCloudMode } from "@/lib/deployment-mode";
import { getEffectiveEntitlements } from "@/lib/entitlements";
import type { Entitlements } from "@/lib/entitlements-shared";
import { ForbiddenError, LimitError, type LimitResource } from "@/lib/errors";

/**
 * Per-organization resource limits, read from the organization's entitlements.
 *
 * - Outside cloud mode nothing is limited and nothing is queried.
 * - `max: null` means unlimited.
 * - Every function takes the organization explicitly. There is no session
 *   fallback: callers act for an org that may differ from the session's
 *   (invite accept, SCIM, SSO, syncs).
 * - Assets count in full; users count only while `isActive`.
 * - Records may be added while `current + adding <= max`; at the limit nothing
 *   more fits. An organization that is already over its limit (the limit was
 *   lowered) only loses creation; nothing is removed.
 * - In cloud mode a creation without an organization is refused.
 */

export interface LimitResult {
  allowed: boolean;
  /** Current usage. 0 when the limit is unlimited: no count is run then. */
  current: number;
  max: number | null;
}

function limitFor(
  entitlements: Entitlements,
  resource: LimitResource,
): number | null {
  return resource === "assets" ? entitlements.maxAssets : entitlements.maxUsers;
}

function countUsage(orgId: string, resource: LimitResource): Promise<number> {
  return resource === "assets"
    ? prisma.asset.count({ where: { organizationId: orgId } })
    : prisma.user.count({ where: { organizationId: orgId, isActive: true } });
}

async function checkLimit(
  orgId: string | null,
  resource: LimitResource,
  adding: number,
): Promise<LimitResult> {
  if (!isCloudMode()) return { allowed: true, current: 0, max: null };
  if (!orgId) return { allowed: false, current: 0, max: 0 };

  const max = limitFor(await getEffectiveEntitlements(orgId), resource);
  if (max === null) return { allowed: true, current: 0, max: null };

  const current = await countUsage(orgId, resource);
  return { allowed: current + adding <= max, current, max };
}

async function requireCapacity(
  orgId: string | null,
  resource: LimitResource,
  adding: number,
): Promise<void> {
  if (isCloudMode() && !orgId) {
    throw new ForbiddenError(
      "organization_required",
      "An organization is required",
    );
  }
  const result = await checkLimit(orgId, resource, adding);
  if (!result.allowed) throw new LimitError(resource, result.max);
}

/** Whether `adding` more assets fit into the organization's asset limit. */
export function checkAssetLimit(
  orgId: string | null,
  adding = 1,
): Promise<LimitResult> {
  return checkLimit(orgId, "assets", adding);
}

/** Whether `adding` more active users fit into the organization's user limit. */
export function checkUserLimit(
  orgId: string | null,
  adding = 1,
): Promise<LimitResult> {
  return checkLimit(orgId, "users", adding);
}

/**
 * Throws `LimitError` when `adding` more assets do not fit, and
 * `ForbiddenError("organization_required")` for an org-less creation in cloud
 * mode. Call it before the create, with the org the record is created in.
 */
export function requireAssetCapacity(
  orgId: string | null,
  adding = 1,
): Promise<void> {
  return requireCapacity(orgId, "assets", adding);
}

/** Like `requireAssetCapacity`, for active users. */
export function requireUserCapacity(
  orgId: string | null,
  adding = 1,
): Promise<void> {
  return requireCapacity(orgId, "users", adding);
}

/**
 * How many more records of this kind the organization can take: `null` when
 * unlimited, `0` when full or over the limit. Sync loops read it once and
 * count down instead of running a check per record.
 */
export async function remainingCapacity(
  orgId: string,
  resource: LimitResource,
): Promise<number | null> {
  if (!isCloudMode()) return null;

  const max = limitFor(await getEffectiveEntitlements(orgId), resource);
  if (max === null) return null;

  return Math.max(0, max - (await countUsage(orgId, resource)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/tenant-limits.test.ts`
Expected: PASS (29 tests).

- [ ] **Step 5: Move the route tests to the new API and add the denial cases**

The routes will call `requireAssetCapacity` and `requireUserCapacity`, so every test that mocks `@/lib/tenant-limits` exports those instead. Apply the following edits.

`src/app/api/__tests__/import-row-errors.test.ts`, `src/app/api/__tests__/import-user-privilege.test.ts` and `src/app/api/__tests__/email-ownership-routes.test.ts` all contain the same mock. In each, replace:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
  checkAssetLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));
```

with:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  requireUserCapacity: vi.fn().mockResolvedValue(undefined),
  requireAssetCapacity: vi.fn().mockResolvedValue(undefined),
}));
```

`src/app/api/__tests__/asset-crud.test.ts` (the mock, the imports and the `beforeEach` change; the old denial case is replaced by three cases):

Replace:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  checkAssetLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 5, max: 100 }),
}));
```

with:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  requireAssetCapacity: vi.fn().mockResolvedValue(undefined),
}));
```

Replace:

```ts
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { checkAssetLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { ForbiddenError, LimitError, UnauthorizedError } from "@/lib/errors";
import { requireAssetCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
  vi.mocked(checkAssetLimit).mockResolvedValue({
    allowed: true,
    current: 5,
    max: 100,
  });
});

describe("GET /api/asset", () => {
```

with:

```ts
  vi.mocked(requireAssetCapacity).mockResolvedValue(undefined);
});

describe("GET /api/asset", () => {
```

Replace:

```ts
it("returns 403 when asset limit reached", async () => {
  vi.mocked(checkAssetLimit).mockResolvedValue({
    allowed: false,
    current: 100,
    max: 100,
  });

  const req = createMockRequest("/api/asset", {
    method: "POST",
    body: {
      assetname: "Over Limit",
      assettag: "OL-001",
      serialnumber: "SN-OL-001",
    },
  });
  const res = await POST(req);
  expect(res.status).toBe(403);
});
```

with:

```ts
it("checks the asset limit of the organization the asset is created in", async () => {
  mockPrisma.asset.create.mockResolvedValue({
    ...mockAsset,
    assetid: "new-asset-uuid",
  } as any);

  await POST(
    createMockRequest("/api/asset", {
      method: "POST",
      body: {
        assetname: "New Asset",
        assettag: "NEW-001",
        serialnumber: "SN-NEW-001",
      },
    }),
  );

  expect(requireAssetCapacity).toHaveBeenCalledWith("org-uuid-001");
});

it("answers 403 limit_reached and creates nothing when the asset limit is reached", async () => {
  vi.mocked(requireAssetCapacity).mockRejectedValue(
    new LimitError("assets", 100),
  );

  const req = createMockRequest("/api/asset", {
    method: "POST",
    body: {
      assetname: "Over Limit",
      assettag: "OL-001",
      serialnumber: "SN-OL-001",
    },
  });
  const res = await POST(req);
  const { status, body } = await parseResponse<any>(res);

  expect(status).toBe(403);
  expect(body).toMatchObject({
    code: "limit_reached",
    resource: "assets",
    max: 100,
  });
  expect(body.error).not.toMatch(/plan|upgrade/i);
  expect(mockPrisma.asset.create).not.toHaveBeenCalled();
});

it("answers 403 organization_required for an organization-less creator", async () => {
  vi.mocked(requireAssetCapacity).mockRejectedValue(
    new ForbiddenError("organization_required", "An organization is required"),
  );

  const res = await POST(
    createMockRequest("/api/asset", {
      method: "POST",
      body: {
        assetname: "Orphan",
        assettag: "OR-001",
        serialnumber: "SN-OR-001",
      },
    }),
  );
  const { status, body } = await parseResponse<any>(res);

  expect(status).toBe(403);
  expect(body.code).toBe("organization_required");
  expect(mockPrisma.asset.create).not.toHaveBeenCalled();
});
```

`src/app/api/__tests__/team-invite-create.test.ts`:

Replace:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));

import { POST } from "@/app/api/team/invite/route";
import prisma from "@/lib/prisma";
```

with:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  requireUserCapacity: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/team/invite/route";
import prisma from "@/lib/prisma";
import { LimitError } from "@/lib/errors";
import { requireUserCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
```

with:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserCapacity).mockResolvedValue(undefined);
  mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
```

then append at the end of the file:

```ts
describe("POST /api/team/invite user limit", () => {
  it("checks the seats of the inviter's organization", async () => {
    await invite({ email: "new@example.com" });

    expect(requireUserCapacity).toHaveBeenCalledWith(ADMIN_ORG);
  });

  it("answers 403 limit_reached and creates no invitation when the organization is full", async () => {
    vi.mocked(requireUserCapacity).mockRejectedValue(
      new LimitError("users", 3),
    );

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await invite({ email: "new@example.com" }),
    );

    expect(status).toBe(403);
    expect(body).toMatchObject({
      code: "limit_reached",
      resource: "users",
      max: 3,
    });
    expect(body.error).not.toMatch(/plan|upgrade/i);
    expect(mockPrisma.teamInvitation.create).not.toHaveBeenCalled();
  });
});
```

`src/app/api/__tests__/team-invite-accept.test.ts` (both denial cases now reject with a `LimitError` and assert the body):

Replace:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));
```

with:

```ts
vi.mock("@/lib/tenant-limits", () => ({
  requireUserCapacity: vi.fn().mockResolvedValue(undefined),
}));
```

Replace:

```ts
import { checkUserLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireUserCapacity } from "@/lib/tenant-limits";
import { LimitError } from "@/lib/errors";
```

Replace:

```ts
const mockCheckUserLimit = vi.mocked(checkUserLimit);
```

with:

```ts
const mockRequireUserCapacity = vi.mocked(requireUserCapacity);
```

Replace:

```ts
mockCheckUserLimit.mockResolvedValue({
  allowed: true,
  current: 0,
  max: -1,
});
mockPrisma.teamInvitation.findUnique;
```

with:

```ts
mockRequireUserCapacity.mockResolvedValue(undefined);
mockPrisma.teamInvitation.findUnique;
```

Replace:

```ts
    expect(mockCheckUserLimit).not.toHaveBeenCalled();
  });

  it("returns 403 and changes nothing when the invite's org is at its user limit", async () => {
    existingUserIn(OTHER_ORG);
    signedInAs(INVITEE_EMAIL);
    mockCheckUserLimit.mockResolvedValue({
      allowed: false,
      current: 5,
      max: 5,
    });

    const { status } = await parseResponse(await accept());

    expect(status).toBe(403);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
```

with:

```ts
    expect(mockRequireUserCapacity).not.toHaveBeenCalled();
  });

  it("returns 403 limit_reached and changes nothing when the invite's org is at its user limit", async () => {
    existingUserIn(OTHER_ORG);
    signedInAs(INVITEE_EMAIL);
    mockRequireUserCapacity.mockRejectedValue(new LimitError("users", 5));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await accept(),
    );

    expect(status).toBe(403);
    expect(body).toMatchObject({
      code: "limit_reached",
      resource: "users",
      max: 5,
    });
    expect(body.error).not.toMatch(/plan|upgrade/i);
    expect(mockRequireUserCapacity).toHaveBeenCalledWith(INVITE_ORG);
```

Replace:

```ts
    expect(status).toBe(200);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
```

with:

```ts
    expect(status).toBe(200);
    expect(mockRequireUserCapacity).toHaveBeenCalledWith(INVITE_ORG);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
```

Replace:

```ts
  it("returns 403 and creates nothing when the invite's org is at its user limit", async () => {
    mockCheckUserLimit.mockResolvedValue({
      allowed: false,
      current: 5,
      max: 5,
    });

    const { status } = await parseResponse(await accept(newUserBody));

    expect(status).toBe(403);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
```

with:

```ts
  it("returns 403 limit_reached and creates nothing when the invite's org is at its user limit", async () => {
    mockRequireUserCapacity.mockRejectedValue(new LimitError("users", 5));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await accept(newUserBody),
    );

    expect(status).toBe(403);
    expect(body).toMatchObject({ code: "limit_reached", resource: "users" });
    expect(mockRequireUserCapacity).toHaveBeenCalledWith(INVITE_ORG);
```

Create `src/app/api/__tests__/creator-limits.test.ts`. It covers the creators that have no limit test yet: `addAsset`, `addUser`, the CSV import and the procurement receipt.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/tenant-limits", () => ({
  requireAssetCapacity: vi.fn().mockResolvedValue(undefined),
  requireUserCapacity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
    userId: "admin-uuid-001",
  }),
  scopeToOrganization: vi.fn((where: object) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create" },
  AUDIT_ENTITIES: { ASSET: "asset", USER: "user" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/magic-link", () => ({
  sendSetPasswordLink: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { POST as addAsset } from "@/app/api/asset/addAsset/route";
import { POST as addUser } from "@/app/api/user/addUser/route";
import { POST as importCsv } from "@/app/api/import/route";
import { POST as receiveGoods } from "@/app/api/procurement/orders/[id]/receive/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError, LimitError } from "@/lib/errors";
import { requireAssetCapacity, requireUserCapacity } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);
const mockRequireAssets = vi.mocked(requireAssetCapacity);
const mockRequireUsers = vi.mocked(requireUserCapacity);

const ORG = "org-uuid-001";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAssets.mockResolvedValue(undefined);
  mockRequireUsers.mockResolvedValue(undefined);
});

/** The denial body every creator answers with, without a plan or price in it. */
function expectLimitBody(
  body: Record<string, unknown>,
  resource: "assets" | "users",
  max: number,
) {
  expect(body).toMatchObject({ code: "limit_reached", resource, max });
  expect(String(body.error)).not.toMatch(/plan|upgrade|price/i);
}

describe("POST /api/asset/addAsset", () => {
  const assetBody = {
    assetname: "Laptop",
    assettag: "LAP-1",
    serialnumber: "SN-1",
  };
  const add = () =>
    addAsset(
      createMockRequest("/api/asset/addAsset", {
        method: "POST",
        body: assetBody,
      }),
    );

  it("checks the asset limit of the organization the asset is created in", async () => {
    mockPrisma.asset.create.mockResolvedValue({
      assetid: "asset-1",
      assetname: "Laptop",
      assettag: "LAP-1",
      organizationId: ORG,
    } as never);

    const res = await add();

    expect(res.status).toBe(201);
    expect(mockRequireAssets).toHaveBeenCalledWith(ORG);
  });

  it("answers 403 limit_reached and creates nothing at the limit", async () => {
    mockRequireAssets.mockRejectedValue(new LimitError("assets", 100));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await add(),
    );

    expect(status).toBe(403);
    expectLimitBody(body, "assets", 100);
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("answers 403 organization_required for a creator without an organization", async () => {
    mockRequireAssets.mockRejectedValue(
      new ForbiddenError(
        "organization_required",
        "An organization is required",
      ),
    );

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await add(),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("organization_required");
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/user/addUser", () => {
  const add = (body: Record<string, unknown> = {}) =>
    addUser(createMockRequest("/api/user/addUser", { method: "POST", body }));

  it("checks the seats of the admin's organization before reading the body", async () => {
    await add({});

    expect(mockRequireUsers).toHaveBeenCalledWith(ORG);
  });

  it("answers 403 limit_reached and creates nothing when the organization is full", async () => {
    mockRequireUsers.mockRejectedValue(new LimitError("users", 3));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await add({
        username: "newuser",
        firstname: "New",
        lastname: "User",
        passwordMode: "manual",
      }),
    );

    expect(status).toBe(403);
    expectLimitBody(body, "users", 3);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("passes null for an admin without an organization", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce({
      id: "admin-uuid-001",
      isAdmin: true,
      orgStatus: "active",
    });

    await add({});

    expect(mockRequireUsers).toHaveBeenCalledWith(null);
  });
});

describe("POST /api/import", () => {
  const importFile = (entityType: string, csv: string) => {
    const form = new FormData();
    form.set("file", new File([csv], "rows.csv", { type: "text/csv" }));
    form.set("entityType", entityType);
    return importCsv(
      new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        body: form,
      }),
    );
  };

  const assetCsv =
    "assetname,assettag,serialnumber\nA,A-1,SN-A\nB,B-1,SN-B\nC,C-1,SN-C\n";
  const userCsv = "username,firstname,lastname\nada,Ada,L\nbob,Bob,B\n";

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: ORG,
    } as never);
    mockPrisma.importJob.create.mockResolvedValue({ id: "job-1" } as never);
    mockPrisma.importJob.update.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: "job-1", ...args.data })) as never);
  });

  it("checks that the whole asset file fits, in the importer's organization", async () => {
    const res = await importFile("asset", assetCsv);

    expect(res.status).toBe(201);
    expect(mockRequireAssets).toHaveBeenCalledWith(ORG, 3);
    expect(mockRequireUsers).not.toHaveBeenCalled();
  });

  it("checks that the whole user file fits", async () => {
    const res = await importFile("user", userCsv);

    expect(res.status).toBe(201);
    expect(mockRequireUsers).toHaveBeenCalledWith(ORG, 2);
    expect(mockRequireAssets).not.toHaveBeenCalled();
  });

  it("answers 403 limit_reached and creates no job when the file does not fit", async () => {
    mockRequireAssets.mockRejectedValue(new LimitError("assets", 100));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await importFile("asset", assetCsv),
    );

    expect(status).toBe(403);
    expectLimitBody(body, "assets", 100);
    expect(mockPrisma.importJob.create).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("answers 403 limit_reached for a user file that does not fit", async () => {
    mockRequireUsers.mockRejectedValue(new LimitError("users", 3));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await importFile("user", userCsv),
    );

    expect(status).toBe(403);
    expectLimitBody(body, "users", 3);
    expect(mockPrisma.importJob.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("passes null for an importer without an organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: null,
    } as never);

    await importFile("asset", assetCsv);

    expect(mockRequireAssets).toHaveBeenCalledWith(null, 3);
  });

  it("applies no limit to entity types that are not limited", async () => {
    const res = await importFile("location", "locationname\nBerlin\n");

    expect(res.status).toBe(201);
    expect(mockRequireAssets).not.toHaveBeenCalled();
    expect(mockRequireUsers).not.toHaveBeenCalled();
  });
});

describe("POST /api/procurement/orders/[id]/receive", () => {
  const ORDER_ID = "7d6f1c2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
  const ASSET_ITEM = "11111111-1111-4111-8111-111111111111";
  const ACCESSORY_ITEM = "22222222-2222-4222-8222-222222222222";

  const receive = (items: Array<{ itemId: string; receivedQty: number }>) =>
    receiveGoods(
      createMockRequest(`/api/procurement/orders/${ORDER_ID}/receive`, {
        method: "POST",
        body: {
          items: items.map((item) => ({ ...item, condition: "good" })),
        },
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

  beforeEach(() => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
      id: ORDER_ID,
      status: "ordered",
      poNumber: "PO-1",
      purchaseRequestId: "request-1",
      purchaseRequest: {
        items: [
          {
            id: ASSET_ITEM,
            entityType: "asset",
            description: "Laptop",
            estimatedUnitCost: 1000,
            quantity: 5,
            receivedQuantity: 0,
          },
          {
            id: ACCESSORY_ITEM,
            entityType: "accessory",
            description: "Mouse",
            estimatedUnitCost: 20,
            quantity: 10,
            receivedQuantity: 0,
          },
        ],
      },
    } as never);
    mockPrisma.goodsReceipt.create.mockResolvedValue({
      id: "receipt-1",
    } as never);
    mockPrisma.purchaseRequestItem.findMany.mockResolvedValue([]);
    mockPrisma.asset.create.mockResolvedValue({ assetid: "asset-1" } as never);
  });

  it("checks that the received asset units fit before the transaction", async () => {
    const res = await receive([
      { itemId: ASSET_ITEM, receivedQty: 3 },
      { itemId: ACCESSORY_ITEM, receivedQty: 4 },
    ]);

    expect(res.status).toBe(201);
    expect(mockRequireAssets).toHaveBeenCalledWith(ORG, 3);
    expect(mockPrisma.asset.create).toHaveBeenCalledTimes(3);
  });

  it("answers 403 limit_reached and records nothing when the units do not fit", async () => {
    mockRequireAssets.mockRejectedValue(new LimitError("assets", 100));

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await receive([{ itemId: ASSET_ITEM, receivedQty: 3 }]),
    );

    expect(status).toBe(403);
    expectLimitBody(body, "assets", 100);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.goodsReceipt.create).not.toHaveBeenCalled();
  });

  it("needs no room for a receipt without asset lines", async () => {
    const res = await receive([{ itemId: ACCESSORY_ITEM, receivedQty: 4 }]);

    expect(res.status).toBe(201);
    expect(mockRequireAssets).not.toHaveBeenCalled();
  });
});
```

Finally teach the route convention test about the throwing guards. In `src/app/api/__tests__/route-conventions.test.ts`, inside the `THROWING_GUARDS` regex, replace the tail:

```text
|requireApiCanRequest|getAuthUser)\s*\(/;
```

with:

```text
|requireApiCanRequest|getAuthUser|requireAssetCapacity|requireUserCapacity)\s*\(/;
```

After this edit the whole regex reads `/\b(requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requireFeature|requireEntitlement|requireApiCanRequest|getAuthUser|requireAssetCapacity|requireUserCapacity)\s*\(/`. The test then also requires `apiErrorResponse(` in every route file that calls the two new guards.

- [ ] **Step 6: Run the route tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/creator-limits.test.ts src/app/api/__tests__/asset-crud.test.ts src/app/api/__tests__/team-invite-create.test.ts src/app/api/__tests__/team-invite-accept.test.ts`
Expected: FAIL. The routes still call `checkAssetLimit` and `checkUserLimit`, which the mocks no longer export, so they answer 500 and `requireAssetCapacity` and `requireUserCapacity` are never called.

- [ ] **Step 7: Switch the routes to the capacity guards**

Every route already maps guard errors through `apiErrorResponse` in its `catch`, so a thrown `LimitError` becomes `403 { error, code: "limit_reached", resource, max }` and the org-less refusal becomes `403 { error, code: "organization_required" }` with no further change.

`src/app/api/asset/route.ts` (POST; `orgId` is the organization the asset is written to, a few lines above):

Replace:

```ts
import { checkAssetLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireAssetCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
const limitCheck = await checkAssetLimit();
if (!limitCheck.allowed) {
  return NextResponse.json(
    {
      error: `Asset limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to add more assets.`,
    },
    { status: 403 },
  );
}

const body = await req.json();
const d = validateBody(createAssetSchema, body);
```

with:

```ts
await requireAssetCapacity(orgId ?? null);

const body = await req.json();
const d = validateBody(createAssetSchema, body);
```

`src/app/api/asset/addAsset/route.ts`. The organization lookup moves above the check, so the check and the insert use the same organization:

Replace:

```ts
import { checkAssetLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireAssetCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
const limitCheck = await checkAssetLimit();
if (!limitCheck.allowed) {
  return new Response(
    JSON.stringify({
      error: `Asset limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to add more assets.`,
    }),
    { status: 403 },
  );
}
```

with:

```ts
const orgContext = await getOrganizationContext();
await requireAssetCapacity(orgContext?.organization?.id ?? null);
```

Replace:

```ts
const { assetname, assettag, serialnumber, ...rest } = validationResult.data;

const orgContext = await getOrganizationContext();

const created;
```

with:

```ts
const { assetname, assettag, serialnumber, ...rest } = validationResult.data;

const created;
```

`src/app/api/import/route.ts`. `importOrgId` is the importer's organization, read at the top of the handler. The old "slots remaining" arithmetic goes: the whole row count is checked at once.

Replace:

```ts
import { checkAssetLimit, checkUserLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireAssetCapacity, requireUserCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
const rowCount = lines.length - 1;
if (validatedInput.entityType === "asset") {
  const limitCheck = await checkAssetLimit();
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Asset limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to import more assets.`,
      },
      { status: 403 },
    );
  }
  if (limitCheck.max !== -1 && limitCheck.current + rowCount > limitCheck.max) {
    return NextResponse.json(
      {
        error: `Import would exceed asset limit. You have ${limitCheck.max - limitCheck.current} slots remaining but are trying to import ${rowCount} assets.`,
      },
      { status: 403 },
    );
  }
} else if (validatedInput.entityType === "user") {
  const limitCheck = await checkUserLimit();
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to import more users.`,
      },
      { status: 403 },
    );
  }
  if (limitCheck.max !== -1 && limitCheck.current + rowCount > limitCheck.max) {
    return NextResponse.json(
      {
        error: `Import would exceed user limit. You have ${limitCheck.max - limitCheck.current} slots remaining but are trying to import ${rowCount} users.`,
      },
      { status: 403 },
    );
  }
}
```

with:

```ts
const rowCount = lines.length - 1;
// The whole file must fit before anything is created. Rows that fail later
// still count here, because the check runs once, up front.
if (validatedInput.entityType === "asset") {
  await requireAssetCapacity(importOrgId, rowCount);
} else if (validatedInput.entityType === "user") {
  await requireUserCapacity(importOrgId, rowCount);
}
```

`src/app/api/user/addUser/route.ts`:

Replace:

```ts
import { checkUserLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireUserCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
const limitCheck = await checkUserLimit();
if (!limitCheck.allowed) {
  return NextResponse.json(
    {
      error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to add more users.`,
    },
    { status: 403 },
  );
}
```

with:

```ts
await requireUserCapacity(admin.organizationId ?? null);
```

`src/app/api/team/invite/route.ts` (invite create; `user.organizationId` is known to be set by the guard above):

Replace:

```ts
import { checkUserLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireUserCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
const limitCheck = await checkUserLimit(user.organizationId);
if (!limitCheck.allowed) {
  return NextResponse.json(
    {
      error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to invite more users.`,
    },
    { status: 403 },
  );
}
```

with:

```ts
await requireUserCapacity(user.organizationId);
```

`src/app/api/team/invite/[token]/route.ts` (invite accept: the existing user joining another organization, and the new user):

Replace:

```ts
import { checkUserLimit } from "@/lib/tenant-limits";
```

with:

```ts
import { requireUserCapacity } from "@/lib/tenant-limits";
```

Delete:

```ts
const USER_LIMIT_MESSAGE =
  "This organization has reached its user limit. Ask an administrator to upgrade the plan.";
```

Replace:

```ts
if (joinsNewOrganization) {
  const limitCheck = await checkUserLimit(invitation.organization.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: USER_LIMIT_MESSAGE }, { status: 403 });
  }
}
```

with:

```ts
if (joinsNewOrganization) {
  await requireUserCapacity(invitation.organization.id);
}
```

Replace:

```ts
const limitCheck = await checkUserLimit(invitation.organization.id);
if (!limitCheck.allowed) {
  return NextResponse.json({ error: USER_LIMIT_MESSAGE }, { status: 403 });
}

// Create new user without a password column write
```

with:

```ts
await requireUserCapacity(invitation.organization.id);

// Create new user without a password column write
```

`src/app/api/scim/v2/Users/route.ts`. SCIM authenticates by token and has no session, so the old no-argument call never found an organization and allowed everything. The new signature needs the organization; pass the token's. Task 11 reworks the denial itself and adds the reactivation checks:

Replace:

```ts
const limitCheck = await checkUserLimit();
```

with:

```ts
const limitCheck = await checkUserLimit(organizationId);
```

`src/app/api/procurement/orders/[id]/receive/route.ts`. The receipt creates one asset per received unit of an asset line, so the sum of those units must fit before the transaction starts. Insert the block directly before `prisma.$transaction`, after the "exceeds the remaining quantity" loop (the import goes next to the other `@/lib` imports; Task 6 already changed the `requireFeature` call above):

Replace:

```ts
import { logger } from "@/lib/logger";
```

with:

```ts
import { requireAssetCapacity } from "@/lib/tenant-limits";
import { logger } from "@/lib/logger";
```

Replace:

```ts
    const result = await prisma.$transaction(async (tx) => {
```

with:

```ts
    // One asset is created per received unit of an asset line, so the whole
    // receipt must fit into the organization's asset limit before anything is
    // written. A receipt without asset lines creates nothing and needs no room.
    const assetUnits = validated.items.reduce((sum, receiveItem) => {
      const requestItem = requestItems.find(
        (ri) => ri.id === receiveItem.itemId,
      );
      return requestItem?.entityType === "asset"
        ? sum + receiveItem.receivedQty
        : sum;
    }, 0);
    if (assetUnits > 0) {
      await requireAssetCapacity(orgId, assetUnits);
    }

    const result = await prisma.$transaction(async (tx) => {
```

- [ ] **Step 8: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/tenant-limits.test.ts src/app/api/__tests__/creator-limits.test.ts src/app/api/__tests__/asset-crud.test.ts src/app/api/__tests__/team-invite-create.test.ts src/app/api/__tests__/team-invite-accept.test.ts src/app/api/__tests__/import-row-errors.test.ts src/app/api/__tests__/import-user-privilege.test.ts src/app/api/__tests__/email-ownership-routes.test.ts src/app/api/__tests__/scim-users.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors. No caller of `checkAssetLimit` or `checkUserLimit` passes zero arguments any more: `grep -rn "checkAssetLimit()\|checkUserLimit()" src` prints nothing.

Run: `npx eslint src/lib/tenant-limits.ts src/app/api/asset src/app/api/import src/app/api/user/addUser src/app/api/team/invite "src/app/api/procurement/orders/[id]/receive"`
Expected: no output.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/tenant-limits.ts src/lib/__tests__/tenant-limits.test.ts src/app/api/asset/route.ts src/app/api/asset/addAsset/route.ts src/app/api/import/route.ts src/app/api/user/addUser/route.ts src/app/api/scim/v2/Users/route.ts src/app/api/team/invite/route.ts "src/app/api/team/invite/[token]/route.ts" "src/app/api/procurement/orders/[id]/receive/route.ts" src/app/api/__tests__/creator-limits.test.ts src/app/api/__tests__/asset-crud.test.ts src/app/api/__tests__/team-invite-create.test.ts src/app/api/__tests__/team-invite-accept.test.ts src/app/api/__tests__/import-row-errors.test.ts src/app/api/__tests__/import-user-privilege.test.ts src/app/api/__tests__/email-ownership-routes.test.ts src/app/api/__tests__/route-conventions.test.ts
git commit -m "feat: enforce asset and user limits from entitlements in every creator route"
```

- [ ] **Step 10: Update the developer docs and commit**

`docs/DEVELOPER_GUIDE.md` and `docs/DEVELOPMENT_NOTES.md` still describe the removed `max: -1` API. In `docs/DEVELOPER_GUIDE.md`, in the "Key Files" table, replace:

```markdown
| `src/lib/tenant-limits.ts` | Enforces `maxAssets` / `maxUsers` per org |
```

with:

```markdown
| `src/lib/tenant-limits.ts` | Enforces entitlement limits per org |
```

and, under "Tenant Limits", replace:

````markdown
```typescript
import { checkAssetLimit, checkUserLimit } from "@/lib/tenant-limits";

const limitCheck = await checkAssetLimit();
if (!limitCheck.allowed) {
  // Limit reached: limitCheck.current / limitCheck.max
}
```

A `max` value of `-1` means unlimited.
````

with:

````markdown
Limits come from the organization's entitlements (`maxAssets` / `maxUsers`) and apply in cloud mode only. Self-hosted deployments are never limited. A `max` of `null` means unlimited, and users count only while they are active.

```typescript
import { requireAssetCapacity } from "@/lib/tenant-limits";

// Before creating records, with the organization they are created in.
// Throws LimitError (403, code "limit_reached") when they do not fit, and
// ForbiddenError (403, code "organization_required") without an organization.
await requireAssetCapacity(orgId, rowCount);
```

Every function takes the organization explicitly; there is no session fallback.

- `requireAssetCapacity` / `requireUserCapacity` throw as above. Add the error handling with `apiErrorResponse` in the route.
- `checkAssetLimit` / `checkUserLimit` return `{ allowed, current, max }` without throwing, for callers that answer in their own format (SCIM, the SSO hook).
- `remainingCapacity(orgId, "assets" | "users")` returns the free room (`null` = unlimited) once, for sync loops that count down instead of checking per record.
````

In `docs/DEVELOPMENT_NOTES.md`, replace:

```markdown
- `src/lib/tenant-limits.ts` — Plan-based resource limit enforcement
```

with:

```markdown
- `src/lib/tenant-limits.ts` — Per-organization asset and user limits from entitlements
```

Run: `npx prettier --check docs/DEVELOPER_GUIDE.md docs/DEVELOPMENT_NOTES.md`
Expected: both files pass.

```bash
git add docs/DEVELOPER_GUIDE.md docs/DEVELOPMENT_NOTES.md
git commit -m "docs: describe the entitlement-based tenant limit helpers"
```
