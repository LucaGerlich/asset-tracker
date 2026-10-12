### Task 16: Client gating

Pages and tabs follow the organization's features. Server pages load a small `PageContext` (the viewer, the organization's resolved entitlements and whether billing exists) with one user query that carries the organization columns, and either render a neutral "not available" panel or pass the feature set down to client components. `FeatureGate` and `FeatureUnavailable` replace `PlanGate` and `UpgradeRequired` and never name a plan or a price. Hiding UI is a usability filter only: every route enforces its feature itself (Tasks 6 to 9).

A revoked feature blocks create and edit, never access to what exists (Review Focus 4): the API key list, the custom field definitions and the automation rules stay listed, deactivatable and deletable; only the procurement pages, `/tco` and the two report tabs are replaced by the panel, because their routes refuse every method. The task has two commits: Part A adds the context and the components, Part B applies them.

**Files:**

- Create: `src/lib/page-context.ts`
- Create: `src/components/FeatureGate.tsx`
- Create: `src/components/FeatureUnavailable.tsx`
- Create: `src/components/ManageBillingCard.tsx`
- Modify: `src/app/procurement/page.tsx`, `src/app/procurement/create/page.tsx`, `src/app/procurement/[id]/page.tsx`, `src/app/procurement/orders/page.tsx`, `src/app/procurement/orders/[id]/page.tsx`
- Modify: `src/app/tco/page.tsx`
- Modify: `src/app/admin/workflows/page.tsx`, `src/app/admin/workflows/ui/WorkflowsPageClient.tsx` (`canEdit`)
- Modify: `src/app/reports/page.tsx`, `src/app/reports/ui/ReportsPage.tsx` (Advanced and TCO tabs)
- Modify: `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardGrid.tsx`, `src/components/dashboard/WidgetRegistry.ts`
- Modify: `src/app/admin/settings/page.tsx`, `src/app/admin/settings/ui/AdminSettingsPage.tsx`, `src/app/admin/settings/ui/ApiKeysTab.tsx` (`canCreate`), `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx` (`canEdit`)
- Delete: `src/components/PlanGate.tsx`, `src/components/UpgradeRequired.tsx`
- Test: `src/lib/__tests__/page-context.test.ts` (create)
- Test: `src/components/__tests__/feature-gate.test.ts` (create; a `.ts` file using `createElement` and `renderToStaticMarkup`, because vitest only collects `*.test.ts`)
- Test: `src/app/__tests__/gated-pages.test.ts` (create; static scan)

**Interfaces:**

