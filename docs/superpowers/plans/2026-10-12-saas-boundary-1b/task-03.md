### Task 3: Marketing gate, feature-flag cleanup, billing tab visibility

The `selfHosted` feature flag is not unused: the landing, pricing, terms and privacy pages redirect to `/login` with it. They now redirect unless `isCloudMode()`. The root layout reads `headers()`, so these pages render per request and read the mode at runtime, not at build time. The `billing` settings tab is shown only when `isBillingEnabled()`.

**Files:**

- Modify: `src/lib/feature-flags.ts`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/pricing/page.tsx`, `src/app/(marketing)/terms/page.tsx`, `src/app/(marketing)/privacy/page.tsx`, `src/app/admin/settings/page.tsx`, `src/app/admin/settings/ui/AdminSettingsPage.tsx`, `src/lib/settings-tabs.ts`, `playwright.config.js`
- Test: `src/lib/__tests__/settings-tabs.test.ts` (update), `src/app/__tests__/marketing-mode-gate.test.ts` (create)

**Interfaces:**

- Consumes: `isCloudMode`, `isBillingEnabled` (Task 2).
- Produces in `src/lib/settings-tabs.ts`: `isTabVisible(tab, { isSuperAdmin, billingEnabled })`. The `isSelfHostedMode` option is replaced by `billingEnabled` with the opposite meaning: the `billing` tab is visible only when `billingEnabled`. `SELF_HOSTED_HIDDEN_TABS` is renamed `BILLING_ONLY_TABS` (still `["billing"]`), because the old name no longer describes the rule.
- Produces: `AdminSettingsPage` props `cloudMode: boolean` and `billingEnabled: boolean` replace `isSelfHostedMode`. `PlanGate` gets `isSelfHosted={!cloudMode}` until Task 16 deletes it. Task 16 therefore only adds `features`; `billingEnabled` is already there.
- `src/lib/feature-flags.ts` keeps `getFeatureFlags` and `isFeatureEnabled` only. Deleted: `setFeatureFlag`, `resetFeatureFlags`, `getFeatureFlagsSummary`, `withFeatureFlag`, `useFeatureFlag`, `featureFlagGuard`, `requireFeature`, the `selfHosted` flag (interface, default and env read) and the then-unused `logger` import. None of them has a caller outside the file.

- [ ] **Step 1: Write the failing tests**

The marketing pages are tested by rendering them (`redirect` is mocked to throw, as Next.js does) and by scanning their source, so nobody can reintroduce the removed flag:

Create `src/app/__tests__/marketing-mode-gate.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// redirect() throws in Next.js to stop rendering; model that with a marker.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}));

import Home from "@/app/(marketing)/page";
import PricingPage from "@/app/(marketing)/pricing/page";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

type RenderPage = () => Promise<unknown>;

const PAGES: ReadonlyArray<readonly [string, string, RenderPage]> = [
  ["landing page", "(marketing)/page.tsx", async () => Home()],
  ["pricing page", "(marketing)/pricing/page.tsx", async () => PricingPage()],
  ["privacy page", "(marketing)/privacy/page.tsx", async () => PrivacyPage()],
  ["terms page", "(marketing)/terms/page.tsx", async () => TermsPage()],
];

const APP_DIR = path.resolve(__dirname, "..");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("marketing pages follow the deployment mode", () => {
  it.each(PAGES)(
    "the %s sends a self-hosted deployment to /login",
    async (_name, _file, render) => {
      vi.stubEnv("CONTROL_PLANE_SECRET", "");
      await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    },
  );

  it.each(PAGES)(
    "the %s renders in cloud mode",
    async (_name, _file, render) => {
      stubCloudMode();
      await expect(render()).resolves.toBeTruthy();
    },
  );

  it.each(PAGES)(
    "the %s ignores the deprecated SELF_HOSTED variable",
    async (_name, _file, render) => {
      vi.stubEnv("SELF_HOSTED", "false");
      await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");

      stubCloudMode();
      vi.stubEnv("SELF_HOSTED", "true");
      await expect(render()).resolves.toBeTruthy();
    },
  );

  it.each(PAGES)(
    "the %s source gates on isCloudMode() and not on the removed flag",
    (_name, file) => {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      expect(source).toContain("isCloudMode()");
      expect(source).not.toContain('"selfHosted"');
      expect(source).not.toContain("SELF_HOSTED");
    },
  );
});

