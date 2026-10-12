### Task 7: API key use-time gate, advanced reports, TCO

Four surfaces get a server-side gate here: API keys at the moment they authenticate, `/api/reports/advanced`, `/api/dashboard/tco` and the scheduled `tco` report. The two report endpoints gate through the user that `requireApiAuth()` already loaded (no extra query). Callers without a request user (the scheduled-report cron) read the organization by id with a per-run memo.

**Files:**

- Modify: `src/lib/api-auth.ts` (`getAuthUser`, API-key branch only)
- Modify: `src/app/api/reports/advanced/route.ts`
- Modify: `src/app/api/dashboard/tco/route.ts`
- Modify: `src/app/api/report-schedules/route.ts` (POST, and PUT when it re-activates a `tco` schedule)
- Modify: `src/lib/scheduled-reports.ts`
- Modify: `src/components/dashboard/DashboardGrid.tsx` (`TCOWidget` only)
- Create: `src/components/dashboard/tco-widget-data.ts`
- Test: `src/lib/__tests__/api-auth-api-key-gate.test.ts` (create)
- Test: `src/app/api/__tests__/reports-advanced-scope.test.ts` (extend)
- Test: `src/app/api/__tests__/dashboard-tco.test.ts` (create)
- Test: `src/app/api/__tests__/report-schedules.test.ts` (create)
- Test: `src/lib/__tests__/scheduled-reports.test.ts` (create)
- Test: `src/components/dashboard/__tests__/tco-widget-data.test.ts` (create)

**Interfaces:**

- Consumes (Task 6): `requireFeature(user, feature)` from `@/lib/api-auth` (and its automock export); `allowsFeature` from `@/lib/entitlements-shared`; `getOrgAccess`, `getCachedOrgAccess`, `type OrgAccessCache` from `@/lib/org-access`. Consumes (Task 1): `EntitlementError`. Consumes (Task 2): `stubCloudMode()` from `tests/setup/cloud-mode.ts`.
- Produces: `loadTcoWidget(fetchImpl?: typeof fetch): Promise<TcoWidgetResult>` and `type TcoWidgetResult = { kind: "data"; data: TcoWidgetData } | { kind: "unavailable" } | { kind: "error" }` in `src/components/dashboard/tco-widget-data.ts`.
- `processScheduledReports()` resolves `{ processed, succeeded, failed, skipped }` (`skipped` is new; the cron route spreads the result into its JSON).
- No other signature changes. A `tco` schedule is judged when it falls due, so a revocation needs no write to the stored schedules.

Decisions for this task:

- The API-key gate runs through `requireFeature`, so it reads the entitlements `getAuthUser` already attached to the user (zero extra queries). A locked organization is skipped by the gate and answers `org_locked` from the guards, as before.
- The gate applies only to requests that authenticate with a key. Session users of the same organization keep the API key list and deletion in the admin UI (spec section 2: reads and deletes stay open).
- `PUT /api/report-schedules` cannot change `reportType`, so there is nothing to gate when "switching" the type. Re-activating an inactive `tco` schedule is configuration, so it requires the feature; deactivating and deleting stay open.
- The scheduled `tco` report of an organization-less user is judged like an organization-less user everywhere else: by `getOrgAccess(null)` (cloud: the new-organization entitlements; otherwise unrestricted).
- Review Focus 4 (revocation keeps data usable) and 1 (stale SaaS data in a deployment without a control plane) are pinned for the key gate by `api-auth-api-key-gate.test.ts`: browser sessions and the key list stay open, and restrictive stored entitlements are ignored outside cloud mode. The route gates are pinned the same way by the matrix test in Task 8, Part C.

#### Part A: API key use-time gate, advanced reports, TCO endpoint

- [ ] **Step 1: Write the failing tests**

The API-key gate gets its own test file. It runs the real `resolveOrgAccess` through `getAuthUser` (only `validateApiKey`, BetterAuth, RBAC and Prisma are mocked), so it exercises the entitlements that Task 6 attaches to the user.