- Consumes: `allowsFeature`, `FEATURE_LABELS`, `GatedFeature`, `Entitlements`, `GATED_FEATURES` (`entitlements-shared`); `orgAccessSelect`, `resolveOrgAccess` (Task 6); `isBillingEnabled`, `isCloudMode` (Task 2); `isLegacyBillingActive` (phase 1a); `stubCloudMode` and `TEST_NEW_ORG_ENTITLEMENTS` (Task 2). Task 3 already changed `AdminSettingsPage` and `admin/settings/page.tsx`; the snippets below show the state it leaves (required props `cloudMode` and `billingEnabled`, `PlanGate` with `isSelfHosted={!cloudMode}`, the `isCloudMode()`/`isBillingEnabled()` calls and their import in the page). Task 7 added a `loadTcoWidget` import to `DashboardGrid.tsx` below the `WidgetRegistry` import and rewrote the head of `TCOWidget`; neither is touched here.
- Produces in `src/lib/page-context.ts`: `interface PageContext { userId: string; email: string | null; isAdmin: boolean; organizationId: string | null; entitlements: Entitlements; billingEnabled: boolean }`; `getPageContext: () => Promise<PageContext | null>` (React `cache()`; the session plus one user query with the organization access select; `null` when signed out or inactive); `requireAdminPage(): Promise<PageContext>` (redirects to `/login` or `/dashboard`).
- Produces: `FeatureUnavailable({ feature, billingEnabled })` and `featureUnavailableMessage(feature): string` (copy "<label> is not available for your organization."; a link to `/admin/settings?tab=billing` only when `billingEnabled`); `FeatureGate({ feature, features, billingEnabled, children, fallback? })` (`"use client"`); `ManageBillingCard()` (a POST form to `/api/billing/handoff`).
- Produces: `WidgetDefinition.feature?: GatedFeature`; `DashboardGrid` prop `features?: readonly GatedFeature[]`; `ReportsPage` props `features` and `billingEnabled`; `AdminSettingsPage` props `features` and `legacyBilling` (Task 3's `billingEnabled` stays; `orgPlan` and `cloudMode` go); `WorkflowsPageClient` prop `canEdit`; `ApiKeysTab` prop `canCreate`; `CustomFieldsAdminTab` prop `canEdit`.

#### Part A: the page context and the gate components

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/page-context.test.ts`. `redirect` is mocked to throw a marker error, as the real one throws; `React.cache()` is a pass-through under vitest, so nothing here relies on per-render deduplication.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { getPageContext, requireAdminPage } from "@/lib/page-context";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UNRESTRICTED, type Entitlements } from "@/lib/entitlements-shared";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);

const PROFESSIONAL: Entitlements = {
  features: ["api_keys", "procurement"],
  maxAssets: 5000,
  maxUsers: 25,
};

function dbUser(
  overrides: {
    isadmin?: boolean;
    isActive?: boolean;
    email?: string | null;
    organizationId?: string | null;
    organization?: Record<string, unknown> | null;
  } = {},
) {
  return {
    userid: "user-1",
    email: "admin@example.com",
    isadmin: true,
    isActive: true,
    organizationId: "org-1",
    organization: {
      isActive: true,
      suspendedAt: null,
      lockedAt: null,
      entitlements: PROFESSIONAL,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1", isadmin: true },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue(dbUser() as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPageContext", () => {
  it("is null when signed out, without touching the database", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    expect(await getPageContext()).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("is null for a user that is missing or inactive", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);
    expect(await getPageContext()).toBeNull();

    mockPrisma.user.findUnique.mockResolvedValueOnce(
      dbUser({ isActive: false }) as never,
    );
    expect(await getPageContext()).toBeNull();
  });

  it("loads the user and the organization access columns in one query", async () => {
    stubCloudMode();

    await getPageContext();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    const args = mockPrisma.user.findUnique.mock.calls[0][0] as {
      where: unknown;
      select: { organization: { select: Record<string, boolean> } };
    };
    expect(args.where).toEqual({ userid: "user-1" });
    expect(args.select.organization.select).toMatchObject({
      isActive: true,
      suspendedAt: true,
      lockedAt: true,
      entitlements: true,
    });
  });

  it("reads admin status and the email from the database row, not the session", async () => {
    mockAuth.api.getSession.mockResolvedValue({
      user: { id: "user-1", isadmin: true, email: "stale@example.com" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false, email: "fresh@example.com" }) as never,
    );

    const context = await getPageContext();

    expect(context).toMatchObject({
      userId: "user-1",
      isAdmin: false,
      email: "fresh@example.com",
      organizationId: "org-1",
    });
  });

  it("returns the stored entitlements of the organization in cloud mode", async () => {
    stubCloudMode();

    const context = await getPageContext();

    expect(context?.entitlements).toEqual(PROFESSIONAL);
  });

  it("falls back to the new-organization entitlements for an unset value in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        organization: {
          isActive: true,
          suspendedAt: null,
          lockedAt: null,
          entitlements: null,
        },
      }) as never,
    );

    const context = await getPageContext();

    expect(context?.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("gives an organization-less user no more than the new-organization features in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organizationId: null, organization: null }) as never,
    );

    const context = await getPageContext();

    expect(context?.organizationId).toBeNull();
    expect(context?.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("is unrestricted outside cloud mode, whatever the stored value says", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        organization: {
          isActive: true,
          suspendedAt: null,
          lockedAt: new Date(),
          entitlements: { features: [], maxAssets: 0, maxUsers: 0 },
        },
      }) as never,
    );

    const context = await getPageContext();

    expect(context?.entitlements).toEqual(UNRESTRICTED);
    expect(context?.billingEnabled).toBe(false);
  });

  it("reports billing as enabled in cloud mode with BILLING_URL", async () => {
    stubCloudMode();
    vi.stubEnv("BILLING_URL", "https://billing.example.com");

    expect((await getPageContext())?.billingEnabled).toBe(true);
  });

  it("reports billing as enabled in cloud mode while legacy billing is active", async () => {
    stubCloudMode();
    vi.stubEnv("BILLING_URL", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    expect((await getPageContext())?.billingEnabled).toBe(true);
  });

  it("reports billing as disabled in cloud mode without either", async () => {
    stubCloudMode();
    vi.stubEnv("BILLING_URL", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    expect((await getPageContext())?.billingEnabled).toBe(false);
  });

  it("reports billing as disabled outside cloud mode even with BILLING_URL set", async () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com");

    expect((await getPageContext())?.billingEnabled).toBe(false);
  });
});

describe("requireAdminPage", () => {
  it("sends a signed-out viewer to the login", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sends an inactive user to the login", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isActive: false }) as never,
    );

    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sends a non-admin to the dashboard", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    await expect(requireAdminPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("sends a demoted admin whose session still says admin to the dashboard", async () => {
    mockAuth.api.getSession.mockResolvedValue({
      user: { id: "user-1", isadmin: true },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    await expect(requireAdminPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("returns the context of an admin", async () => {
    stubCloudMode();

    const context = await requireAdminPage();

    expect(context).toMatchObject({
      userId: "user-1",
      isAdmin: true,
      organizationId: "org-1",
      entitlements: PROFESSIONAL,
    });
  });
});
```

Create `src/components/__tests__/feature-gate.test.ts`. The last block is the "imports only `entitlements-shared`" rule from the spec as a check on the import lists.

```ts
import { describe, it, expect } from "vitest";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FeatureGate } from "@/components/FeatureGate";
import {
  FeatureUnavailable,
  featureUnavailableMessage,
} from "@/components/FeatureUnavailable";
import { ManageBillingCard } from "@/components/ManageBillingCard";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";

const COMPONENTS_DIR = path.resolve(__dirname, "..");
const BILLING_LINK = 'href="/admin/settings?tab=billing"';

function gate(
  props: {
    feature?: GatedFeature;
    features: readonly GatedFeature[];
    billingEnabled?: boolean;
    fallback?: ReactNode;
  },
  child = "gated content",
): string {
  // The children go in as the third argument; the cast covers their required prop.
  const gateProps = {
    feature: props.feature ?? "tco_dashboard",
    features: props.features,
    billingEnabled: props.billingEnabled ?? false,
    fallback: props.fallback,
  } as ComponentProps<typeof FeatureGate>;
  return renderToStaticMarkup(
    createElement(FeatureGate, gateProps, createElement("p", null, child)),
  );
}

describe("FeatureGate", () => {
  it("renders its children when the feature is available", () => {
    const html = gate({ features: ["tco_dashboard", "procurement"] });

    expect(html).toContain("gated content");
    expect(html).not.toContain("not available");
  });

  it("renders every child for an organization with every feature", () => {
    for (const feature of GATED_FEATURES) {
      expect(gate({ feature, features: GATED_FEATURES })).toContain(
        "gated content",
      );
    }
  });

  it("renders the neutral panel instead of the children when the feature is missing", () => {
    const html = gate({ features: ["procurement"] });

    expect(html).not.toContain("gated content");
    expect(html).toContain(
      "TCO dashboard is not available for your organization.",
    );
  });

  it("does not link to billing when billing is disabled", () => {
    expect(gate({ features: [], billingEnabled: false })).not.toContain(
      BILLING_LINK,
    );
  });

  it("links to the billing tab when billing is enabled", () => {
    expect(gate({ features: [], billingEnabled: true })).toContain(
      BILLING_LINK,
    );
  });

  it("renders the fallback instead of the panel", () => {
    const html = gate({
      features: [],
      fallback: createElement("em", null, "read-only view"),
    });

    expect(html).toContain("<em>read-only view</em>");
    expect(html).not.toContain("not available");
  });

  it("renders nothing for a null fallback", () => {
    expect(gate({ features: [], fallback: null })).toBe("");
  });
});

describe("FeatureUnavailable", () => {
  it.each(GATED_FEATURES)("never names a plan or a price for %s", (feature) => {
    const html = renderToStaticMarkup(
      createElement(FeatureUnavailable, { feature, billingEnabled: true }),
    );

    expect(html).not.toMatch(
      /plan|upgrade|price|\$\d|starter|professional|enterprise/i,
    );
    expect(featureUnavailableMessage(feature)).toMatch(
      /^[A-Z][\w ]+ is not available for your organization\.$/,
    );
  });
});

describe("ManageBillingCard", () => {
  it("posts a plain form to the billing handoff", () => {
    const html = renderToStaticMarkup(createElement(ManageBillingCard));

    expect(html).toMatch(/<form [^>]*action="\/api\/billing\/handoff"/);
    expect(html).toMatch(/<form [^>]*method="post"/);
    expect(html).toContain("Manage billing");
    expect(html).toContain('type="submit"');
  });
});

describe("gate components stay free of server code", () => {
  const FILES = [
    "FeatureGate.tsx",
    "FeatureUnavailable.tsx",
    "ManageBillingCard.tsx",
  ];

  it.each(FILES)("%s imports no server module", (file) => {
    const source = readFileSync(path.join(COMPONENTS_DIR, file), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

    for (const specifier of imports) {
      expect(specifier).not.toMatch(
        /prisma|plan-features|deployment-mode|legacy-billing|page-context|\/entitlements$|org-access|api-auth|next\/headers/,
      );
    }
  });

  it("FeatureGate is a client component", () => {
    const source = readFileSync(
      path.join(COMPONENTS_DIR, "FeatureGate.tsx"),
      "utf8",
    );

    expect(source.startsWith('"use client";')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/page-context.test.ts src/components/__tests__/feature-gate.test.ts`
Expected: FAIL. Both files fail to load because `@/lib/page-context`, `@/components/FeatureGate`, `@/components/FeatureUnavailable` and `@/components/ManageBillingCard` do not exist yet.

- [ ] **Step 3: Write the context and the components**

Create `src/lib/page-context.ts`. The admin flag and the email come from the database row, never from the cookie-cached session, and the organization columns arrive in the same query (the invariant Phase 0 pinned for `getAuthUser`). `email` is an addition to the skeleton's shape: the settings page needs the stored address for `isSuperAdmin`.

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isBillingEnabled } from "@/lib/deployment-mode";
import type { Entitlements } from "@/lib/entitlements-shared";
import { orgAccessSelect, resolveOrgAccess } from "@/lib/org-access";
import prisma from "@/lib/prisma";

