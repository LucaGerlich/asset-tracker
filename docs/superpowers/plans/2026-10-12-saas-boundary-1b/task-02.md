### Task 2: Cloud mode switch

`isCloudMode()` (`CONTROL_PLANE_SECRET` set) replaces `isSelfHosted()` everywhere in one commit: removing the old function forces every reader to move together, and the registration, webhook and trial changes follow the same switch.

**The default flips here.** Until now an unset `SELF_HOSTED` meant the enforcing hosted path. From this commit an unset `CONTROL_PLANE_SECRET` means self-hosted: status always `active`, limits unlimited, no lock redirect, no trial. A hosted deployment must have `CONTROL_PLANE_SECRET` in its environment before it runs this code (Global Constraints). No test relies on a global default: a test that needs hosted behaviour calls `stubCloudMode()` and `vi.unstubAllEnvs()` in `afterEach`.

**Files:**

- Create: `tests/setup/cloud-mode.ts`, `src/lib/__tests__/deployment-mode.test.ts`
- Modify: `src/lib/deployment-mode.ts` (rewritten), `src/lib/org-suspension.ts`, `src/lib/org-lock-redirect.ts`, `src/lib/tenant-limits.ts` (temporary; Task 10 rewrites it), `src/lib/plan-features.ts` (temporary; Task 6 removes its caller), `src/lib/sso-provisioning.ts` (temporary; Task 11 rewrites the check), `src/lib/env-validation.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/app/api/cron/check-trials/route.ts`
- Test (update): `src/lib/__tests__/org-suspension.test.ts`, `org-lock-redirect.test.ts`, `sso-provisioning.test.ts`, `tenant-limits.test.ts`, `env-validation.test.ts`, `src/app/api/__tests__/billing-webhook.test.ts`, `billing-checkout.test.ts`, `billing-portal.test.ts`, `check-trials.test.ts` (created by phase 1a, rewritten here), `auth-register.test.ts`
- Checked, no change needed: `api-auth.test.ts`, `scim-users.test.ts`, `workflow-engine.test.ts` and `proxy-service-worker.test.ts` mock `org-suspension` or `org-lock-redirect` themselves and never read the mode.
- Left to Task 3: `src/app/admin/settings/page.tsx`, `src/lib/feature-flags.ts` and the marketing pages.

**Interfaces:**

- Produces in `src/lib/deployment-mode.ts`: `isCloudMode(): boolean` (`Boolean(process.env.CONTROL_PLANE_SECRET)`); `isBillingEnabled(): boolean` (`isCloudMode() && (Boolean(process.env.BILLING_URL) || isLegacyBillingActive())`). `isSelfHosted` is removed; `SELF_HOSTED` is no longer read anywhere.
- Produces in `tests/setup/cloud-mode.ts`: `TEST_CONTROL_PLANE_SECRET` (a fixed 48-character string), `TEST_NEW_ORG_ENTITLEMENTS: Entitlements` (`{ features: [], maxAssets: 100, maxUsers: 3 }`), `TEST_SUPER_ADMIN_EMAIL = "operator@example.com"`, `stubCloudMode(): void` (stubs `CONTROL_PLANE_SECRET`, `NEW_ORG_ENTITLEMENTS` as JSON and `SUPER_ADMIN_EMAILS`).
- Consumes: `isLegacyBillingActive`, `legacyPlanToEntitlements` from `src/lib/legacy-billing.ts` (phase 1a).
- Behaviour decided here: register in cloud mode with legacy billing starts the professional trial and records its entitlements; in cloud mode without legacy billing it writes no trial fields (Task 13 adds `NEW_ORG_ENTITLEMENTS`); outside cloud mode it writes `{ maxAssets: -1, maxUsers: -1 }` and no entitlements. While legacy billing is inactive (`STRIPE_SECRET_KEY` unset) the Stripe webhook answers 404 and `check-trials` does nothing.

- [ ] **Step 1: Create the test helper**

Create `tests/setup/cloud-mode.ts`:

```ts
import { vi } from "vitest";
import type { Entitlements } from "@/lib/entitlements-shared";

/**
 * Test helpers for cloud mode.
 *
 * Without CONTROL_PLANE_SECRET the code under test is self-hosted: every
 * feature is allowed, limits are unlimited and no organization is ever
 * suspended. A test that needs the hosted behaviour calls stubCloudMode() and
 * restores the environment with vi.unstubAllEnvs() in afterEach. There is no
 * global default, so a test reads as what it exercises.
 */

/** A fixed 48-character secret; never a real credential. */
export const TEST_CONTROL_PLANE_SECRET =
  "test-control-plane-secret-0123456789-abcdefghijk";

/** What a new organization gets in cloud-mode tests. */
export const TEST_NEW_ORG_ENTITLEMENTS: Entitlements = {
  features: [],
  maxAssets: 100,
  maxUsers: 3,
};

export const TEST_SUPER_ADMIN_EMAIL = "operator@example.com";

/** Puts the process into cloud mode with a valid control-plane configuration. */
export function stubCloudMode(): void {
  vi.stubEnv("CONTROL_PLANE_SECRET", TEST_CONTROL_PLANE_SECRET);
  vi.stubEnv("NEW_ORG_ENTITLEMENTS", JSON.stringify(TEST_NEW_ORG_ENTITLEMENTS));
  vi.stubEnv("SUPER_ADMIN_EMAILS", TEST_SUPER_ADMIN_EMAIL);
}
```

- [ ] **Step 2: Write the failing tests**

The new unit test for the switch:

Create `src/lib/__tests__/deployment-mode.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isBillingEnabled, isCloudMode } from "@/lib/deployment-mode";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

beforeEach(() => {
  // Hermetic: nothing from the developer's shell may leak into these cases.
  for (const name of [
    "CONTROL_PLANE_SECRET",
    "BILLING_URL",
    "STRIPE_SECRET_KEY",
    "SELF_HOSTED",
  ]) {
    vi.stubEnv(name, "");
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCloudMode", () => {
  it("is false by default: a self-hoster sets nothing", () => {
    expect(isCloudMode()).toBe(false);
  });

  it("is true while CONTROL_PLANE_SECRET is set", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", TEST_CONTROL_PLANE_SECRET);
    expect(isCloudMode()).toBe(true);
  });

  it("is false for an empty secret", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
    expect(isCloudMode()).toBe(false);
  });

  it("ignores the deprecated SELF_HOSTED variable in both directions", () => {
    vi.stubEnv("SELF_HOSTED", "true");
    expect(isCloudMode()).toBe(false);

    stubCloudMode();
    vi.stubEnv("SELF_HOSTED", "false");
    expect(isCloudMode()).toBe(true);
    vi.stubEnv("SELF_HOSTED", "true");
    expect(isCloudMode()).toBe(true);
  });
});

describe("stubCloudMode", () => {
  it("uses a secret that satisfies the 32 character minimum", () => {
    expect(TEST_CONTROL_PLANE_SECRET).toHaveLength(48);
  });

  it("switches cloud mode on and unstubAllEnvs switches it off again", () => {
    stubCloudMode();
    expect(isCloudMode()).toBe(true);
    expect(process.env.SUPER_ADMIN_EMAILS).toBe("operator@example.com");
    expect(JSON.parse(process.env.NEW_ORG_ENTITLEMENTS ?? "")).toEqual({
      features: [],
      maxAssets: 100,
      maxUsers: 3,
    });

    vi.unstubAllEnvs();
    expect(process.env.CONTROL_PLANE_SECRET).toBeUndefined();
    expect(isCloudMode()).toBe(false);
  });
});

describe("isBillingEnabled", () => {
  it("is false when self-hosted, even with billing configured", () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(isBillingEnabled()).toBe(false);
  });

  it("is false in cloud mode with no billing configured", () => {
    stubCloudMode();
    expect(isBillingEnabled()).toBe(false);
  });

  it("is true in cloud mode with the control plane's BILLING_URL", () => {
    stubCloudMode();
    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    expect(isBillingEnabled()).toBe(true);
  });

  it("is true in cloud mode while legacy billing is active", () => {
    stubCloudMode();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(isBillingEnabled()).toBe(true);
  });

  it("treats empty values as unset", () => {
    stubCloudMode();
    vi.stubEnv("BILLING_URL", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(isBillingEnabled()).toBe(false);
  });
});
```