Create `src/lib/__tests__/api-auth-api-key-gate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
}));
vi.mock("@/lib/super-admin", () => ({ isSuperAdmin: vi.fn() }));

import { headers } from "next/headers";
import { getAuthUser, requireApiAuth } from "@/lib/api-auth";
import { validateApiKey } from "@/lib/api-keys";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EntitlementError, ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);
const mockAuth = vi.mocked(auth, true);

const WITH_API_KEYS = { features: ["api_keys"], maxAssets: 100, maxUsers: 3 };
const WITHOUT_API_KEYS = {
  features: ["procurement"],
  maxAssets: 100,
  maxUsers: 3,
};

interface OrgOverrides {
  suspendedAt?: Date | null;
  lockedAt?: Date | null;
}

function orgRow(entitlements: unknown, overrides: OrgOverrides = {}) {
  return {
    isActive: true,
    suspendedAt: null,
    lockedAt: null,
    entitlements,
    ...overrides,
  };
}

function userRow(organization: ReturnType<typeof orgRow> | null) {
  return {
    userid: "user-1",
    username: "jdoe",
    firstname: "Jane",
    lastname: "Doe",
    email: "jane@example.com",
    isadmin: false,
    canrequest: true,
    organizationId: organization ? "org-1" : null,
    departmentId: null,
    isActive: true,
    organization,
  };
}

/** The request authenticates with an API key whose owner sits in `organization`. */
function useApiKey(organization: ReturnType<typeof orgRow> | null) {
  vi.mocked(headers).mockResolvedValue(
    new Headers({ authorization: "Bearer at_test_key" }),
  );
  vi.mocked(validateApiKey).mockResolvedValue({
    id: "key-1",
    scopes: ["asset:view"],
    user: userRow(organization),
  } as never);
}

/** The request authenticates with a browser session. */
function useSession(organization: ReturnType<typeof orgRow> | null) {
  vi.mocked(headers).mockResolvedValue(new Headers());
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue(userRow(organization) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCloudMode();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API key use-time gate (api_keys)", () => {
  it("accepts a key while the organization has API keys", async () => {
    useApiKey(orgRow(WITH_API_KEYS));

    const user = await requireApiAuth();

    expect(user.apiKeyId).toBe("key-1");
    expect(user.orgStatus).toBe("active");
  });

  it("refuses a key once the organization lost API keys", async () => {
    useApiKey(orgRow(WITHOUT_API_KEYS));

    const error = await getAuthUser().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EntitlementError);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({
      code: "feature_not_entitled",
      feature: "api_keys",
    });
  });

  it("applies the new-organization entitlements when none are stored", async () => {
    // stubCloudMode() configures NEW_ORG_ENTITLEMENTS without any feature.
    useApiKey(orgRow(null));

    await expect(requireApiAuth()).rejects.toMatchObject({
      code: "feature_not_entitled",
      feature: "api_keys",
    });
  });

  it("refuses the key of a user without an organization", async () => {
    useApiKey(null);

    await expect(requireApiAuth()).rejects.toMatchObject({
      code: "feature_not_entitled",
      feature: "api_keys",
    });
  });

  it("lets a locked organization answer org_locked instead of the entitlement denial", async () => {
    useApiKey(orgRow(WITHOUT_API_KEYS, { lockedAt: new Date() }));

    await expect(requireApiAuth()).rejects.toMatchObject({
      code: "org_locked",
    });
  });

  it("keeps the key of a read-only organization working while it has API keys", async () => {
    useApiKey(orgRow(WITH_API_KEYS, { suspendedAt: new Date() }));

    const user = await requireApiAuth();

    expect(user.orgStatus).toBe("read_only");
    expect(user.apiKeyId).toBe("key-1");
  });

  it("ignores restrictive stored entitlements outside cloud mode", async () => {
    vi.unstubAllEnvs();
    useApiKey(orgRow(WITHOUT_API_KEYS));

    const user = await requireApiAuth();

    expect(user.apiKeyId).toBe("key-1");
  });

  it("does not gate browser sessions, so the key list and deletion stay open", async () => {
    useSession(orgRow(WITHOUT_API_KEYS));

    const user = await requireApiAuth();

    expect(user.id).toBe("user-1");
    expect(user.apiKeyId).toBeUndefined();
  });

  it("still answers Unauthorized for a key that does not validate", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );
    vi.mocked(validateApiKey).mockResolvedValue(null);

    await expect(requireApiAuth()).rejects.toThrow("Unauthorized");
  });
});
```

In `src/app/api/__tests__/reports-advanced-scope.test.ts`, replace:

```ts
import { GET } from "@/app/api/reports/advanced/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
```

with:

```ts
import { GET } from "@/app/api/reports/advanced/route";
import prisma from "@/lib/prisma";
import { requireFeature } from "@/lib/api-auth";
import { EntitlementError } from "@/lib/errors";
import { getOrganizationContext } from "@/lib/organization-context";
```

Append to `src/app/api/__tests__/reports-advanced-scope.test.ts`:

```ts
describe("GET /api/reports/advanced feature gate", () => {
  it("requires advanced_reports for the authenticated user", async () => {
    await GET();

    expect(requireFeature).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-uuid-001" }),
      "advanced_reports",
    );
  });

  it("answers 403 with a machine-readable code and reads nothing", async () => {
    vi.mocked(requireFeature).mockRejectedValueOnce(
      new EntitlementError("advanced_reports"),
    );

    const { status, body } = await parseResponse<{
      error: string;
      code: string;
      feature: string;
    }>(await GET());

    expect(status).toBe(403);
    expect(body).toMatchObject({
      code: "feature_not_entitled",
      feature: "advanced_reports",
    });
    expect(body.error).toContain("not available for your organization");
    expect(getOrganizationContext).not.toHaveBeenCalled();
    expect(mockPrisma.asset.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.depreciation_settings.findMany).not.toHaveBeenCalled();
  });
});
```

Create `src/app/api/__tests__/dashboard-tco.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseResponse } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/cache", () => ({
  cached: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) =>
    fetcher(),
  ),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
}));

import { GET } from "@/app/api/dashboard/tco/route";
import prisma from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { requireFeature } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { EntitlementError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const ORG = "org-uuid-001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireFeature).mockResolvedValue(undefined);
  vi.mocked(getOrganizationContext).mockResolvedValue({
    organization: { id: ORG },
  } as never);
  mockPrisma.licence.aggregate.mockResolvedValue({
    _sum: { purchaseprice: null },
  } as never);
});

describe("GET /api/dashboard/tco feature gate", () => {
  it("answers the summary when the feature is granted", async () => {
    const { status, body } = await parseResponse<{ grandTotal: number }>(
      await GET(),
    );

    expect(status).toBe(200);
    expect(body.grandTotal).toBe(0);
    expect(requireFeature).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG }),
      "tco_dashboard",
    );
    expect(cached).toHaveBeenCalledWith(
      `tco_dashboard:${ORG}`,
      expect.any(Function),
      expect.any(Number),
    );
  });

  it("denies before the per-organization cache is read", async () => {
    vi.mocked(requireFeature).mockRejectedValueOnce(
      new EntitlementError("tco_dashboard"),
    );

    const { status, body } = await parseResponse<{
      code: string;
      feature: string;
    }>(await GET());

    expect(status).toBe(403);
    expect(body).toMatchObject({
      code: "feature_not_entitled",
      feature: "tco_dashboard",
    });
    expect(cached).not.toHaveBeenCalled();
    expect(mockPrisma.asset.groupBy).not.toHaveBeenCalled();
  });

  it("runs the gate before the cache lookup", async () => {
    await GET();

    const gate = vi.mocked(requireFeature).mock.invocationCallOrder[0];
    const lookup = vi.mocked(cached).mock.invocationCallOrder[0];
    expect(gate).toBeLessThan(lookup);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/api-auth-api-key-gate.test.ts src/app/api/__tests__/reports-advanced-scope.test.ts src/app/api/__tests__/dashboard-tco.test.ts`
Expected: FAIL. The key of an organization without API keys is still accepted (the "refuses" cases resolve), and `requireFeature` is never called by the two report routes.

- [ ] **Step 3: Gate the API-key branch of `getAuthUser`**

In `src/lib/api-auth.ts`, replace:

```ts
const apiKey = await getApiKeyFromHeaders();
if (apiKey) {
  const user = await authenticateWithApiKey(apiKey);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
```

with:

```ts
const apiKey = await getApiKeyFromHeaders();
if (apiKey) {
  const user = await authenticateWithApiKey(apiKey);
  if (!user) {
    throw new UnauthorizedError();
  }
  // Use-time gate: a key works only while its organization is entitled to
  // API keys. A locked organization is skipped here so the guards answer
  // org_locked. Browser sessions are never gated, which keeps the key list
  // and key deletion reachable in the admin UI after a revocation.
  if (user.orgStatus !== "locked_out") {
    await requireFeature(user, "api_keys");
  }
  return user;
}
```