/** What a server page needs to decide what the viewer may see. */
export interface PageContext {
  userId: string;
  /** The address stored in the database, never the session's copy. */
  email: string | null;
  isAdmin: boolean;
  organizationId: string | null;
  entitlements: Entitlements;
  billingEnabled: boolean;
}

async function loadPageContext(): Promise<PageContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // One query: the user with the organization columns the access rules need.
  // Admin status comes from the row, not from the cookie-cached session.
  const dbUser = await prisma.user.findUnique({
    where: { userid: session.user.id },
    select: {
      userid: true,
      email: true,
      isadmin: true,
      isActive: true,
      organizationId: true,
      organization: { select: orgAccessSelect },
    },
  });
  if (!dbUser || !dbUser.isActive) return null;

  const organizationId = dbUser.organizationId ?? null;
  const access = resolveOrgAccess(dbUser.organization ?? null, organizationId);

  return {
    userId: dbUser.userid,
    email: dbUser.email ?? null,
    isAdmin: dbUser.isadmin,
    organizationId,
    entitlements: access.entitlements,
    billingEnabled: isBillingEnabled(),
  };
}

/**
 * The signed-in viewer of a server page, or null when signed out or inactive.
 * Deduplicated within one render: several components of a page may call it.
 */
export const getPageContext = cache(loadPageContext);

/**
 * For admin-only pages: sends signed-out viewers to the login and non-admins
 * to the dashboard, like the pages did before.
 */
export async function requireAdminPage(): Promise<PageContext> {
  const context = await getPageContext();
  if (!context) redirect("/login");
  if (!context.isAdmin) redirect("/dashboard");
  return context;
}
```

Create `src/components/FeatureUnavailable.tsx`. It has no hooks, so server pages and client components can both render it.

```tsx
import Link from "next/link";
import { Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FEATURE_LABELS, type GatedFeature } from "@/lib/entitlements-shared";

/** The neutral denial copy. It never names a plan or a price. */
export function featureUnavailableMessage(feature: GatedFeature): string {
  return `${FEATURE_LABELS[feature]} is not available for your organization.`;
}

interface FeatureUnavailableProps {
  feature: GatedFeature;
  /** Links to the billing tab when the deployment has billing. */
  billingEnabled: boolean;
}

/**
 * The panel shown in place of a feature the organization may not use. Plain
 * markup with no hooks, so server pages and client components can both render it.
 */