describe("admin settings page", () => {
  // Only negative checks: Task 16 moves the page to requireAdminPage(), and
  // gated-pages.test.ts pins its new shape.
  it("never reads SELF_HOSTED or the old self-hosted prop", () => {
    const source = readFileSync(
      path.join(APP_DIR, "admin/settings/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("SELF_HOSTED");
    expect(source).not.toContain("isSelfHostedMode");
  });
});

describe("feature-flags", () => {
  it("exports only the live API", async () => {
    const flags = await import("@/lib/feature-flags");
    expect(Object.keys(flags).sort()).toEqual([
      "getFeatureFlags",
      "isFeatureEnabled",
    ]);
  });

  it("has no selfHosted flag and does not read SELF_HOSTED", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.resetModules();
    const { getFeatureFlags } = await import("@/lib/feature-flags");
    expect(getFeatureFlags()).not.toHaveProperty("selfHosted");
  });
});
```

The settings tab test follows the new option:

In `src/lib/__tests__/settings-tabs.test.ts`:

Replace:

```ts
import {
  SELF_HOSTED_HIDDEN_TABS,
  SUPER_ADMIN_ONLY_TABS,
```

with:

```ts
import {
  BILLING_ONLY_TABS,
  SUPER_ADMIN_ONLY_TABS,
```

Replace:

```ts
const admin = { isSuperAdmin: false, isSelfHostedMode: false };
const superAdmin = { isSuperAdmin: true, isSelfHostedMode: false };
```

with:

```ts
const admin = { isSuperAdmin: false, billingEnabled: false };
const superAdmin = { isSuperAdmin: true, billingEnabled: false };
```

Replace:

```ts
it("hides billing in self-hosted mode, even from a super-admin", () => {
  expect([...SELF_HOSTED_HIDDEN_TABS]).toEqual(["billing"]);
  expect(
    isTabVisible("billing", { isSuperAdmin: true, isSelfHostedMode: true }),
  ).toBe(false);
  expect(isTabVisible("billing", superAdmin)).toBe(true);
});
```

with:

```ts
it("hides billing unless billing is enabled, even from a super-admin", () => {
  expect([...BILLING_ONLY_TABS]).toEqual(["billing"]);
  expect(isTabVisible("billing", superAdmin)).toBe(false);
  expect(isTabVisible("billing", admin)).toBe(false);
});

it("shows billing to every admin once billing is enabled", () => {
  expect(
    isTabVisible("billing", { isSuperAdmin: false, billingEnabled: true }),
  ).toBe(true);
  expect(
    isTabVisible("billing", { isSuperAdmin: true, billingEnabled: true }),
  ).toBe(true);
});

it.each([...ORG_TABS, ...PLATFORM_TABS])(
  "does not tie %s to billing",
  (tab) => {
    const withBilling = { isSuperAdmin: true, billingEnabled: true };
    const withoutBilling = { isSuperAdmin: true, billingEnabled: false };
    expect(isTabVisible(tab, withBilling)).toBe(
      isTabVisible(tab, withoutBilling),
    );
  },
);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/settings-tabs.test.ts src/app/__tests__/marketing-mode-gate.test.ts`
Expected: FAIL, 16 failed | 66 passed (the pages do not redirect without `CONTROL_PLANE_SECRET`, they still mention `selfHosted`, `feature-flags` still exports the deleted names, and the billing tab is not hidden by `billingEnabled`).

- [ ] **Step 3: Implement**

`src/lib/feature-flags.ts` shrinks to the live API:

Replace the whole file `src/lib/feature-flags.ts` with:

```ts
/**
 * Feature flags system
 * Simple feature flags for enabling/disabling functionality
 */

import { getBoolEnvVar } from "@/lib/env-validation";

/**
 * Feature flag definitions
 */
export interface FeatureFlags {
  /** Enable rate limiting on API endpoints */
  rateLimiting: boolean;
  /** Enable account lockout after failed login attempts */
  accountLockout: boolean;
  /** Enable session timeout for inactivity */
  sessionTimeout: boolean;
  /** Enable demo mode features */
  demoMode: boolean;
  /** Enable audit logging */
  auditLogging: boolean;
  /** Enable email notifications */
  emailNotifications: boolean;
  /** Enable advanced search */
  advancedSearch: boolean;
  /** Enable maintenance mode */
  maintenanceMode: boolean;
}

/**
 * Default feature flag values
 */
const DEFAULT_FLAGS: FeatureFlags = {
  rateLimiting: true,
  accountLockout: true,
  sessionTimeout: true,
  demoMode: false,
  auditLogging: true,
  emailNotifications: false,
  advancedSearch: true,
  maintenanceMode: false,
};

/**
 * In-memory cache for feature flags
 * In production, this could be backed by a database or configuration service
 */
let cachedFlags: FeatureFlags | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load feature flags from environment variables
 */
function loadFromEnvironment(): Partial<FeatureFlags> {
  return {
    rateLimiting: getBoolEnvVar(
      "FEATURE_RATE_LIMITING",
      DEFAULT_FLAGS.rateLimiting,
    ),
    accountLockout: getBoolEnvVar(
      "FEATURE_ACCOUNT_LOCKOUT",
      DEFAULT_FLAGS.accountLockout,
    ),
    sessionTimeout: getBoolEnvVar(
      "FEATURE_SESSION_TIMEOUT",
      DEFAULT_FLAGS.sessionTimeout,
    ),
    demoMode: getBoolEnvVar("DEMO_MODE", DEFAULT_FLAGS.demoMode),
    auditLogging: getBoolEnvVar(
      "FEATURE_AUDIT_LOGGING",
      DEFAULT_FLAGS.auditLogging,
    ),
    emailNotifications: getBoolEnvVar(
      "FEATURE_EMAIL_NOTIFICATIONS",
      DEFAULT_FLAGS.emailNotifications,
    ),
    advancedSearch: getBoolEnvVar(
      "FEATURE_ADVANCED_SEARCH",
      DEFAULT_FLAGS.advancedSearch,
    ),
    maintenanceMode: getBoolEnvVar(
      "MAINTENANCE_MODE",
      DEFAULT_FLAGS.maintenanceMode,
    ),
  };
}

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  const now = Date.now();

  if (cachedFlags && now - cacheTime < CACHE_TTL) {
    return cachedFlags;
  }

  const envFlags = loadFromEnvironment();
  cachedFlags = {
    ...DEFAULT_FLAGS,
    ...envFlags,
  };
  cacheTime = now;

  return cachedFlags;
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}
```

The four marketing pages redirect unless the deployment is in cloud mode:

In `src/app/(marketing)/page.tsx`:

Replace `import { isFeatureEnabled } from "@/lib/feature-flags";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace:

```tsx
  // Self-hosted mode: skip landing page, go straight to login
  if (isFeatureEnabled("selfHosted")) {
```

with:

```tsx
  // Not cloud mode (self-hosted): skip the landing page, go straight to login
  if (!isCloudMode()) {
```

In `src/app/(marketing)/pricing/page.tsx`:

Replace `import { isFeatureEnabled } from "@/lib/feature-flags";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `if (isFeatureEnabled("selfHosted")) {` with `if (!isCloudMode()) {`.

In `src/app/(marketing)/terms/page.tsx`:

Replace `import { isFeatureEnabled } from "@/lib/feature-flags";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `if (isFeatureEnabled("selfHosted")) {` with `if (!isCloudMode()) {`.

In `src/app/(marketing)/privacy/page.tsx`:

Replace `import { isFeatureEnabled } from "@/lib/feature-flags";` with `import { isCloudMode } from "@/lib/deployment-mode";`.

Replace `if (isFeatureEnabled("selfHosted")) {` with `if (!isCloudMode()) {`.

The billing tab follows `billingEnabled`:

In `src/lib/settings-tabs.ts`:

Replace:

```ts
/** Billing exists only in the hosted SaaS deployment. */
export const SELF_HOSTED_HIDDEN_TABS: ReadonlySet<string> = new Set([
  "billing",
]);

export interface TabVisibilityContext {
  isSuperAdmin: boolean;
  isSelfHostedMode: boolean;
}

export function isTabVisible(
  tab: string,
  { isSuperAdmin, isSelfHostedMode }: TabVisibilityContext,
): boolean {
  if (SUPER_ADMIN_ONLY_TABS.has(tab) && !isSuperAdmin) return false;
  if (SELF_HOSTED_HIDDEN_TABS.has(tab) && isSelfHostedMode) return false;
  return true;
}
```

with:

```ts
/** Tabs that exist only while the deployment offers billing. */
export const BILLING_ONLY_TABS: ReadonlySet<string> = new Set(["billing"]);

export interface TabVisibilityContext {
  isSuperAdmin: boolean;
  /** True in cloud mode with a billing path configured (isBillingEnabled). */
  billingEnabled: boolean;
}

export function isTabVisible(
  tab: string,
  { isSuperAdmin, billingEnabled }: TabVisibilityContext,
): boolean {
  if (SUPER_ADMIN_ONLY_TABS.has(tab) && !isSuperAdmin) return false;
  if (BILLING_ONLY_TABS.has(tab) && !billingEnabled) return false;
  return true;
}
```

The settings page reads the mode through `deployment-mode` and passes booleans to the client component:

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`:

Replace:

```tsx
  orgPlan?: "starter" | "professional" | "enterprise";
  isSelfHostedMode?: boolean;
}
```

with:

```tsx
  orgPlan?: "starter" | "professional" | "enterprise";
  /** Cloud mode: the hosted deployment (entitlements and billing exist). */
  cloudMode: boolean;
  /** Cloud mode with a billing path configured (isBillingEnabled). */
  billingEnabled: boolean;
}
```

Replace:

```tsx
  orgPlan = "starter",
  isSelfHostedMode = false,
}: AdminSettingsPageProps) {
```

with:

```tsx
  orgPlan = "starter",
  cloudMode,
  billingEnabled,
}: AdminSettingsPageProps) {
```

Replace:

```tsx
            isTabVisible(item.value, { isSuperAdmin, isSelfHostedMode }),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [isSuperAdmin, isSelfHostedMode],
```

with:

```tsx
            isTabVisible(item.value, { isSuperAdmin, billingEnabled }),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [isSuperAdmin, billingEnabled],
```

Replace `              isSelfHosted={isSelfHostedMode}` with `              isSelfHosted={!cloudMode}`.

In `src/app/admin/settings/page.tsx`:

Replace:

```tsx
import { isSuperAdmin } from "@/lib/super-admin";
```

with:

```tsx
import { isSuperAdmin } from "@/lib/super-admin";
import { isBillingEnabled, isCloudMode } from "@/lib/deployment-mode";
```

Replace:

```tsx
        isSelfHostedMode={process.env.SELF_HOSTED === "true"}
```

with:

```tsx
        cloudMode={isCloudMode()}
        billingEnabled={isBillingEnabled()}
```

The marketing E2E project keeps seeing the marketing pages by running its dev server in cloud mode:

In `playwright.config.js`:

Replace:

```js
    // Public sign-up is closed by default; the auth-flow specs open /register.
    env: { ALLOW_PUBLIC_SIGNUP: "true" },
```

with:

```js
    // Public sign-up is closed by default; the auth-flow specs open /register.
    // Cloud mode keeps the marketing pages: a self-hosted deployment redirects
    // them to /login. New orgs get every feature without limits so the
    // DB-backed specs keep their pages; list your seeded admin in
    // E2E_SUPER_ADMIN_EMAILS to keep platform settings reachable. These values
    // only apply when Playwright starts the server itself.
    env: {
      ALLOW_PUBLIC_SIGNUP: "true",
      CONTROL_PLANE_SECRET: "playwright-control-plane-secret-0123456789",
      NEW_ORG_ENTITLEMENTS: JSON.stringify({
        features: [
          "api_keys",
          "procurement",
          "scim",
          "advanced_reports",
          "tco_dashboard",
          "custom_fields",
          "workflow_automation",
        ],
        maxAssets: null,
        maxUsers: null,
      }),
      SUPER_ADMIN_EMAILS:
        process.env.E2E_SUPER_ADMIN_EMAILS ?? "operator@example.com",
    },
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/settings-tabs.test.ts src/app/__tests__/marketing-mode-gate.test.ts`
Expected: PASS (2 files, 82 tests).

Run: `grep -rnE "SELF_HOSTED|selfHosted|isSelfHosted" src --include='*.ts' --include='*.tsx' | grep -v __tests__`
Expected: only the deprecation comment in `src/lib/deployment-mode.ts`, `PlanGate`'s own `isSelfHosted` prop (3 lines) and the `isSelfHosted={!cloudMode}` that `AdminSettingsPage` passes to it (Task 16 deletes both).

Run: `npx tsc --noEmit -p .`
Expected: no output.

Run: `npx eslint src/`
Expected: no output.

Run: `npx playwright test --list --project=marketing`
Expected: the marketing, accessibility and domain-split specs are listed. This only loads the config; it starts no server.

Run: `npx vitest run`
Expected: all pass; the DB-backed suites are skipped locally.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feature-flags.ts "src/app/(marketing)/page.tsx" "src/app/(marketing)/pricing/page.tsx" "src/app/(marketing)/terms/page.tsx" "src/app/(marketing)/privacy/page.tsx" src/app/admin/settings/page.tsx src/app/admin/settings/ui/AdminSettingsPage.tsx src/lib/settings-tabs.ts playwright.config.js src/lib/__tests__/settings-tabs.test.ts src/app/__tests__/marketing-mode-gate.test.ts
git commit -m "feat: gate marketing pages and the billing tab on the deployment mode"
```