`requireFeature` is a function declaration in the same module (Task 6), so it is hoisted and needs no new import.

- [ ] **Step 4: Gate the two report endpoints**

In `src/app/api/reports/advanced/route.ts`, replace:

```ts
import { requireApiAuth } from "@/lib/api-auth";
```

with:

```ts
import { requireApiAuth, requireFeature } from "@/lib/api-auth";
```

and replace:

```ts
await requireApiAuth();
const orgCtx = await getOrganizationContext();
const orgId = orgCtx?.organization?.id;
const orgScope = scopeToOrganization({}, orgId);
```

with:

```ts
const user = await requireApiAuth();
await requireFeature(user, "advanced_reports");
const orgCtx = await getOrganizationContext();
const orgId = orgCtx?.organization?.id;
const orgScope = scopeToOrganization({}, orgId);
```

In `src/app/api/dashboard/tco/route.ts`, replace:

```ts
import { requireApiAuth } from "@/lib/api-auth";
```

with:

```ts
import { requireApiAuth, requireFeature } from "@/lib/api-auth";
```

and replace:

```ts
await requireApiAuth();
const orgCtx = await getOrganizationContext();
const orgId = orgCtx?.organization?.id;

const cacheKey = `tco_dashboard:${orgId ?? "global"}`;
```

with:

```ts
const user = await requireApiAuth();
// Before the cache: the entry is keyed per organization and would
// otherwise keep serving cached totals to an organization that lost the
// feature.
await requireFeature(user, "tco_dashboard");
const orgCtx = await getOrganizationContext();
const orgId = orgCtx?.organization?.id;

const cacheKey = `tco_dashboard:${orgId ?? "global"}`;
```

- [ ] **Step 5: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/api-auth-api-key-gate.test.ts src/lib/__tests__/api-auth.test.ts src/app/api/__tests__/reports-advanced-scope.test.ts src/app/api/__tests__/dashboard-tco.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/api-auth.ts src/app/api/reports/advanced/route.ts src/app/api/dashboard/tco/route.ts src/lib/__tests__/api-auth-api-key-gate.test.ts src/app/api/__tests__/reports-advanced-scope.test.ts src/app/api/__tests__/dashboard-tco.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-auth.ts src/app/api/reports/advanced/route.ts src/app/api/dashboard/tco/route.ts src/lib/__tests__/api-auth-api-key-gate.test.ts src/app/api/__tests__/reports-advanced-scope.test.ts src/app/api/__tests__/dashboard-tco.test.ts
git commit -m "feat: gate API key use, advanced reports and TCO by entitlement"
```

#### Part B: scheduled TCO reports and the dashboard widget

- [ ] **Step 7: Write the failing tests**

Create `src/app/api/__tests__/report-schedules.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));
vi.mock("@/lib/scheduled-reports", () => ({
  computeNextRunAt: vi.fn(() => new Date("2026-10-19T00:00:00.000Z")),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/report-schedules/route";
import prisma from "@/lib/prisma";
import { requireFeature } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { EntitlementError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const USER_ID = "user-uuid-001";
const ORG_ID = "org-uuid-001";

const post = (reportType: string) =>
  POST(
    createMockRequest("/api/report-schedules", {
      method: "POST",
      body: { reportType, frequency: "weekly", format: "csv" },
    }),
  );

const put = (body: Record<string, unknown>) =>
  PUT(createMockRequest("/api/report-schedules", { method: "PUT", body }));

const schedule = (reportType: string) => ({
  id: "sched-1",
  userId: USER_ID,
  reportType,
  isActive: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireFeature).mockResolvedValue(undefined);
  vi.mocked(getOrganizationContext).mockResolvedValue({
    userId: USER_ID,
    organization: { id: ORG_ID },
  } as never);
  mockPrisma.reportSchedule.findFirst.mockResolvedValue(null);
  mockPrisma.reportSchedule.create.mockResolvedValue({
    id: "sched-new",
  } as never);
  mockPrisma.reportSchedule.update.mockResolvedValue({
    id: "sched-1",
  } as never);
});

describe("POST /api/report-schedules", () => {
  it("requires tco_dashboard to subscribe to the TCO report", async () => {
    const res = await post("tco");

    expect(res.status).toBe(201);
    expect(requireFeature).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      "tco_dashboard",
    );
  });

  it("denies the TCO subscription without the feature and creates nothing", async () => {
    vi.mocked(requireFeature).mockRejectedValueOnce(
      new EntitlementError("tco_dashboard"),
    );

    const { status, body } = await parseResponse<{
      code: string;
      feature: string;
    }>(await post("tco"));

    expect(status).toBe(403);
    expect(body).toMatchObject({
      code: "feature_not_entitled",
      feature: "tco_dashboard",
    });
    expect(mockPrisma.reportSchedule.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.reportSchedule.create).not.toHaveBeenCalled();
  });

  it.each(["summary", "depreciation", "warranty"])(
    "does not gate the %s report",
    async (reportType) => {
      const res = await post(reportType);

      expect(res.status).toBe(201);
      expect(requireFeature).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid body with 400 before any gate", async () => {
    const res = await post("quarterly");

    expect(res.status).toBe(400);
    expect(requireFeature).not.toHaveBeenCalled();
  });
});

describe("PUT /api/report-schedules", () => {
  it("requires tco_dashboard to re-activate a TCO schedule", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue(
      schedule("tco") as never,
    );
    vi.mocked(requireFeature).mockRejectedValueOnce(
      new EntitlementError("tco_dashboard"),
    );

    const res = await put({ id: "sched-1", isActive: true });

    expect(res.status).toBe(403);
    expect(requireFeature).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      "tco_dashboard",
    );
    expect(mockPrisma.reportSchedule.update).not.toHaveBeenCalled();
  });

  it("lets a TCO schedule be deactivated without the feature", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue({
      ...schedule("tco"),
      isActive: true,
    } as never);

    const res = await put({ id: "sched-1", isActive: false });

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
    expect(mockPrisma.reportSchedule.update).toHaveBeenCalled();
  });

  it("does not gate a frequency change that keeps a TCO schedule inactive", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue(
      schedule("tco") as never,
    );

    const res = await put({ id: "sched-1", frequency: "daily" });

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
  });

  it("does not gate re-activating another report type", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue(
      schedule("summary") as never,
    );

    const res = await put({ id: "sched-1", isActive: true });

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
  });
});