export function FeatureUnavailable({
  feature,
  billingEnabled,
}: FeatureUnavailableProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="bg-muted mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full">
          <Lock className="text-muted-foreground h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-lg">{FEATURE_LABELS[feature]}</CardTitle>
        <CardDescription>{featureUnavailableMessage(feature)}</CardDescription>
      </CardHeader>
      {billingEnabled && (
        <CardContent className="flex justify-center">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/settings?tab=billing">Manage billing</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
```

Create `src/components/FeatureGate.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";
import type { GatedFeature } from "@/lib/entitlements-shared";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";

interface FeatureGateProps {
  feature: GatedFeature;
  /** The features of the viewer's organization, passed down by the server page. */
  features: readonly GatedFeature[];
  billingEnabled: boolean;
  children: ReactNode;
  /** Rendered instead of the default panel; `null` renders nothing. */
  fallback?: ReactNode;
}

/**
 * Renders its children only when the organization has the feature. This hides
 * UI only; every server route enforces the feature on its own.
 */
export function FeatureGate({
  feature,
  features,
  billingEnabled,
  children,
  fallback,
}: FeatureGateProps) {
  if (features.includes(feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <FeatureUnavailable feature={feature} billingEnabled={billingEnabled} />
  );
}
```

Create `src/components/ManageBillingCard.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The billing tab of a deployment whose billing lives in the control plane.
 * A plain form post: the handoff route answers with a page that carries a
 * short-lived signed token on to the billing portal.
 */
export function ManageBillingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          Manage your subscription, payment method and invoices in the billing
          portal. You are signed in there automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" action="/api/billing/handoff">
          <Button type="submit">Manage billing</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/page-context.test.ts src/components/__tests__/feature-gate.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .` and `npx eslint src/lib/page-context.ts src/components/FeatureGate.tsx src/components/FeatureUnavailable.tsx src/components/ManageBillingCard.tsx src/lib/__tests__/page-context.test.ts src/components/__tests__/feature-gate.test.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/page-context.ts src/components/FeatureGate.tsx src/components/FeatureUnavailable.tsx src/components/ManageBillingCard.tsx src/lib/__tests__/page-context.test.ts src/components/__tests__/feature-gate.test.ts
git commit -m "feat: add the page context and the feature gate components"
```

#### Part B: gate the pages and the settings tabs

- [ ] **Step 6: Write the failing static scan**

Create `src/app/__tests__/gated-pages.test.ts`. It keeps the pages from silently losing their gate: every procurement page (found by walking the directory, so a new page cannot skip it) and `/tco` must call `requireAdminPage(` and `allowsFeature(`; the other consumers must pass the feature set down; `PlanGate` and `UpgradeRequired` must be gone.

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Static guard for the pages and client components that depend on an
 * entitlement. The server routes enforce every feature on their own; this keeps
 * the pages from silently losing their gate (a new procurement page that
 * forgets requireAdminPage(), a prop that is no longer passed down).
 */

const APP_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.resolve(APP_DIR, "..");

function app(rel: string): string {
  return readFileSync(path.join(APP_DIR, rel), "utf8");
}

function src(rel: string): string {
  return readFileSync(path.join(SRC_DIR, rel), "utf8");
}

/** Pages that render <FeatureUnavailable> when their one feature is missing. */
const PANEL_PAGES: Record<string, string> = {
  "procurement/page.tsx": "procurement",
  "procurement/create/page.tsx": "procurement",
  "procurement/[id]/page.tsx": "procurement",
  "procurement/orders/page.tsx": "procurement",
  "procurement/orders/[id]/page.tsx": "procurement",
  "tco/page.tsx": "tco_dashboard",
};

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return pageFiles(full);
    return name === "page.tsx" ? [full] : [];
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("pages gated by a single feature", () => {
  it.each(Object.entries(PANEL_PAGES))(
    "%s checks %s through the page context",
    (rel, feature) => {
      const source = app(rel);

      expect(source).toContain("requireAdminPage(");
      expect(source).toContain("allowsFeature(");
      expect(source).toContain(`"${feature}"`);
      expect(source).toContain("<FeatureUnavailable");
      expect(source).not.toContain("auth.api.getSession");
    },
  );

  it("covers every procurement page", () => {
    const found = pageFiles(path.join(APP_DIR, "procurement")).map((full) =>
      path.relative(APP_DIR, full),
    );

    expect(found.sort()).toEqual(
      Object.keys(PANEL_PAGES)
        .filter((rel) => rel.startsWith("procurement/"))
        .sort(),
    );
  });

  it("keeps the workflow rules reachable and passes the feature as canEdit", () => {
    const page = app("admin/workflows/page.tsx");
    const client = app("admin/workflows/ui/WorkflowsPageClient.tsx");

    expect(page).toContain("requireAdminPage(");
    expect(page).toContain(
      'allowsFeature(context.entitlements, "workflow_automation")',
    );
    expect(page).toContain("canEdit={canEdit}");
    expect(page).not.toContain("<FeatureUnavailable");
    expect(client).toContain("canEdit");
  });
});

describe("reports and dashboard", () => {
  it("passes the organization's features to the reports page", () => {
    const page = app("reports/page.tsx");

    expect(page).toContain("getPageContext(");
    expect(page).toContain("features={context.entitlements.features}");
    expect(page).toContain("billingEnabled={showBillingLink}");
    expect(page).toContain("context.billingEnabled && context.isAdmin");
    expect(page).not.toContain("getOrganizationContext");
  });

  it("gates the Advanced and TCO tabs but not the page", () => {
    const client = app("reports/ui/ReportsPage.tsx");

    expect(client).toMatch(
      /<FeatureGate\s+feature="advanced_reports"[\s\S]*?<AdvancedCharts \/>/,
    );
    expect(client).toMatch(
      /<FeatureGate\s+feature="tco_dashboard"[\s\S]*?<TCOReport \/>/,
    );
  });

  it("passes the features to both dashboard grids", () => {
    const page = app("dashboard/page.tsx");

    expect(page).toContain("getPageContext(");
    expect(page.match(/features=\{features\}/g)).toHaveLength(2);
  });

  it("does not offer or render a widget whose feature is missing", () => {
    const registry = src("components/dashboard/WidgetRegistry.ts");
    const grid = src("components/dashboard/DashboardGrid.tsx");

    expect(registry).toMatch(/type: "tco"[\s\S]*?feature: "tco_dashboard"/);
    expect(grid).toContain("features.includes(d.feature)");
    expect(grid).toContain("featureUnavailableMessage(missingFeature)");
  });
});

describe("admin settings", () => {
  it("loads the context through requireAdminPage and passes the feature set down", () => {
    const page = app("admin/settings/page.tsx");

    expect(page).toContain("requireAdminPage(");
    expect(page).toContain("features={context.entitlements.features}");
    expect(page).toContain("billingEnabled={context.billingEnabled}");
    expect(page).toContain("legacyBilling={isLegacyBillingActive()}");
    expect(page).not.toContain("orgPlan");
    expect(page).not.toContain("SELF_HOSTED");
  });

  it("keeps API keys, custom fields and workflows listed without the feature", () => {
    const tabs = app("admin/settings/ui/AdminSettingsPage.tsx");

    expect(tabs).toContain(
      '<ApiKeysTab canCreate={features.includes("api_keys")} />',
    );
    expect(tabs).toContain('canEdit={features.includes("custom_fields")}');
    expect(tabs).not.toContain("PlanGate");
    expect(tabs).not.toContain("FeatureGate");
    expect(app("admin/settings/ui/ApiKeysTab.tsx")).toContain("canCreate");
    expect(app("admin/settings/ui/CustomFieldsAdminTab.tsx")).toContain(
      "canEdit",
    );
  });

  it("shows the legacy billing tab while Stripe runs and the handoff card otherwise", () => {
    const tabs = app("admin/settings/ui/AdminSettingsPage.tsx");

    expect(tabs).toContain(
      "legacyBilling ? <BillingTab /> : <ManageBillingCard />",
    );
  });
});

describe("plan gate removal", () => {
  it("deleted PlanGate and UpgradeRequired", () => {
    expect(existsSync(path.join(SRC_DIR, "components/PlanGate.tsx"))).toBe(
      false,
    );
    expect(
      existsSync(path.join(SRC_DIR, "components/UpgradeRequired.tsx")),
    ).toBe(false);
  });

  it("leaves no import of either", () => {
    const importers = sourceFiles(SRC_DIR)
      .filter((full) =>
        /@\/components\/(PlanGate|UpgradeRequired)|from "\.\/(PlanGate|UpgradeRequired)"/.test(
          readFileSync(full, "utf8"),
        ),
      )
      .map((full) => path.relative(SRC_DIR, full));

    expect(importers).toEqual([]);
  });
});
```

- [ ] **Step 7: Run the scan to verify it fails**

Run: `npx vitest run src/app/__tests__/gated-pages.test.ts`
Expected: FAIL. The per-page cases for the procurement pages, `/tco` and the workflows page fail (they still read the session themselves), as do the reports, dashboard and settings cases (nothing passes `features` yet) and both plan-gate cases (`PlanGate.tsx` and `UpgradeRequired.tsx` still exist). Only "covers every procurement page" passes already.

- [ ] **Step 8: Gate the procurement pages and `/tco`**

Each page loads the context once, returns the panel when the feature is missing, and otherwise renders as before. `requireAdminPage()` keeps today's redirects (`/login` when signed out, `/dashboard` for a non-admin) but now reads the admin flag from the database.

In `src/app/procurement/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import ProcurementList from "./ui/ProcurementList";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import ProcurementList from "./ui/ProcurementList";
```

In `src/app/procurement/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "procurement")) {
  return (
    <FeatureUnavailable
      feature="procurement"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

In `src/app/procurement/create/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import CreatePurchaseRequest from "./ui/CreatePurchaseRequest";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import CreatePurchaseRequest from "./ui/CreatePurchaseRequest";
```

In `src/app/procurement/create/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "procurement")) {
  return (
    <FeatureUnavailable
      feature="procurement"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

In `src/app/procurement/[id]/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import ProcurementDetail from "./ui/ProcurementDetail";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import ProcurementDetail from "./ui/ProcurementDetail";
```

In `src/app/procurement/[id]/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "procurement")) {
  return (
    <FeatureUnavailable
      feature="procurement"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

In `src/app/procurement/orders/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import PurchaseOrderList from "./ui/PurchaseOrderList";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import PurchaseOrderList from "./ui/PurchaseOrderList";
```

In `src/app/procurement/orders/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "procurement")) {
  return (
    <FeatureUnavailable
      feature="procurement"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

In `src/app/procurement/orders/[id]/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import PurchaseOrderDetail from "./ui/PurchaseOrderDetail";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import PurchaseOrderDetail from "./ui/PurchaseOrderDetail";
```

In `src/app/procurement/orders/[id]/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "procurement")) {
  return (
    <FeatureUnavailable
      feature="procurement"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

In `src/app/tco/page.tsx`, replace the session imports with the context imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import TCODashboard from "./ui/TCODashboard";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import TCODashboard from "./ui/TCODashboard";
```

In `src/app/tco/page.tsx`, replace the session check with the context and the feature check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) redirect("/login");
if (!session.user.isadmin) redirect("/dashboard");
```

With:

```tsx
const context = await requireAdminPage();

if (!allowsFeature(context.entitlements, "tco_dashboard")) {
  return (
    <FeatureUnavailable
      feature="tco_dashboard"
      billingEnabled={context.billingEnabled}
    />
  );
}
```

- [ ] **Step 9: Keep the workflow rules reachable, gate creating and editing**

Without `workflow_automation` the page stays open: the rules are listed, can be deactivated (the switch only when the rule is active) and deleted; creating and editing need the feature, like the `POST` and `PUT` routes (Task 8).

In `src/app/admin/workflows/page.tsx`, replace the session imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import WorkflowsPageClient from "./ui/WorkflowsPageClient";
```

With:

```tsx
import Breadcrumb from "@/components/Breadcrumb";
import { allowsFeature } from "@/lib/entitlements-shared";
import { requireAdminPage } from "@/lib/page-context";
import WorkflowsPageClient from "./ui/WorkflowsPageClient";
```

In `src/app/admin/workflows/page.tsx`, replace the session check.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

if (!session.user.isadmin) {
  redirect("/dashboard");
}
```

With:

```tsx
const context = await requireAdminPage();
// Without the feature the rules stay listed, deactivatable and deletable.
const canEdit = allowsFeature(context.entitlements, "workflow_automation");
```

In `src/app/admin/workflows/page.tsx`, pass the flag down.

Replace:

```tsx
<WorkflowsPageClient />
```

With:

```tsx
<WorkflowsPageClient canEdit={canEdit} />
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, import the neutral copy.

Replace:

```tsx
import { Plus, Edit, Trash2, Loader2, Zap } from "lucide-react";
```

With:

```tsx
import { Plus, Edit, Trash2, Loader2, Zap } from "lucide-react";
import { featureUnavailableMessage } from "@/components/FeatureUnavailable";
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, give the component its prop.

Replace:

```tsx
export default function WorkflowsPageClient() {
```

With:

```tsx
interface WorkflowsPageClientProps {
  /** False when the organization lacks workflow_automation: rules can only be deactivated or deleted. */
  canEdit: boolean;
}

export default function WorkflowsPageClient({
  canEdit,
}: WorkflowsPageClientProps) {
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, hide the create button and explain why.

Replace:

```tsx
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      <Separator />
```

With:

```tsx
        {canEdit && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        )}
      </div>

      {!canEdit && (
        <p className="text-muted-foreground text-sm">
          {featureUnavailableMessage("workflow_automation")} Existing rules can
          be deactivated or deleted.
        </p>
      )}

      <Separator />
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, adapt the empty state.

Replace:

```tsx
          No automation rules found. Create your first rule to get started.
```

With:

```tsx
{
  canEdit
    ? "No automation rules found. Create your first rule to get started."
    : "No automation rules found.";
}
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, keep deactivation possible and activation blocked.

Replace:

```tsx
                      disabled={togglingId === rule.id}
```

With:

```tsx
                      disabled={
                        togglingId === rule.id || (!canEdit && !rule.isActive)
                      }
```

In `src/app/admin/workflows/ui/WorkflowsPageClient.tsx`, hide the edit button.

Replace:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => openEditDialog(rule)}
  title="Edit rule"
>
  <Edit className="h-4 w-4" />
</Button>
```

With:

```tsx
{
  canEdit && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => openEditDialog(rule)}
      title="Edit rule"
    >
      <Edit className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 10: Gate the Advanced and TCO report tabs**

The page itself stays open to every member (the basic reports are free); only the two tabs depend on a feature. The tabs mount their content, and so their fetches, only when selected and entitled, so a revoked organization never triggers a refused request. The billing link is shown to admins only.

In `src/app/reports/page.tsx`, replace the session and organization imports with the page context.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ReportsPage from "./ui/ReportsPage";
import Breadcrumb from "@/components/Breadcrumb";
import { getOrganizationContext } from "@/lib/organization-context";
import { getReportData } from "./data";
```

With:

```tsx
import { redirect } from "next/navigation";
import ReportsPage from "./ui/ReportsPage";
import Breadcrumb from "@/components/Breadcrumb";
import { getPageContext } from "@/lib/page-context";
import { getReportData } from "./data";
```

In `src/app/reports/page.tsx`, replace the session and organization lookups with the page context and compute the admin-only billing link.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user) {
  redirect("/login");
}

const ctx = await getOrganizationContext();
const reportData = await getReportData(ctx?.organization?.id ?? null);
```

With:

```tsx
const context = await getPageContext();

if (!context) {
  redirect("/login");
}

const reportData = await getReportData(context.organizationId);
// The billing link in the tab panels is only useful to an admin.
const showBillingLink = context.billingEnabled && context.isAdmin;
```

In `src/app/reports/page.tsx`, pass the features down.

Replace:

```tsx
        depreciationAssets={reportData.depreciationAssets}
      />
```

With:

```tsx
        depreciationAssets={reportData.depreciationAssets}
        features={context.entitlements.features}
        billingEnabled={showBillingLink}
      />
```

In `src/app/reports/ui/ReportsPage.tsx`, import the gate.

Replace:

```tsx
import DepreciationForecastChart from "@/components/charts/DepreciationForecastChart";
```

With:

```tsx
import DepreciationForecastChart from "@/components/charts/DepreciationForecastChart";
import { FeatureGate } from "@/components/FeatureGate";
import type { GatedFeature } from "@/lib/entitlements-shared";
```

In `src/app/reports/ui/ReportsPage.tsx`, extend the props.

Replace:

```tsx
interface ReportsPageProps {
  data: ReportData;
  warrantyAssets: WarrantyAsset[];
  depreciationAssets: DepreciationAsset[];
}
```

With:

```tsx
interface ReportsPageProps {
  data: ReportData;
  warrantyAssets: WarrantyAsset[];
  depreciationAssets: DepreciationAsset[];
  /** The features of the viewer's organization; the Advanced and TCO tabs need one each. */
  features: readonly GatedFeature[];
  billingEnabled: boolean;
}
```

In `src/app/reports/ui/ReportsPage.tsx`, destructure them.

Replace:

```tsx
export default function ReportsPage({
  data,
  warrantyAssets,
  depreciationAssets,
}: ReportsPageProps) {
```

With:

```tsx
export default function ReportsPage({
  data,
  warrantyAssets,
  depreciationAssets,
  features,
  billingEnabled,
}: ReportsPageProps) {
```

In `src/app/reports/ui/ReportsPage.tsx`, wrap the two tab contents.

Replace:

```tsx
        <TabsContent value="advanced" className="mt-6">
          <AdvancedCharts />
        </TabsContent>

        <TabsContent value="tco" className="mt-6">
          <TCOReport />
        </TabsContent>
```

With:

```tsx
        <TabsContent value="advanced" className="mt-6">
          <FeatureGate
            feature="advanced_reports"
            features={features}
            billingEnabled={billingEnabled}
          >
            <AdvancedCharts />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="tco" className="mt-6">
          <FeatureGate
            feature="tco_dashboard"
            features={features}
            billingEnabled={billingEnabled}
          >
            <TCOReport />
          </FeatureGate>
        </TabsContent>
```

- [ ] **Step 11: Do not offer or render the TCO widget without the feature**

A persisted `tco` widget of a revoked organization stays on the dashboard (it can be removed) but loads nothing: `TCOWidget` is never mounted, so the refused request of the data route never happens. `WidgetRegistry` names the feature once; the grid reads it. `TCOWidget`'s own `r.ok` check is Task 7's.

In `src/app/dashboard/page.tsx`, use the page context instead of `getOrganizationContext`.

Replace:

```tsx
import { getOrganizationContext } from "@/lib/organization-context";
import prisma from "@/lib/prisma";
```

With:

```tsx
import { getPageContext } from "@/lib/page-context";
import prisma from "@/lib/prisma";
```

In `src/app/dashboard/page.tsx`, replace the context lookup.

Replace:

```tsx
let ctx: Awaited<ReturnType<typeof getOrganizationContext>> = null;
try {
  ctx = await getOrganizationContext();
} catch {
  redirect("/login");
}
if (!ctx?.userId) {
  redirect("/login");
}
const isAdmin = ctx.isAdmin ?? false;
```

With:

```tsx
const ctx = await getPageContext();
if (!ctx) {
  redirect("/login");
}
const isAdmin = ctx.isAdmin;
const { features } = ctx.entitlements;
```

In `src/app/dashboard/page.tsx`, pass the features to the non-admin grid.

Replace:

```tsx
<DashboardGrid isAdmin={false} />
```

With:

```tsx
<DashboardGrid isAdmin={false} features={features} />
```

In `src/app/dashboard/page.tsx`, use the context's organization id.

Replace:

```tsx
        organizationId: ctx.organization?.id ?? null,
```

With:

```tsx
        organizationId: ctx.organizationId,
```

In `src/app/dashboard/page.tsx`, pass the features to the admin grid.

Replace:

```tsx
<DashboardGrid
  serverStats={{
    assets: assetCount,
    accessories: accessoryCount,
    users: userCount,
  }}
/>
```

With:

```tsx
<DashboardGrid
  serverStats={{
    assets: assetCount,
    accessories: accessoryCount,
    users: userCount,
  }}
  features={features}
/>
```

In `src/components/dashboard/WidgetRegistry.ts`, let a definition name its feature.

Replace:

```ts
export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon?: string;
  adminOnly?: boolean;
  defaultConfig?: Record<string, unknown>;
}
```

With:

```ts
import type { GatedFeature } from "@/lib/entitlements-shared";

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon?: string;
  adminOnly?: boolean;
  /** The entitlement the widget's data needs; without it the widget is neither offered nor rendered. */
  feature?: GatedFeature;
  defaultConfig?: Record<string, unknown>;
}
```

In `src/components/dashboard/WidgetRegistry.ts`, mark the TCO widget.

Replace:

```ts
    description: "Aggregate costs: purchase + maintenance + licences",
    adminOnly: true,
  },
```

With:

```ts
    description: "Aggregate costs: purchase + maintenance + licences",
    adminOnly: true,
    feature: "tco_dashboard",
  },
```

In `src/components/dashboard/DashboardGrid.tsx`, import the copy and the type below the `WidgetRegistry` import (leave Task 7's `loadTcoWidget` import where it is).

Replace:

```tsx
import { WIDGET_DEFINITIONS } from "./WidgetRegistry";
```

With:

```tsx
import { WIDGET_DEFINITIONS } from "./WidgetRegistry";
import { featureUnavailableMessage } from "@/components/FeatureUnavailable";
import type { GatedFeature } from "@/lib/entitlements-shared";
```

In `src/components/dashboard/DashboardGrid.tsx`, give `SortableWidget` the features.

Replace:

```tsx
function SortableWidget({
  widget,
  onRemove,
  serverStats,
}: {
  widget: DashboardWidgetData;
  onRemove: (id: string) => void;
  serverStats?: { assets: number; accessories: number; users: number };
}) {
```

With:

```tsx
function SortableWidget({
  widget,
  onRemove,
  serverStats,
  features,
}: {
  widget: DashboardWidgetData;
  onRemove: (id: string) => void;
  serverStats?: { assets: number; accessories: number; users: number };
  features: readonly GatedFeature[];
}) {
```

In `src/components/dashboard/DashboardGrid.tsx`, find the widget's missing feature.

Replace:

```tsx
const title = definition?.title ?? widget.widgetType;
```

With:

```tsx
const title = definition?.title ?? widget.widgetType;
// A persisted widget whose feature was revoked stays removable but loads no data.
const missingFeature =
  definition?.feature && !features.includes(definition.feature)
    ? definition.feature
    : null;
```

In `src/components/dashboard/DashboardGrid.tsx`, render the neutral line instead of the data widget.

Replace:

```tsx
<CardContent>
  <WidgetContent widgetType={widget.widgetType} serverStats={serverStats} />
</CardContent>
```

With:

```tsx
<CardContent>
  {missingFeature ? (
    <p className="text-muted-foreground text-sm">
      {featureUnavailableMessage(missingFeature)}
    </p>
  ) : (
    <WidgetContent widgetType={widget.widgetType} serverStats={serverStats} />
  )}
</CardContent>
```

In `src/components/dashboard/DashboardGrid.tsx`, accept the features (fail closed: none by default).

Replace:

```tsx
export default function DashboardGrid({
  serverStats,
  isAdmin = true,
}: {
  serverStats?: { assets: number; accessories: number; users: number };
  isAdmin?: boolean;
} = {}) {
```

With:

```tsx
export default function DashboardGrid({
  serverStats,
  isAdmin = true,
  features = [],
}: {
  serverStats?: { assets: number; accessories: number; users: number };
  isAdmin?: boolean;
  /** The organization's features; a widget that needs one it lacks is not offered. */
  features?: readonly GatedFeature[];
} = {}) {
```

In `src/components/dashboard/DashboardGrid.tsx`, do not offer a widget whose feature is missing.

Replace:

```tsx
    (d) => !activeTypes.has(d.type) && (isAdmin || !d.adminOnly),
```

With:

```tsx
    (d) =>
      !activeTypes.has(d.type) &&
      (isAdmin || !d.adminOnly) &&
      (!d.feature || features.includes(d.feature)),
```

In `src/components/dashboard/DashboardGrid.tsx`, pass the features to every widget.

Replace:

```tsx
                onRemove={handleRemove}
                serverStats={serverStats}
              />
```

With:

```tsx
                onRemove={handleRemove}
                serverStats={serverStats}
                features={features}
              />
```

- [ ] **Step 12: Replace `PlanGate` in the settings**

The API key list, the custom field definitions and the billing tab are not hidden behind a panel: the first two stay listed (and revocable or deletable) without the feature, so the tabs get a `canCreate`/`canEdit` prop instead of a `FeatureGate`. The billing tab shows the legacy `BillingTab` while the Stripe code runs and the handoff card otherwise (the tab itself is visible only when `billingEnabled`, from Task 3). The page reads the stored email and the organization from the context, which removes its own user and organization queries.

Task 3 added `import { isBillingEnabled, isCloudMode } from "@/lib/deployment-mode";` to the page; after this change nothing in the page uses it, so the second import edit below removes it.

In `src/app/admin/settings/page.tsx`, drop the session imports.

Replace:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import AdminSettingsPage from "./ui/AdminSettingsPage";
```

With:

```tsx
import AdminSettingsPage from "./ui/AdminSettingsPage";
```

In `src/app/admin/settings/page.tsx`, swap the imports (Task 3's deployment-mode import goes, the context and the legacy-billing check come).

Replace:

```tsx
import { isSuperAdmin } from "@/lib/super-admin";
import { isBillingEnabled, isCloudMode } from "@/lib/deployment-mode";
```

With:

```tsx
import { isSuperAdmin } from "@/lib/super-admin";
import { isLegacyBillingActive } from "@/lib/legacy-billing";
import { requireAdminPage } from "@/lib/page-context";
```

In `src/app/admin/settings/page.tsx`, replace the session, user and plan lookups with the context.

Replace:

```tsx
const session = await auth.api.getSession({ headers: await headers() });

if (!session?.user?.isadmin) {
  redirect("/dashboard");
}

const adminUser = await prisma.user.findUnique({
  where: { userid: session.user.id },
  select: { organizationId: true, email: true },
});

// Determine if current admin is a platform super-admin. The email comes from
// the database row, never from the session.
const isSuperAdminUser = await isSuperAdmin({
  id: session.user.id,
  email: adminUser?.email,
});

const orgPlan = adminUser?.organizationId
  ? ((
      await prisma.organization.findUnique({
        where: { id: adminUser.organizationId },
        select: { plan: true },
      })
    )?.plan ?? "starter")
  : "starter";
```

With:

```tsx
const context = await requireAdminPage();

// Determine if current admin is a platform super-admin. The email comes from
// the database row, never from the session.
const isSuperAdminUser = await isSuperAdmin({
  id: context.userId,
  email: context.email,
});
```

In `src/app/admin/settings/page.tsx`, use the context's organization id for the loaders.

Replace:

```tsx
getUsers(adminUser?.organizationId ?? null),
```

With:

```tsx
getUsers(context.organizationId),
```

In `src/app/admin/settings/page.tsx`, use the context's organization id for the loaders.

Replace:

```tsx
getCustomFields(adminUser?.organizationId ?? null),
```

With:

```tsx
getCustomFields(context.organizationId),
```

In `src/app/admin/settings/page.tsx`, use the context's organization id for the loaders.

Replace:

```tsx
getDepreciationSettings(adminUser?.organizationId ?? null),
```

With:

```tsx
getDepreciationSettings(context.organizationId),
```

In `src/app/admin/settings/page.tsx`, use the context's organization id for the loaders.

Replace:

```tsx
getStatusTypes(adminUser?.organizationId ?? null),
```

With:

```tsx
getStatusTypes(context.organizationId),
```

In `src/app/admin/settings/page.tsx`, pass the features instead of the plan.

Replace:

```tsx
        orgPlan={orgPlan as "starter" | "professional" | "enterprise"}
        cloudMode={isCloudMode()}
        billingEnabled={isBillingEnabled()}
```

With:

```tsx
        features={context.entitlements.features}
        billingEnabled={context.billingEnabled}
        legacyBilling={isLegacyBillingActive()}
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, replace the `PlanGate` import.

Replace:

```tsx
import { PlanGate } from "@/components/PlanGate";
```

With:

```tsx
import { ManageBillingCard } from "@/components/ManageBillingCard";
import type { GatedFeature } from "@/lib/entitlements-shared";
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, replace the plan and mode props with the feature set (Task 3 left `orgPlan` and `cloudMode`; `billingEnabled` stays).

Replace:

```tsx
  orgPlan?: "starter" | "professional" | "enterprise";
  /** Cloud mode: the hosted deployment (entitlements and billing exist). */
  cloudMode: boolean;
```

With:

```tsx
  /** The features of the viewer's organization (API keys, custom fields). */
  features: readonly GatedFeature[];
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, add the legacy billing flag next to `billingEnabled`.

Replace:

```tsx
  /** Cloud mode with a billing path configured (isBillingEnabled). */
  billingEnabled: boolean;
}
```

With:

```tsx
  /** Cloud mode with a billing path configured (isBillingEnabled). */
  billingEnabled: boolean;
  /** True while the Stripe code in this deployment still runs (until phase 3a). */
  legacyBilling: boolean;
}
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, replace the matching destructured parameters.

Replace:

```tsx
  orgPlan = "starter",
  cloudMode,
  billingEnabled,
}: AdminSettingsPageProps) {
```

With:

```tsx
  features,
  billingEnabled,
  legacyBilling,
}: AdminSettingsPageProps) {
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, choose the billing tab content.

Replace:

```tsx
{
  activeTab === "billing" && <BillingTab />;
}
```

With:

```tsx
{
  activeTab === "billing" &&
    (legacyBilling ? <BillingTab /> : <ManageBillingCard />);
}
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, let the custom fields tab know whether it may create and edit.

Replace:

```tsx
{
  activeTab === "custom-fields" && <CustomFieldsAdminTab />;
}
```

With:

```tsx
{
  activeTab === "custom-fields" && (
    <CustomFieldsAdminTab canEdit={features.includes("custom_fields")} />
  );
}
```

In `src/app/admin/settings/ui/AdminSettingsPage.tsx`, replace the `PlanGate` around the API keys (Task 3 gave it `isSelfHosted={!cloudMode}`).

Replace:

```tsx
{
  activeTab === "api-keys" && (
    <PlanGate feature="api_keys" plan={orgPlan} isSelfHosted={!cloudMode}>
      <ApiKeysTab />
    </PlanGate>
  );
}
```

With:

```tsx
{
  activeTab === "api-keys" && (
    <ApiKeysTab canCreate={features.includes("api_keys")} />
  );
}
```

In `src/app/admin/settings/ui/ApiKeysTab.tsx`, import the neutral copy.

Replace:

```tsx
  AlertTriangle,
} from "lucide-react";
```

With:

```tsx
  AlertTriangle,
} from "lucide-react";
import { featureUnavailableMessage } from "@/components/FeatureUnavailable";
```

In `src/app/admin/settings/ui/ApiKeysTab.tsx`, give the tab its prop.

Replace:

```tsx
export default function ApiKeysTab() {
```

With:

```tsx
interface ApiKeysTabProps {
  /** False when the organization lacks api_keys: keys stay listed and revocable. */
  canCreate: boolean;
}

export default function ApiKeysTab({ canCreate }: ApiKeysTabProps) {
```

In `src/app/admin/settings/ui/ApiKeysTab.tsx`, hide the create button and explain why.

Replace:

```tsx
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <Separator />
```

With:

```tsx
        {canCreate && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        )}
      </div>

      {!canCreate && (
        <p className="text-muted-foreground text-sm">
          {featureUnavailableMessage("api_keys")} Existing keys stay listed and
          can be revoked.
        </p>
      )}

      <Separator />
```

In `src/app/admin/settings/ui/ApiKeysTab.tsx`, adapt the empty state.

Replace:

```tsx
          No API keys found. Create your first API key to get started.
```

With:

```tsx
{
  canCreate
    ? "No API keys found. Create your first API key to get started."
    : "No API keys found.";
}
```

In `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`, import the neutral copy.

Replace:

```tsx
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
```

With:

```tsx
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { featureUnavailableMessage } from "@/components/FeatureUnavailable";
```

In `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`, give the tab its prop.

Replace:

```tsx
export default function CustomFieldsAdminTab() {
```

With:

```tsx
interface CustomFieldsAdminTabProps {
  /** False when the organization lacks custom_fields: definitions stay listed and deletable. */
  canEdit: boolean;
}

export default function CustomFieldsAdminTab({
  canEdit,
}: CustomFieldsAdminTabProps) {
```

In `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`, hide the create button and explain why.

Replace:

```tsx
            <CardDescription>
              Manage custom field definitions for assets, consumables, licences,
              and accessories
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Field
          </Button>
        </CardHeader>
```

With:

```tsx
            <CardDescription>
              Manage custom field definitions for assets, consumables, licences,
              and accessories
            </CardDescription>
            {!canEdit && (
              <CardDescription>
                {featureUnavailableMessage("custom_fields")} Existing
                definitions stay listed and can be deleted; values already
                entered stay readable.
              </CardDescription>
            )}
          </div>
          {canEdit && (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Field
            </Button>
          )}
        </CardHeader>
```

In `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`, adapt the empty state.

Replace:

```tsx
                No custom fields defined. Create one to get started.
```

With:

```tsx
{
  canEdit
    ? "No custom fields defined. Create one to get started."
    : "No custom fields defined.";
}
```

In `src/app/admin/settings/ui/CustomFieldsAdminTab.tsx`, hide the edit button (delete stays).

Replace:

```tsx
<Button variant="ghost" size="sm" onClick={() => openEditDialog(field)}>
  <Pencil className="h-4 w-4" />
</Button>
```

With:

```tsx
{
  canEdit && (
    <Button variant="ghost" size="sm" onClick={() => openEditDialog(field)}>
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 13: Delete the plan gate**

Nothing imports `PlanGate` or `UpgradeRequired` any more (the scan checks it).

```bash
git rm src/components/PlanGate.tsx src/components/UpgradeRequired.tsx
```

- [ ] **Step 14: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/app/__tests__/gated-pages.test.ts src/lib/__tests__/page-context.test.ts src/components/__tests__/feature-gate.test.ts src/app/__tests__`
Expected: PASS (`server-pages-static-scope.test.ts` still passes: the settings and reports pages gained no unfiltered `findMany`).

Run: `npx tsc --noEmit -p .` and `npx eslint src/app/procurement src/app/tco src/app/admin/workflows src/app/reports src/app/dashboard src/app/admin/settings src/components/dashboard src/app/__tests__/gated-pages.test.ts`
Expected: no errors.

The task deleted shared components and changed the dashboard, the reports and the settings: run `npx vitest run`.
Expected: all pass (DB tests skipped locally).

- [ ] **Step 15: Commit**

```bash
git add src/app/procurement src/app/tco src/app/admin/workflows src/app/reports src/app/dashboard src/app/admin/settings src/components/dashboard src/app/__tests__/gated-pages.test.ts
git commit -m "feat: gate pages and settings tabs by organization entitlements"
```

`git rm` in Step 13 already staged the two deletions; they land in the same commit.