Then update the existing tests. Every `delete process.env.SELF_HOSTED` goes away, mocks of `@/lib/deployment-mode` expose `isCloudMode`, and tests that relied on "unset means enforcing" call `stubCloudMode()`.

In `src/lib/__tests__/org-suspension.test.ts`:

Replace:

```ts
vi.mock("@/lib/deployment-mode", () => ({
  isSelfHosted: vi.fn().mockReturnValue(false),
}));
```

with:

```ts
vi.mock("@/lib/deployment-mode", () => ({
  isCloudMode: vi.fn().mockReturnValue(true),
}));
```

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `const mockIsSelfHosted = vi.mocked(isSelfHosted);` with `const mockIsCloudMode = vi.mocked(isCloudMode);`.

Replace:

```ts
mockIsSelfHosted.mockReturnValue(false);
vi.useFakeTimers();
```

with:

```ts
mockIsCloudMode.mockReturnValue(true);
vi.useFakeTimers();
```

Replace:

```ts
    mockIsSelfHosted.mockReturnValue(true);
    expect(resolveOrgStatus({ isActive: false, suspendedAt: null })).toBe(
      "active",
    );
  });
```

with:

```ts
    mockIsCloudMode.mockReturnValue(false);
    expect(resolveOrgStatus({ isActive: false, suspendedAt: null })).toBe(
      "active",
    );
  });

  it("stays active in self-hosted mode for a long-suspended organization", () => {
    // A database restored from the hosted service must never lock a self-hoster out.
    mockIsCloudMode.mockReturnValue(false);
    expect(
      resolveOrgStatus({
        isActive: false,
        suspendedAt: new Date(NOW.getTime() - 400 * DAY_MS),
      }),
    ).toBe("active");
  });
```

Replace:

```ts
    mockIsSelfHosted.mockReturnValue(true);
    mockPrisma.organization.findUnique.mockResolvedValue({
```

with:

```ts
    mockIsCloudMode.mockReturnValue(false);
    mockPrisma.organization.findUnique.mockResolvedValue({
```

In `src/lib/__tests__/org-lock-redirect.test.ts`:

Replace:

```ts
import { getLockedRedirect, shouldCheckOrgLock } from "@/lib/org-lock-redirect";
```

with:

```ts
import { getLockedRedirect, shouldCheckOrgLock } from "@/lib/org-lock-redirect";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";
```

Replace:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SELF_HOSTED;
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
});

afterEach(() => {
  delete process.env.SELF_HOSTED;
});
```

with:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  stubCloudMode();
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1" },
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

Replace:

```ts
it("never redirects self-hosted deployments and skips the lookups", async () => {
  process.env.SELF_HOSTED = "true";
  mockPrisma.user.findUnique.mockResolvedValue({
    organization: { isActive: false, suspendedAt: null },
  } as never);

  expect(await getLockedRedirect(pageRequest())).toBeNull();
  expect(mockAuth.api.getSession).not.toHaveBeenCalled();
  expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
});
```

with:

```ts
it("never redirects self-hosted deployments and skips the lookups", async () => {
  vi.stubEnv("CONTROL_PLANE_SECRET", "");
  mockPrisma.user.findUnique.mockResolvedValue({
    organization: { isActive: false, suspendedAt: null },
  } as never);

  expect(await getLockedRedirect(pageRequest())).toBeNull();
  expect(mockAuth.api.getSession).not.toHaveBeenCalled();
  expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
});

it("ignores the deprecated SELF_HOSTED variable in cloud mode", async () => {
  vi.stubEnv("SELF_HOSTED", "true");
  mockPrisma.user.findUnique.mockResolvedValue({
    organization: { isActive: false, suspendedAt: null },
  } as never);

  const url = await getLockedRedirect(pageRequest());

  expect(url?.pathname).toBe("/suspended");
});
```

In `src/lib/__tests__/sso-provisioning.test.ts`:

Replace:

```ts
vi.mock("@/lib/deployment-mode", () => ({
  isSelfHosted: vi.fn(() => false),
}));
```

with:

```ts
vi.mock("@/lib/deployment-mode", () => ({
  isCloudMode: vi.fn(() => true),
}));
```

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `vi.mocked(isSelfHosted).mockReturnValueOnce(true);` with `vi.mocked(isCloudMode).mockReturnValueOnce(false);`.

In `src/lib/__tests__/tenant-limits.test.ts`:

Replace `import { describe, it, expect, vi, beforeEach } from "vitest";` with `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`.

Replace:

```ts
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockGetOrgContext = vi.mocked(getOrganizationContext);