describe("listing and deleting schedules stay open", () => {
  it("does not gate GET", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
  });

  it("does not gate DELETE", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue(
      schedule("tco") as never,
    );

    const res = await DELETE(
      createMockRequest("/api/report-schedules?id=sched-1", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
  });
});
```

Create `src/lib/__tests__/scheduled-reports.test.ts`. The `@/lib/org-access` fake follows the contract Task 6 documents (`getCachedOrgAccess` memoises one read per organization in the given cache), so the test counts reads through `getOrgAccess` without depending on how Task 6 queries the database:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));
vi.mock("@/lib/report-generator", () => ({ generateReportBuffer: vi.fn() }));
vi.mock("@/lib/org-access", () => {
  const getOrgAccess = vi.fn();
  return {
    getOrgAccess,
    // Same contract as the real helper: one read per organization and cache.
    getCachedOrgAccess: (
      organizationId: string,
      cache: Map<string, Promise<unknown>>,
    ) => {
      const existing = cache.get(organizationId);
      if (existing) return existing;
      const pending = getOrgAccess(organizationId);
      cache.set(organizationId, pending);
      return pending;
    },
  };
});

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { queueEmail } from "@/lib/email";
import { generateReportBuffer } from "@/lib/report-generator";
import { getOrgAccess } from "@/lib/org-access";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";
import { processScheduledReports } from "@/lib/scheduled-reports";

const mockPrisma = vi.mocked(prisma, true);
const mockAccess = vi.mocked(getOrgAccess);
const mockGenerate = vi.mocked(generateReportBuffer);
const mockQueueEmail = vi.mocked(queueEmail);

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function access(features: readonly GatedFeature[]) {
  return {
    status: "active" as const,
    entitlements: { features: [...features], maxAssets: null, maxUsers: null },
  };
}

function due(
  id: string,
  reportType: string,
  organizationId: string | null,
  userOverrides: Partial<{ isActive: boolean; email: string | null }> = {},
) {
  return {
    id,
    reportType,
    format: "csv",
    frequency: "weekly",
    organizationId,
    user: {
      userid: "user-1",
      firstname: "Jane",
      lastname: "Doe",
      email: "jane@example.com",
      isActive: true,
      ...userOverrides,
    },
  };
}

function givenDue(...schedules: ReturnType<typeof due>[]) {
  mockPrisma.reportSchedule.findMany.mockResolvedValue(schedules as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.mockResolvedValue(access(GATED_FEATURES));
  mockGenerate.mockResolvedValue({
    buffer: Buffer.from("a,b"),
    mimeType: "text/csv",
    extension: "csv",
    filename: "report.csv",
  });
  mockPrisma.reportSchedule.update.mockResolvedValue({} as never);
});

describe("processScheduledReports TCO entitlement", () => {
  it("skips a TCO schedule of an organization without tco_dashboard", async () => {
    mockAccess.mockResolvedValue(access(["advanced_reports"]));
    givenDue(due("sched-1", "tco", ORG_A));

    const result = await processScheduledReports();

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQueueEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 0,
      skipped: 1,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipped scheduled TCO report"),
      expect.objectContaining({ scheduleId: "sched-1", organizationId: ORG_A }),
    );
  });

  it("advances the skipped schedule so it is not due again at once", async () => {
    mockAccess.mockResolvedValue(access([]));
    givenDue(due("sched-1", "tco", ORG_A));

    await processScheduledReports();

    expect(mockPrisma.reportSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: { nextRunAt: expect.any(Date) },
    });
  });

  it("sends the TCO report of an organization that has the feature", async () => {
    mockAccess.mockResolvedValue(access(["tco_dashboard"]));
    givenDue(due("sched-1", "tco", ORG_A));

    const result = await processScheduledReports();

    expect(mockGenerate).toHaveBeenCalledWith("tco", "csv", ORG_A);
    expect(mockQueueEmail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ succeeded: 1, skipped: 0 });
  });

  it("does not look at the entitlements of other report types", async () => {
    mockAccess.mockResolvedValue(access([]));
    givenDue(
      due("sched-1", "summary", ORG_A),
      due("sched-2", "warranty", ORG_A),
    );

    const result = await processScheduledReports();

    expect(mockAccess).not.toHaveBeenCalled();
    expect(result).toMatchObject({ succeeded: 2, skipped: 0 });
  });

  it("reads each organization once per run", async () => {
    mockAccess.mockResolvedValue(access([]));
    givenDue(
      due("sched-1", "tco", ORG_A),
      due("sched-2", "tco", ORG_A),
      due("sched-3", "tco", ORG_B),
    );

    const result = await processScheduledReports();

    expect(mockAccess).toHaveBeenCalledTimes(2);
    expect(mockAccess).toHaveBeenNthCalledWith(1, ORG_A);
    expect(mockAccess).toHaveBeenNthCalledWith(2, ORG_B);
    expect(result.skipped).toBe(3);
  });

  it("judges a TCO schedule without an organization by the null-organization access", async () => {
    mockAccess.mockResolvedValue(access([]));
    givenDue(due("sched-1", "tco", null));

    const result = await processScheduledReports();

    expect(mockAccess).toHaveBeenCalledWith(null);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("fails closed when the entitlement read fails", async () => {
    mockAccess.mockRejectedValue(new Error("connection refused"));
    givenDue(due("sched-1", "tco", ORG_A));

    const result = await processScheduledReports();

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQueueEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ failed: 1, skipped: 0 });
  });

  it("counts a schedule of an inactive user as skipped", async () => {
    givenDue(due("sched-1", "summary", ORG_A, { isActive: false }));

    const result = await processScheduledReports();

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      succeeded: 0,
      failed: 0,
      skipped: 1,
    });
  });
});
```

Create `src/components/dashboard/__tests__/tco-widget-data.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { loadTcoWidget } from "@/components/dashboard/tco-widget-data";

const totals = {
  totalPurchaseCost: 1000,
  totalMaintenanceCost: 200,
  totalLicenceCost: 300,
  grandTotal: 1500,
  byCategory: [],
};

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    Response.json(body, { status }),
  ) as unknown as typeof fetch;
}

describe("loadTcoWidget", () => {
  it("returns the totals of a successful answer", async () => {
    const result = await loadTcoWidget(respond(totals));

    expect(result).toEqual({ kind: "data", data: totals });
  });

  it("calls the TCO endpoint", async () => {
    const fetchImpl = respond(totals);

    await loadTcoWidget(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("/api/dashboard/tco");
  });

  it("reports an entitlement denial as unavailable and never reads its body as data", async () => {
    const result = await loadTcoWidget(
      respond({ error: "Forbidden", code: "feature_not_entitled" }, 403),
    );

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("reports a server error as unavailable", async () => {
    const result = await loadTcoWidget(respond({ error: "boom" }, 500));

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("reports a 200 answer without the totals as an error", async () => {
    const result = await loadTcoWidget(respond({ error: "odd" }));

    expect(result).toEqual({ kind: "error" });
  });

  it("reports a network failure as an error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await loadTcoWidget(fetchImpl);

    expect(result).toEqual({ kind: "error" });
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/report-schedules.test.ts src/lib/__tests__/scheduled-reports.test.ts src/components/dashboard/__tests__/tco-widget-data.test.ts`
Expected: FAIL. `requireFeature` is not called by the schedule routes, `processScheduledReports` has no `skipped` field and still sends the TCO report, and `tco-widget-data` does not exist.