beforeEach(() => {
  vi.clearAllMocks();
});
```

with:

```ts
import { getOrganizationContext } from "@/lib/organization-context";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

const mockPrisma = vi.mocked(prisma, true);
const mockGetOrgContext = vi.mocked(getOrganizationContext);

beforeEach(() => {
  vi.clearAllMocks();
  // Limits are enforced only in cloud mode; self-hosted is covered below.
  stubCloudMode();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("self-hosted mode", () => {
  beforeEach(() => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
  });

  it("never limits assets and does not query", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);

    const result = await checkAssetLimit("org-1");

    expect(result).toEqual({ allowed: true, current: 0, max: -1 });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.asset.count).not.toHaveBeenCalled();
  });

  it("never limits users and does not query", async () => {
    const result = await checkUserLimit("org-1");

    expect(result).toEqual({ allowed: true, current: 0, max: -1 });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });
});
```

In `src/lib/__tests__/env-validation.test.ts`:

Replace:

```ts
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
    // STRIPE_* are required unless SELF_HOSTED=true (see deployment-mode.ts);
    // the test environment runs as a non-self-hosted deployment by default.
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy_key_for_unit_tests");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy_secret_for_unit_tests");
  });
```

with:

```ts
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
  });
```

Replace:

```ts
    it("returns errors for missing required variables", () => {
```

with:

```ts
    it("does not require the legacy Stripe variables", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", undefined);
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", undefined);

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.includes("STRIPE"))).toBe(false);
    });

    it("masks the Stripe secrets when they are set", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy_key_for_unit_tests");

      const { variables } = validateEnvironment();

      expect(variables["STRIPE_SECRET_KEY"].masked).toBe(true);
      expect(variables["STRIPE_SECRET_KEY"].value).toContain("****");
    });

    it("returns errors for missing required variables", () => {
```

In `src/app/api/__tests__/billing-webhook.test.ts`:

Replace:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mockGetStripe.mockReturnValue({ webhooks: { constructEvent } } as never);
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("POST /api/billing/webhook", () => {
```

with:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  mockGetStripe.mockReturnValue({ webhooks: { constructEvent } } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/billing/webhook", () => {
  it("answers 404 and does nothing while legacy billing is inactive", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    receiveEvent("checkout.session.completed", {
      subscription: "sub_1",
      metadata: { organizationId: "org-1", plan: "professional" },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mockGetStripe).not.toHaveBeenCalled();
    expect(constructEvent).not.toHaveBeenCalled();
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(mockPrisma.organization.updateMany).not.toHaveBeenCalled();
  });
```

In `src/app/api/__tests__/billing-checkout.test.ts`:

Replace `import { describe, it, expect, vi, beforeEach } from "vitest";` with `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`.

Replace:

```ts
import { getStripe } from "@/lib/stripe";
```

with:

```ts
import { getStripe } from "@/lib/stripe";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";
```

Replace:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SELF_HOSTED;
  delete process.env.DEMO_MODE;
```

with:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  // Cloud mode, so the org status is derived and the lock is really in play.
  stubCloudMode();
  delete process.env.DEMO_MODE;
```

Replace:

```ts
describe("POST /api/billing/checkout", () => {
```

with:

```ts
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/billing/checkout", () => {
```

In `src/app/api/__tests__/billing-portal.test.ts`:

Replace `import { describe, it, expect, vi, beforeEach } from "vitest";` with `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`.

Replace:

```ts
import { getStripe } from "@/lib/stripe";
```

with:

```ts
import { getStripe } from "@/lib/stripe";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";
```

Replace:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SELF_HOSTED;
```

with:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  // Cloud mode, so the org status is derived and the lock is really in play.
  stubCloudMode();
```

Replace:

```ts
describe("POST /api/billing/portal", () => {
```

with:

```ts
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/billing/portal", () => {
```

Replace the whole file `src/app/api/__tests__/check-trials.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({ isValidCronAuth: vi.fn(() => true) }));

import { GET } from "@/app/api/cron/check-trials/route";
import prisma from "@/lib/prisma";
import { isValidCronAuth } from "@/lib/cron-auth";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findMany.mockResolvedValue([
    { id: "org-1", name: "Acme", trialEndsAt: new Date(0) },
  ] as never);
  mockPrisma.organization.updateMany.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/check-trials", () => {
  it("downgrades expired trials and records starter entitlements", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockPrisma.organization.updateMany.mock.calls[0][0]?.data).toEqual({
      plan: "starter",
      trialEndsAt: null,
      maxAssets: 100,
      maxUsers: 3,
      entitlements: { features: [], maxAssets: 100, maxUsers: 3 },
    });
  });

  it("does nothing, and queries nothing, without legacy billing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ downgraded: 0 });
    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("still rejects an unauthorized call before looking at billing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.mocked(isValidCronAuth).mockReturnValueOnce(false);

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
```

In `src/app/api/__tests__/auth-register.test.ts`:

Replace:

```ts
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";
```

with:

```ts
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";
```

Replace the whole phase 1a `describe("trial entitlements (phase 1a dual-write)", ...)` block. It is nested inside `describe("POST /api/auth/register", ...)`, where `validBody` is defined: it starts at the indented line `  describe("trial entitlements (phase 1a dual-write)", () => {` and ends at its own closing `  });`, the line before the final `});` of the file. Replace it with the following, nested the same way:

<!-- prettier-ignore -->
```ts
  describe("trial rule per deployment mode", () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue({
        id: "new-org-id",
      } as never);
      mockPrisma.user.create.mockResolvedValue({
        userid: "new-user-id",
      } as never);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function register() {
      await POST(
        createMockRequest("/api/auth/register", {
          method: "POST",
          body: validBody,
        }),
      );
      return mockPrisma.organization.create.mock.calls[0][0].data;
    }

    it("starts the professional trial and records its entitlements in cloud mode with legacy billing", async () => {
      stubCloudMode();
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

      const data = await register();

      expect(data).toMatchObject({
        plan: "professional",
        maxAssets: 5000,
        maxUsers: 25,
        entitlements: {
          features: [
            "api_keys",
            "procurement",
            "advanced_reports",
            "tco_dashboard",
            "custom_fields",
            "workflow_automation",
          ],
          maxAssets: 5000,
          maxUsers: 25,
        },
      });
      expect(data.trialEndsAt).toBeInstanceOf(Date);
    });

    it("writes no trial fields in cloud mode without legacy billing", async () => {
      stubCloudMode();
      vi.stubEnv("STRIPE_SECRET_KEY", "");

      expect(await register()).toEqual({
        name: "Test Corp",
        slug: expect.any(String),
      });
    });

    it("creates an unlimited organization without a trial when self-hosted", async () => {
      vi.stubEnv("CONTROL_PLANE_SECRET", "");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

      expect(await register()).toEqual({
        name: "Test Corp",
        slug: expect.any(String),
        maxAssets: -1,
        maxUsers: -1,
      });
    });

    it("ignores the deprecated SELF_HOSTED variable", async () => {
      stubCloudMode();
      vi.stubEnv("SELF_HOSTED", "true");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

      expect(await register()).toMatchObject({ plan: "professional" });
    });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/deployment-mode.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/lib/__tests__/sso-provisioning.test.ts src/lib/__tests__/tenant-limits.test.ts src/lib/__tests__/env-validation.test.ts src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/billing-checkout.test.ts src/app/api/__tests__/billing-portal.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts`
Expected: FAIL, 31 failed | 100 passed, in 9 of the 11 files (`isCloudMode is not a function`, `expected 200 to be 404`, `expected { downgraded: 1, ... } to deeply equal { downgraded: +0 }`, the register trial cases). `billing-checkout` and `billing-portal` pass already: they only gain `stubCloudMode()`, which the old code ignores.

- [ ] **Step 4: Implement the switch**

The mode module, rewritten:

Replace the whole file `src/lib/deployment-mode.ts` with:

```ts
import { isLegacyBillingActive } from "@/lib/legacy-billing";

/**
 * Deployment mode detection.
 *
 * There is exactly one switch: cloud mode, which is on while CONTROL_PLANE_SECRET
 * is set. A self-hosted deployment sets nothing and gets every feature without
 * limits; stored entitlements, locks and suspensions are ignored there.
 *
 * Cloud mode enables the hosted-service behaviour:
 * - per-organization entitlements and limits
 * - org suspension / grace period and the control-plane lock
 * - the internal API and the billing handoff
 *
 * SELF_HOSTED is deprecated and no longer read.
 */
export function isCloudMode(): boolean {
  return Boolean(process.env.CONTROL_PLANE_SECRET);
}

/**
 * True when the app should offer billing at all: cloud mode with either the
 * control plane's BILLING_URL or the legacy in-core Stripe path configured.
 */
export function isBillingEnabled(): boolean {
  return (
    isCloudMode() &&
    (Boolean(process.env.BILLING_URL) || isLegacyBillingActive())
  );
}
```

The readers. Each is a mechanical `isSelfHosted()` to `!isCloudMode()` swap:

In `src/lib/org-suspension.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `  if (isSelfHosted() || !org) return "active";` with `  if (!isCloudMode() || !org) return "active";`.

Replace `  if (isSelfHosted() || !organizationId) return "active";` with `  if (!isCloudMode() || !organizationId) return "active";`.

In `src/lib/org-lock-redirect.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `  if (isSelfHosted()) return null;` with `  if (!isCloudMode()) return null;`.

In `src/lib/tenant-limits.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace every occurrence of `  if (isSelfHosted()) return { allowed: true, current: 0, max: -1 };` with `  if (!isCloudMode()) return { allowed: true, current: 0, max: -1 };`.

In `src/lib/plan-features.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `  if (isSelfHosted()) return true;` with `  if (!isCloudMode()) return true;`.

In `src/lib/sso-provisioning.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `  if (!isSelfHosted() && org.maxUsers !== -1) {` with `  if (isCloudMode() && org.maxUsers !== -1) {`.

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stop being required. Without them the legacy billing path is simply off, and a self-hoster who sets nothing boots:

In `src/lib/env-validation.ts`:

Delete the line `import { isSelfHosted } from "@/lib/deployment-mode";`.

Replace:

```ts
  // Billing (Stripe) — required for SaaS deployments, irrelevant when
  // SELF_HOSTED=true disables quota/billing enforcement entirely.
  {
    name: "STRIPE_SECRET_KEY",
    required: !isSelfHosted(),
    description:
      "Stripe secret key for billing (not required when SELF_HOSTED=true)",
    sensitive: true,
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: !isSelfHosted(),
    description:
      "Stripe webhook signing secret (not required when SELF_HOSTED=true)",
    sensitive: true,
  },
```

with:

```ts
  // Billing (Stripe) — optional: legacy billing until phase 3a of the SaaS
  // boundary. Setting STRIPE_SECRET_KEY switches the legacy billing path on.
  {
    name: "STRIPE_SECRET_KEY",
    required: false,
    description: "Stripe secret key (optional; legacy billing until phase 3a)",
    sensitive: true,
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: false,
    description:
      "Stripe webhook signing secret (optional; legacy billing until phase 3a)",
    sensitive: true,
  },
```

The register trial rule. The phase 1a conditional spread of `entitlements` becomes part of the single branch that has legacy billing:

In `src/app/api/auth/register/route.ts`:

Replace `import { isSelfHosted } from "@/lib/deployment-mode";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

The trial block sits inside the handler's `try`, so both snippets below are quoted at their real indentation (four spaces) and marked `prettier-ignore`, which keeps the formatter from dedenting them in this file.

Replace:

<!-- prettier-ignore -->
```ts
    // SaaS mode: start with 14-day Professional trial
    // Self-hosted: unlimited, no trial
    const trialData = isSelfHosted()
      ? { maxAssets: -1, maxUsers: -1 }
      : {
          plan: "professional",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          maxAssets: 5000,
          maxUsers: 25,
          // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
          ...(isLegacyBillingActive()
            ? {
                entitlements: legacyPlanToEntitlements(
                  "professional",
                  5000,
                  25,
                ),
              }
            : {}),
        };
```

with:

<!-- prettier-ignore -->
```ts
    // Cloud mode with legacy billing: 14-day Professional trial, recorded in
    // the legacy columns and in entitlements. Cloud mode without legacy
    // billing: no trial; the control plane decides. Self-hosted: unlimited.
    const trialData = !isCloudMode()
      ? { maxAssets: -1, maxUsers: -1 }
      : isLegacyBillingActive()
        ? {
            plan: "professional",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            maxAssets: 5000,
            maxUsers: 25,
            entitlements: legacyPlanToEntitlements("professional", 5000, 25),
          }
        : {};
```

The Stripe webhook answers 404 first while legacy billing is inactive. The three phase 1a dual-write comments no longer say "nothing reads it":

In `src/app/api/billing/webhook/route.ts` (if phase 1a wrote this import in another form, edit that import so it also names `isLegacyBillingActive`):

Replace:

```ts
import { legacyPlanToEntitlements } from "@/lib/legacy-billing";
```

with:

```ts
import {
  isLegacyBillingActive,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";
```

Replace:

```ts
export async function POST(req: Request) {
  const body = await req.text();
```

with:

```ts
export async function POST(req: Request) {
  // Without a Stripe secret key the legacy billing path is off: the control
  // plane owns billing, so this endpoint does not exist.
  if (!isLegacyBillingActive()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.text();
```

Replace every occurrence of `// Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).` with `// Legacy billing keeps entitlements in step with the plan columns (until 3a).`.

`check-trials` returns before any query while legacy billing is inactive, and the phase 1a conditional spread becomes unconditional:

In `src/app/api/cron/check-trials/route.ts`:

Replace:

```ts
  try {
    // Find orgs with expired trials that haven't subscribed
```

with:

```ts
  // Trials belong to the legacy billing path; without it nothing to downgrade.
  if (!isLegacyBillingActive()) {
    return NextResponse.json({ downgraded: 0 });
  }

  try {
    // Find orgs with expired trials that haven't subscribed
```

Replace:

```ts
        // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
        ...(isLegacyBillingActive()
          ? {
              entitlements: legacyPlanToEntitlements(
                "starter",
                PLANS.starter.maxAssets,
                PLANS.starter.maxUsers,
              ),
            }
          : {}),
      },
```

with:

```ts
        entitlements: legacyPlanToEntitlements(
          "starter",
          PLANS.starter.maxAssets,
          PLANS.starter.maxUsers,
        ),
      },
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/deployment-mode.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/lib/__tests__/sso-provisioning.test.ts src/lib/__tests__/tenant-limits.test.ts src/lib/__tests__/env-validation.test.ts src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/billing-checkout.test.ts src/app/api/__tests__/billing-portal.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts`
Expected: PASS (11 files, 131 tests).

Run: `grep -rn "isSelfHosted(" src tests`
Expected: no match.

Run: `npx tsc --noEmit -p .`
Expected: no output.

Run: `npx eslint src/` (the touched files include the test files under `src/`)
Expected: no output.

Run: `npx vitest run` (shared modules changed)
Expected: all pass; the DB-backed suites are skipped locally.

- [ ] **Step 6: Commit**

```bash
git add tests/setup/cloud-mode.ts src/lib/deployment-mode.ts src/lib/org-suspension.ts src/lib/org-lock-redirect.ts src/lib/tenant-limits.ts src/lib/plan-features.ts src/lib/sso-provisioning.ts src/lib/env-validation.ts src/app/api/auth/register/route.ts src/app/api/billing/webhook/route.ts src/app/api/cron/check-trials/route.ts src/lib/__tests__/deployment-mode.test.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/org-lock-redirect.test.ts src/lib/__tests__/sso-provisioning.test.ts src/lib/__tests__/tenant-limits.test.ts src/lib/__tests__/env-validation.test.ts src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/billing-checkout.test.ts src/app/api/__tests__/billing-portal.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts
git commit -m "feat: add cloud mode and read it instead of SELF_HOSTED"
```