- [ ] **Step 9: Gate the schedule routes**

In `src/app/api/report-schedules/route.ts`, replace:

```ts
import { requireApiAuth, requireWritableOrg } from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAuth,
  requireFeature,
  requireWritableOrg,
} from "@/lib/api-auth";
```

In the same file, replace:

```ts
const { reportType, frequency, format } = validation.data;

// Prevent duplicate subscriptions
```

with:

```ts
const { reportType, frequency, format } = validation.data;

// The TCO report carries TCO data, so subscribing needs the feature.
if (reportType === "tco") {
  await requireFeature(user, "tco_dashboard");
}

// Prevent duplicate subscriptions
```

and replace:

```ts
if (!existing) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const updateData: Record<string, unknown> = {};
```

with:

```ts
if (!existing) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Switching a TCO schedule back on is configuration; switching it off
// stays possible without the feature.
if (isActive === true && existing.reportType === "tco") {
  await requireFeature(user, "tco_dashboard");
}

const updateData: Record<string, unknown> = {};
```

- [ ] **Step 10: Skip TCO schedules of organizations without the feature**

In `src/lib/scheduled-reports.ts`, replace:

```ts
import { generateReportBuffer, type ReportType } from "@/lib/report-generator";
import { logger } from "@/lib/logger";

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}
```

with:

```ts
import { generateReportBuffer, type ReportType } from "@/lib/report-generator";
import { allowsFeature } from "@/lib/entitlements-shared";
import {
  getCachedOrgAccess,
  getOrgAccess,
  type OrgAccessCache,
} from "@/lib/org-access";
import { logger } from "@/lib/logger";

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  /** Due schedules that were moved on without sending a report. */
  skipped: number;
}

/**
 * A TCO report carries TCO data, so it follows the organization's
 * tco_dashboard entitlement. A schedule without an organization is judged like
 * an organization-less user everywhere else: by the null-organization access.
 */
async function mayReceiveTcoReport(
  organizationId: string | null,
  cache: OrgAccessCache,
): Promise<boolean> {
  const access = organizationId
    ? await getCachedOrgAccess(organizationId, cache)
    : await getOrgAccess(null);
  return allowsFeature(access.entitlements, "tco_dashboard");
}
```

Replace:

```ts
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    processed++;

    // Skip if user is inactive or has no email
    if (!schedule.user.isActive || !schedule.user.email) {
      await updateNextRun(schedule.id, schedule.frequency, now);
      continue;
    }

    try {
      const reportBuffer = await generateReportBuffer(
```

with:

```ts
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  // One entitlement read per organization for the whole run.
  const accessCache: OrgAccessCache = new Map();

  for (const schedule of dueSchedules) {
    processed++;

    // Skip if user is inactive or has no email
    if (!schedule.user.isActive || !schedule.user.email) {
      await updateNextRun(schedule.id, schedule.frequency, now);
      skipped++;
      continue;
    }

    try {
      if (
        schedule.reportType === "tco" &&
        !(await mayReceiveTcoReport(schedule.organizationId, accessCache))
      ) {
        logger.warn("Skipped scheduled TCO report: feature not available", {
          scheduleId: schedule.id,
          organizationId: schedule.organizationId,
        });
        await updateNextRun(schedule.id, schedule.frequency, now);
        skipped++;
        continue;
      }

      const reportBuffer = await generateReportBuffer(
```

Replace:

```ts
if (processed > 0) {
  logger.info("Scheduled reports processing complete", {
    processed,
    succeeded,
    failed,
  });
}

return { processed, succeeded, failed };
```

with:

```ts
if (processed > 0) {
  logger.info("Scheduled reports processing complete", {
    processed,
    succeeded,
    failed,
    skipped,
  });
}

return { processed, succeeded, failed, skipped };
```

- [ ] **Step 11: Make the dashboard widget survive a denied answer**

Create `src/components/dashboard/tco-widget-data.ts`:

```ts
/**
 * Data loading for the dashboard TCO widget. The TCO endpoint is gated per
 * organization, so a non-2xx answer is a normal outcome. Its body is an error
 * object, which is truthy: reading it as totals would crash the widget while
 * formatting `undefined`.
 */

export interface TcoWidgetData {
  totalPurchaseCost: number;
  totalMaintenanceCost: number;
  totalLicenceCost: number;
  grandTotal: number;
}

export type TcoWidgetResult =
  | { kind: "data"; data: TcoWidgetData }
  | { kind: "unavailable" }
  | { kind: "error" };

const TOTAL_KEYS = [
  "totalPurchaseCost",
  "totalMaintenanceCost",
  "totalLicenceCost",
  "grandTotal",
] as const;

function isTcoWidgetData(value: unknown): value is TcoWidgetData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return TOTAL_KEYS.every((key) => typeof record[key] === "number");
}

export async function loadTcoWidget(
  fetchImpl: typeof fetch = fetch,
): Promise<TcoWidgetResult> {
  try {
    const res = await fetchImpl("/api/dashboard/tco");
    if (!res.ok) return { kind: "unavailable" };
    const body: unknown = await res.json();
    return isTcoWidgetData(body)
      ? { kind: "data", data: body }
      : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
```

In `src/components/dashboard/DashboardGrid.tsx`, replace:

```tsx
import { WIDGET_DEFINITIONS } from "./WidgetRegistry";
```

with:

```tsx
import { WIDGET_DEFINITIONS } from "./WidgetRegistry";
import { loadTcoWidget, type TcoWidgetResult } from "./tco-widget-data";
```

and replace:

```tsx
function TCOWidget() {
  const [data, setData] = useState<{
    totalPurchaseCost: number;
    totalMaintenanceCost: number;
    totalLicenceCost: number;
    grandTotal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/tco")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading TCO data...</p>;
  }

  if (!data) {
    return (
      <p className="text-muted-foreground text-sm">No TCO data available</p>
    );
  }

  const fmt = (v: number) =>
```

with:

```tsx
function TCOWidget() {
  const [result, setResult] = useState<TcoWidgetResult | null>(null);

  useEffect(() => {
    loadTcoWidget().then(setResult);
  }, []);

  if (!result) {
    return <p className="text-muted-foreground text-sm">Loading TCO data...</p>;
  }

  if (result.kind === "unavailable") {
    return (
      <p className="text-muted-foreground text-sm">
        Not available for your organization
      </p>
    );
  }

  if (result.kind === "error") {
    return (
      <p className="text-muted-foreground text-sm">No TCO data available</p>
    );
  }

  const data = result.data;

  const fmt = (v: number) =>
```

- [ ] **Step 12: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/app/api/__tests__/report-schedules.test.ts src/lib/__tests__/scheduled-reports.test.ts src/components/dashboard/__tests__/tco-widget-data.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/app/api/report-schedules/route.ts src/lib/scheduled-reports.ts src/components/dashboard/DashboardGrid.tsx src/components/dashboard/tco-widget-data.ts src/app/api/__tests__/report-schedules.test.ts src/lib/__tests__/scheduled-reports.test.ts src/components/dashboard/__tests__/tco-widget-data.test.ts`
Expected: no errors.

This task changes `api-auth.ts`, which every route test imports, so run the whole suite before committing: `npx vitest run`
Expected: PASS (DB tests skipped locally).

- [ ] **Step 13: Commit**

```bash
git add src/app/api/report-schedules/route.ts src/lib/scheduled-reports.ts src/components/dashboard/DashboardGrid.tsx src/components/dashboard/tco-widget-data.ts src/app/api/__tests__/report-schedules.test.ts src/lib/__tests__/scheduled-reports.test.ts src/components/dashboard/__tests__/tco-widget-data.test.ts
git commit -m "feat: skip scheduled TCO reports and harden the TCO widget for gated orgs"
```
