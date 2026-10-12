# SaaS Boundary Phase 1a (Expand and Dual-Write) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `entitlements` and `lockedAt` columns, record entitlements alongside the legacy plan columns, and ship a guarded backfill script, without changing any behaviour (nothing reads the new columns yet).

**Architecture:** One hand-written additive migration adds two nullable columns to `organizations`. A client-safe module (`entitlements-shared.ts`) defines the entitlement types and schema; a temporary module (`legacy-billing.ts`, deleted in phase 3a) maps legacy plans to entitlements. The legacy writers (Stripe webhook, trial cron, register trial) dual-write. Tenant-facing organization routes switch to an explicit `select` allow-list so neither the billing columns nor the new columns ever leave the server. A Bun script with a database target guard backfills existing organizations.

**Tech Stack:** Next.js 16.2 (App Router), Prisma 7 (`@prisma/adapter-pg`), `pg` 8, zod 4, vitest 4, Bun.

**Spec:** `docs/superpowers/specs/2026-10-05-saas-boundary-design.md` (sections 2, 5 and 7 "Phase 1a"; read the "Revision 3" section at its end first). The phase 1b plan is `docs/superpowers/plans/2026-10-12-saas-boundary-1b.md`.

## Global Constraints

- Branch `feat/saas-boundary-1a` from `development`. Do not push.
- Release version `0.15.0`, bumped in Task 5 only.
- Commits: conventional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), English, header ≤ 100 characters, body lines ≤ 100 characters, no `Co-Authored-By`, no mention of Claude. Git identity is the existing `LucaGerlich` one (private repo).
- Code style: TypeScript strict in new code (the repo's `tsconfig` is not strict; write as if it were), no `any`, named exports. Keep the repo's Prettier style (2-space indent, double quotes; the pre-commit hook formats).
- **Nothing reads `entitlements` or `lockedAt` in this release.** Do not touch `src/lib/deployment-mode.ts` or any `isSelfHosted()` caller.
- Never run `prisma db push`, `prisma migrate reset` or `prisma migrate dev`. Write the migration SQL by hand. Never run `bun run build` (it migrates whatever `DATABASE_URL` points at); use `npx next build` only if a build check is needed.
- **Never run `scripts/backfill-entitlements.ts` locally.** Bun auto-loads `.env`, and the local `.env` points at the shared production database. The script is exercised only through its tests.
- DB-backed tests use the existing gate: `process.env.DATABASE_URL && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1" ? describe : describe.skip`, and run inside a transaction that is always rolled back. They run in CI only. Vitest 4 takes test options as the second argument: `it(name, { timeout }, fn)` (the old `it(name, fn, options)` form throws at collection).
- Never write `Prisma.JsonNull` into `entitlements`. "Not set" is SQL NULL (omit the field or use `Prisma.DbNull`).
- After every task: `npx vitest run <the task's test files>`, then `npx tsc --noEmit -p .`, then `npx eslint <touched files under src/>`.

## Review Focus

1. **A tenant org admin must never receive** `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`, `maxAssets`, `maxUsers`, `suspendedAt`, `entitlements` or `lockedAt` from any organization route: GET list (both the paginated and the unpaginated branch), POST, GET by id, PUT. Owner: Task 1 (tests assert every query's `select`).
2. **Backfill against the wrong database or schema.** The script must refuse to run without `--schema`, print the target before any query, refuse `--apply` unless `--confirm` repeats that target exactly, and abort when the schema has no `entitlements` column. Owner: Task 4.
3. **Backfill must never overwrite entitlements that are already set**, but must fill a JSON `null` (the spec treats it as NULL). Owner: Task 4 (DB test: a set row is untouched, a JSON-null row is filled, a second apply changes nothing).
4. **Legacy unlimited sentinels.** `-1` (plan table, register) and `999999` (Stripe webhook) both mean unlimited; an enterprise org written by either path gets the same entitlements. Owner: Task 2.
5. **Self-hosted installs write nothing new.** Without `STRIPE_SECRET_KEY`, register and the trial cron write no `entitlements`. Owner: Task 3.

---

### Task 1: Columns and the organization response allow-list

The new columns must not leak through the four organization routes, which today return whole rows (and so already leak the billing columns). Both changes ship together.

**Files:**

- Create: `prisma/migrations/20261012_org_entitlements_locked_at/migration.sql`
- Modify: `prisma/schema.prisma` (model `Organization`, after `suspendedAt`)
- Create: `src/lib/organizations.ts`
- Modify: `src/app/api/organizations/route.ts` (GET both branches, POST)
- Modify: `src/app/api/organizations/[id]/route.ts` (GET, PUT; DELETE never returns the row and stays as is)
- Test: `src/lib/__tests__/organizations.test.ts` (create)
- Test: `src/app/api/__tests__/organizations-list-create.test.ts` (create)
- Test: `src/app/api/__tests__/organizations-id.test.ts` (extend)

**Interfaces:**

- Produces: `organizationApiSelect` in `src/lib/organizations.ts`, a `Prisma.OrganizationSelect` with exactly `id, name, slug, description, settings, isActive, createdAt, updatedAt`. Phase 1b adds `createOrganization` to the same file.
- Produces: `Organization.entitlements Json?` and `Organization.lockedAt DateTime? @db.Timestamp(6)` in the Prisma client.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/organizations.test.ts
import { describe, it, expect } from "vitest";
import { organizationApiSelect } from "@/lib/organizations";

describe("organizationApiSelect", () => {
  it("selects only the fields tenants may see", () => {
    expect(Object.keys(organizationApiSelect).sort()).toEqual([
      "createdAt",
      "description",
      "id",
      "isActive",
      "name",
      "settings",
      "slug",
      "updatedAt",
    ]);
  });
});
```

A shared assertion helper (not a `.test.ts` file, so vitest does not collect it):

```ts
// src/app/api/__tests__/org-select-assertions.ts
import { expect } from "vitest";

/** Columns that must never reach a tenant through an organization route. */
export const HIDDEN_ORG_FIELDS = [
  "plan",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "trialEndsAt",
  "maxAssets",
  "maxUsers",
  "suspendedAt",
  "entitlements",
  "lockedAt",
] as const;

/** Asserts a Prisma call uses an explicit select without any hidden column. */
export function expectAllowListSelect(args: unknown): void {
  const query = args as { select?: Record<string, unknown>; include?: unknown };
  expect(query.include).toBeUndefined();
  expect(query.select).toBeDefined();
  for (const field of HIDDEN_ORG_FIELDS) {
    expect(query.select).not.toHaveProperty(field);
  }
}
```

```ts
// src/app/api/__tests__/organizations-list-create.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";
import { expectAllowListSelect } from "./org-select-assertions";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
}));

import { GET, POST } from "@/app/api/organizations/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findMany.mockResolvedValue([]);
  mockPrisma.organization.count.mockResolvedValue(0);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
  mockPrisma.organization.create.mockResolvedValue({
    id: "org-new",
    name: "New",
    slug: "new",
  } as never);
});

describe("GET /api/organizations", () => {
  it("selects only tenant-visible fields without pagination", async () => {
    await GET(createMockRequest("/api/organizations"));
    expectAllowListSelect(mockPrisma.organization.findMany.mock.calls[0][0]);
  });

  it("selects only tenant-visible fields with pagination", async () => {
    await GET(createMockRequest("/api/organizations?page=1"));
    expectAllowListSelect(mockPrisma.organization.findMany.mock.calls[0][0]);
  });

  it("still returns the relation counts the settings UI reads", async () => {
    await GET(createMockRequest("/api/organizations"));
    const args = mockPrisma.organization.findMany.mock.calls[0][0] as {
      select: { _count: unknown };
    };
    expect(args.select._count).toEqual({
      select: { users: true, assets: true, departments: true },
    });
  });
});

describe("POST /api/organizations", () => {
  it("returns only tenant-visible fields of the created organization", async () => {
    const res = await POST(
      createMockRequest("/api/organizations", {
        method: "POST",
        body: { name: "New", slug: "new" },
      }),
    );
    expect(res.status).toBe(201);
    expectAllowListSelect(mockPrisma.organization.create.mock.calls[0][0]);
  });
});
```

Append to `src/app/api/__tests__/organizations-id.test.ts` (it already mocks prisma and api-auth), with `import { expectAllowListSelect } from "./org-select-assertions";` added to its imports:

```ts
describe("organization responses never carry billing or control-plane columns", () => {
  it("GET selects only tenant-visible fields", async () => {
    await GET(createMockRequest("/api/organizations/org-uuid-001"), params);
    expectAllowListSelect(mockPrisma.organization.findUnique.mock.calls[0][0]);
  });

  it("PUT returns only tenant-visible fields", async () => {
    await PUT(
      createMockRequest("/api/organizations/org-uuid-001", {
        method: "PUT",
        body: { name: "Acme" },
      }),
      params,
    );
    expectAllowListSelect(mockPrisma.organization.update.mock.calls[0][0]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/organizations.test.ts src/app/api/__tests__/organizations-list-create.test.ts src/app/api/__tests__/organizations-id.test.ts`
Expected: FAIL (`@/lib/organizations` does not exist; the routes pass `include` and no `select`).

- [ ] **Step 3: Write the migration and the schema fields**

```sql
-- prisma/migrations/20261012_org_entitlements_locked_at/migration.sql
-- SaaS boundary phase 1a (docs/superpowers/specs/2026-10-05-saas-boundary-design.md, section 7).
-- Expand only: two nullable columns, no default, no backfill. Nothing reads them in this
-- release. "entitlements" is filled by the legacy billing writers and by
-- scripts/backfill-entitlements.ts; "lockedAt" is written only by the internal API (phase 1b).
-- Adding a nullable column without a default is a catalog-only change, safe on the shared
-- production database.
ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "entitlements" JSONB;
ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(6);
```

In `prisma/schema.prisma`, model `Organization`, replace the suspension block:

```prisma
  // Suspension
  suspendedAt DateTime? @db.Timestamp(6)
  // Control-plane lock (SaaS only). Written only by the internal API.
  lockedAt    DateTime? @db.Timestamp(6)

  // Per-org entitlements (SaaS only). SQL NULL means "not set"; never store a JSON null.
  entitlements Json?
```

Run: `npx prisma generate`
Expected: the client is generated without errors.

- [ ] **Step 4: Write the allow-list and use it in the routes**

```ts
// src/lib/organizations.ts
import type { Prisma } from "@prisma/client";

/**
 * The organization columns tenant-facing routes may return. Billing columns,
 * entitlements, lockedAt and suspendedAt never leave the server through them.
 */
export const organizationApiSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  settings: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;
```

In `src/app/api/organizations/route.ts`, import `organizationApiSelect` from `@/lib/organizations` and replace the `include` constant and its two uses:

```ts
const select = {
  ...organizationApiSelect,
  _count: {
    select: { users: true, assets: true, departments: true },
  },
};

// If no `page` param, return all results for backward compatibility
if (!searchParams.has("page")) {
  const organizations = await prisma.organization.findMany({
    where: orgFilter,
    select,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(organizations);
}
```

and in the paginated branch `prisma.organization.findMany({ where, select, ...prismaArgs })`. In POST, add `select: organizationApiSelect` to `prisma.organization.create({ data: {...}, select: organizationApiSelect })`.

In `src/app/api/organizations/[id]/route.ts`, GET:

```ts
const organization = await prisma.organization.findUnique({
  where: { id },
  select: {
    ...organizationApiSelect,
    departments: {
      orderBy: { name: "asc" },
    },
    _count: {
      select: {
        users: true,
        assets: true,
        accessories: true,
        licences: true,
      },
    },
  },
});
```

and PUT: `prisma.organization.update({ where: { id }, data: updateData, select: organizationApiSelect })`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/organizations.test.ts src/app/api/__tests__/organizations-list-create.test.ts src/app/api/__tests__/organizations-id.test.ts`
Expected: PASS. Then `npx tsc --noEmit -p .` passes.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/20261012_org_entitlements_locked_at prisma/schema.prisma src/lib/organizations.ts src/app/api/organizations src/lib/__tests__/organizations.test.ts src/app/api/__tests__/organizations-list-create.test.ts src/app/api/__tests__/organizations-id.test.ts src/app/api/__tests__/org-select-assertions.ts
git commit -m "feat: add entitlements and lockedAt columns and stop returning billing columns to tenants"
```

---

### Task 2: Entitlement types and the legacy plan mapping

**Files:**

- Create: `src/lib/entitlements-shared.ts` (permanent; client-safe)
- Create: `src/lib/legacy-billing.ts` (temporary; deleted in phase 3a)
- Test: `src/lib/__tests__/entitlements-shared.test.ts` (create)
- Test: `src/lib/__tests__/legacy-billing.test.ts` (create)

**Interfaces:**

- Produces (`src/lib/entitlements-shared.ts`; imports only `zod`):
  - `GATED_FEATURES` (readonly tuple, in this order): `api_keys, procurement, scim, advanced_reports, tco_dashboard, custom_fields, workflow_automation`
  - `type GatedFeature = (typeof GATED_FEATURES)[number]`
  - `entitlementsSchema`: zod strict object `{ features: GatedFeature[], maxAssets: int ≥ 0 | null, maxUsers: int ≥ 0 | null }`
  - `type Entitlements = z.infer<typeof entitlementsSchema>` (a type alias, so it is assignable to `Prisma.InputJsonValue` without a cast)
  - `UNRESTRICTED: Entitlements` (all features, both limits `null`)
  - `FEATURE_LABELS: Record<GatedFeature, string>`
  - `interface OrgUsage { assets: number; users: number }`
  - `isOverLimit(entitlements: Entitlements, usage: OrgUsage): boolean` (strictly greater than a non-null limit)
  - `featuresInOrder(features: Iterable<GatedFeature>): GatedFeature[]` (deduplicated, in `GATED_FEATURES` order)
- Produces (`src/lib/legacy-billing.ts`; imports only `entitlements-shared`):
  - `isLegacyBillingActive(): boolean` (`Boolean(process.env.STRIPE_SECRET_KEY)`)
  - `type LegacyPlan = "starter" | "professional" | "enterprise"`
  - `isLegacyPlan(plan: string): plan is LegacyPlan`
  - `legacyLimit(value: number): number | null` (`-1` or `≥ 999999` → `null`; any other negative → `0`; otherwise the value)
  - `legacyPlanToEntitlements(plan: string, maxAssets: number, maxUsers: number): Entitlements` (an unknown plan maps to starter; callers log it)
  - `ENFORCED_BEFORE_ENTITLEMENTS: readonly GatedFeature[]` = `["api_keys", "procurement"]` (the only features the core enforced through 0.15.0; used by the backfill report)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/entitlements-shared.test.ts
import { describe, it, expect } from "vitest";
import {
  GATED_FEATURES,
  UNRESTRICTED,
  entitlementsSchema,
  featuresInOrder,
  isOverLimit,
} from "@/lib/entitlements-shared";

describe("entitlementsSchema", () => {
  it("accepts a valid value", () => {
    const value = { features: ["api_keys"], maxAssets: 10, maxUsers: null };
    expect(entitlementsSchema.parse(value)).toEqual(value);
  });

  it("rejects an unknown feature", () => {
    expect(
      entitlementsSchema.safeParse({
        features: ["white_label"],
        maxAssets: null,
        maxUsers: null,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      entitlementsSchema.safeParse({
        features: [],
        maxAssets: null,
        maxUsers: null,
        plan: "pro",
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5, "10"])("rejects the limit %s", (maxAssets) => {
    expect(
      entitlementsSchema.safeParse({ features: [], maxAssets, maxUsers: null })
        .success,
    ).toBe(false);
  });

  it("accepts zero as a limit", () => {
    expect(
      entitlementsSchema.safeParse({ features: [], maxAssets: 0, maxUsers: 0 })
        .success,
    ).toBe(true);
  });

  it("requires every key", () => {
    expect(entitlementsSchema.safeParse({ features: [] }).success).toBe(false);
  });
});

describe("UNRESTRICTED", () => {
  it("grants every feature without limits", () => {
    expect(UNRESTRICTED).toEqual({
      features: [...GATED_FEATURES],
      maxAssets: null,
      maxUsers: null,
    });
  });
});

describe("isOverLimit", () => {
  const limits = { features: [], maxAssets: 10, maxUsers: 3 };

  it("is false at the limit", () => {
    expect(isOverLimit(limits, { assets: 10, users: 3 })).toBe(false);
  });

  it("is true above either limit", () => {
    expect(isOverLimit(limits, { assets: 11, users: 0 })).toBe(true);
    expect(isOverLimit(limits, { assets: 0, users: 4 })).toBe(true);
  });

  it("never applies a null limit", () => {
    expect(
      isOverLimit(
        { features: [], maxAssets: null, maxUsers: null },
        { assets: 1e9, users: 1e9 },
      ),
    ).toBe(false);
  });

  it("treats a zero limit as a real limit", () => {
    expect(
      isOverLimit(
        { features: [], maxAssets: 0, maxUsers: null },
        { assets: 1, users: 0 },
      ),
    ).toBe(true);
  });
});

describe("featuresInOrder", () => {
  it("deduplicates and sorts by GATED_FEATURES order", () => {
    expect(featuresInOrder(["scim", "api_keys", "scim"])).toEqual([
      "api_keys",
      "scim",
    ]);
  });
});
```

```ts
// src/lib/__tests__/legacy-billing.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isLegacyBillingActive,
  isLegacyPlan,
  legacyLimit,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";

const PROFESSIONAL = [
  "api_keys",
  "procurement",
  "advanced_reports",
  "tco_dashboard",
  "custom_fields",
  "workflow_automation",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacyPlanToEntitlements", () => {
  it("gives starter no features", () => {
    expect(legacyPlanToEntitlements("starter", 100, 3)).toEqual({
      features: [],
      maxAssets: 100,
      maxUsers: 3,
    });
  });

  it("gives professional the professional features", () => {
    expect(legacyPlanToEntitlements("professional", 5000, 25)).toEqual({
      features: PROFESSIONAL,
      maxAssets: 5000,
      maxUsers: 25,
    });
  });

  it("gives enterprise professional plus scim", () => {
    expect(legacyPlanToEntitlements("enterprise", -1, -1)).toEqual({
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
    });
  });

  it("maps the webhook's 999999 and the plan table's -1 to the same value", () => {
    expect(legacyPlanToEntitlements("enterprise", 999999, 999999)).toEqual(
      legacyPlanToEntitlements("enterprise", -1, -1),
    );
  });

  it("maps an unknown plan to starter features", () => {
    expect(legacyPlanToEntitlements("gold", 100, 3).features).toEqual([]);
  });
});

describe("legacyLimit", () => {
  it.each([
    [-1, null],
    [999999, null],
    [1000000, null],
    [0, 0],
    [25, 25],
    [-5, 0],
  ])("maps %s to %s", (input, expected) => {
    expect(legacyLimit(input)).toBe(expected);
  });
});

describe("isLegacyPlan", () => {
  it("knows the three legacy plans only", () => {
    expect(["starter", "professional", "enterprise"].every(isLegacyPlan)).toBe(
      true,
    );
    expect(isLegacyPlan("gold")).toBe(false);
    expect(isLegacyPlan("toString")).toBe(false);
  });
});

describe("isLegacyBillingActive", () => {
  it("is true when the Stripe secret key is set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(isLegacyBillingActive()).toBe(true);
  });

  it("is false when it is unset or empty", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(isLegacyBillingActive()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/legacy-billing.test.ts`
Expected: FAIL (modules do not exist).

- [ ] **Step 3: Write the modules**

```ts
// src/lib/entitlements-shared.ts
import { z } from "zod";

/**
 * Per-organization entitlements: which gated features an organization may use
 * and its resource limits. Shared between client and server, so this module
 * must stay free of database and server-only imports.
 */

export const GATED_FEATURES = [
  "api_keys",
  "procurement",
  "scim",
  "advanced_reports",
  "tco_dashboard",
  "custom_fields",
  "workflow_automation",
] as const;

export type GatedFeature = (typeof GATED_FEATURES)[number];

/** A resource limit: a whole number of at least 0, or null for unlimited. */
const limitSchema = z.number().int().min(0).nullable();

/**
 * The strict shape used on every write path: unknown keys and unknown
 * features are rejected. Readers are lenient instead (phase 1b).
 */
export const entitlementsSchema = z.strictObject({
  features: z.array(z.enum(GATED_FEATURES)),
  maxAssets: limitSchema,
  maxUsers: limitSchema,
});

export type Entitlements = z.infer<typeof entitlementsSchema>;

/** Every feature, no limits: what self-hosted deployments always get. */
export const UNRESTRICTED: Entitlements = {
  features: [...GATED_FEATURES],
  maxAssets: null,
  maxUsers: null,
};

export const FEATURE_LABELS: Record<GatedFeature, string> = {
  api_keys: "API keys",
  procurement: "Procurement",
  scim: "SCIM provisioning",
  advanced_reports: "Advanced reports",
  tco_dashboard: "TCO dashboard",
  custom_fields: "Custom fields",
  workflow_automation: "Workflow automation",
};

export interface OrgUsage {
  assets: number;
  users: number;
}

/** True when usage is above a limit. Being exactly at a limit is not over it. */
export function isOverLimit(
  entitlements: Entitlements,
  usage: OrgUsage,
): boolean {
  return (
    (entitlements.maxAssets !== null &&
      usage.assets > entitlements.maxAssets) ||
    (entitlements.maxUsers !== null && usage.users > entitlements.maxUsers)
  );
}

/** Deduplicated features in GATED_FEATURES order, for stable stored values. */
export function featuresInOrder(
  features: Iterable<GatedFeature>,
): GatedFeature[] {
  const wanted = new Set(features);
  return GATED_FEATURES.filter((feature) => wanted.has(feature));
}
```

```ts
// src/lib/legacy-billing.ts
import {
  featuresInOrder,
  type Entitlements,
  type GatedFeature,
} from "@/lib/entitlements-shared";

/**
 * Legacy billing: Stripe inside the core and the plan, maxAssets and maxUsers
 * columns. Deleted in phase 3a of the SaaS boundary, once the control plane
 * owns billing. Free of server-only imports so scripts can use it.
 */

/** Legacy billing is active while the core holds a Stripe secret key. */
export function isLegacyBillingActive(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const PROFESSIONAL_FEATURES: readonly GatedFeature[] = [
  "api_keys",
  "procurement",
  "advanced_reports",
  "workflow_automation",
  "custom_fields",
  "tco_dashboard",
];

const LEGACY_PLAN_FEATURES = {
  starter: [],
  professional: PROFESSIONAL_FEATURES,
  enterprise: [...PROFESSIONAL_FEATURES, "scim"],
} as const satisfies Record<string, readonly GatedFeature[]>;

export type LegacyPlan = keyof typeof LEGACY_PLAN_FEATURES;

/** The only features the core enforced per plan before entitlements existed. */
export const ENFORCED_BEFORE_ENTITLEMENTS: readonly GatedFeature[] = [
  "api_keys",
  "procurement",
];

export function isLegacyPlan(plan: string): plan is LegacyPlan {
  return Object.prototype.hasOwnProperty.call(LEGACY_PLAN_FEATURES, plan);
}

/**
 * Legacy limit columns use -1 (plan table, register) and 999999 (Stripe
 * webhook) for "unlimited". Any other negative value blocked everything under
 * the old check (count < max), so it maps to 0.
 */
export function legacyLimit(value: number): number | null {
  if (value === -1 || value >= 999999) return null;
  return value < 0 ? 0 : value;
}

/**
 * Entitlements equivalent to a legacy plan row. An unknown plan maps to
 * starter (no features); callers that can log should log it.
 */
export function legacyPlanToEntitlements(
  plan: string,
  maxAssets: number,
  maxUsers: number,
): Entitlements {
  const features = isLegacyPlan(plan)
    ? LEGACY_PLAN_FEATURES[plan]
    : LEGACY_PLAN_FEATURES.starter;
  return {
    features: featuresInOrder(features),
    maxAssets: legacyLimit(maxAssets),
    maxUsers: legacyLimit(maxUsers),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/legacy-billing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlements-shared.ts src/lib/legacy-billing.ts src/lib/__tests__/entitlements-shared.test.ts src/lib/__tests__/legacy-billing.test.ts
git commit -m "feat: add entitlement types and the legacy plan mapping"
```

---

### Task 3: Dual-write entitlements in the legacy billing writers

**Files:**

- Modify: `src/app/api/billing/webhook/route.ts` (three events)
- Modify: `src/app/api/cron/check-trials/route.ts`
- Modify: `src/app/api/auth/register/route.ts` (trial branch only)
- Test: `src/app/api/__tests__/billing-webhook.test.ts` (update three `toEqual` blocks, add one case)
- Test: `src/app/api/__tests__/check-trials.test.ts` (create)
- Test: `src/app/api/__tests__/auth-register.test.ts` (add three cases)

**Interfaces:**

- Consumes: `legacyPlanToEntitlements`, `isLegacyBillingActive` from `@/lib/legacy-billing` (Task 2).

The webhook needs no `isLegacyBillingActive()` check: it verifies the signature through `getStripe()`, which throws without `STRIPE_SECRET_KEY`, so a reached write implies legacy billing is active.

- [ ] **Step 1: Write the failing tests**

In `billing-webhook.test.ts` add `entitlements` to the three expected `data` objects:

```ts
// checkout.session.completed (plan professional)
expect(args.data).toEqual({
  plan: "professional",
  stripeSubscriptionId: "sub_1",
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
  suspendedAt: null,
});
```

```ts
// customer.subscription.deleted
expect(args?.data).toEqual({
  plan: "starter",
  stripeSubscriptionId: null,
  maxAssets: 100,
  maxUsers: 3,
  entitlements: { features: [], maxAssets: 100, maxUsers: 3 },
  suspendedAt: expect.any(Date),
});
```

```ts
// customer.subscription.updated (price_pro)
expect(args.data).toEqual({
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
  suspendedAt: null,
});
```

and a new case in `describe("checkout.session.completed")`:

```ts
it("records unlimited enterprise entitlements", async () => {
  receiveEvent("checkout.session.completed", {
    subscription: "sub_1",
    metadata: { organizationId: "org-1", plan: "enterprise" },
  });

  await POST(webhookRequest());

  const args = mockPrisma.organization.update.mock.calls[0][0];
  expect(args.data).toMatchObject({
    maxAssets: 999999,
    maxUsers: 999999,
    entitlements: { maxAssets: null, maxUsers: null },
  });
  expect(
    (args.data as { entitlements: { features: string[] } }).entitlements
      .features,
  ).toContain("scim");
});
```

Create `src/app/api/__tests__/check-trials.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({ isValidCronAuth: vi.fn(() => true) }));

import { GET } from "@/app/api/cron/check-trials/route";
import prisma from "@/lib/prisma";

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
  it("records starter entitlements when legacy billing is active", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    await GET();

    expect(mockPrisma.organization.updateMany.mock.calls[0][0]?.data).toEqual({
      plan: "starter",
      trialEndsAt: null,
      maxAssets: 100,
      maxUsers: 3,
      entitlements: { features: [], maxAssets: 100, maxUsers: 3 },
    });
  });

  it("writes no entitlements without legacy billing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    await GET();

    expect(
      mockPrisma.organization.updateMany.mock.calls[0][0]?.data,
    ).not.toHaveProperty("entitlements");
  });
});
```

In `auth-register.test.ts` add (inside `describe("POST /api/auth/register")`, reusing `validBody` and the mocks of "returns 201 on successful registration"):

```ts
describe("trial entitlements (phase 1a dual-write)", () => {
  beforeEach(() => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: "new-org-id",
    } as any);
    mockPrisma.user.create.mockResolvedValue({
      userid: "new-user-id",
    } as any);
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

  it("records the professional trial entitlements when legacy billing is active", async () => {
    vi.stubEnv("SELF_HOSTED", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const data = await register();

    expect(data).toMatchObject({
      plan: "professional",
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
  });

  it("writes no entitlements without legacy billing", async () => {
    vi.stubEnv("SELF_HOSTED", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    expect(await register()).not.toHaveProperty("entitlements");
  });

  it("writes no entitlements when self-hosted", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    expect(await register()).not.toHaveProperty("entitlements");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts`
Expected: FAIL (no `entitlements` written).

- [ ] **Step 3: Add the dual-writes**

In `src/app/api/billing/webhook/route.ts`, import `legacyPlanToEntitlements` from `@/lib/legacy-billing` and add one line per event, directly after the `maxUsers` line:

```ts
            // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
            entitlements: legacyPlanToEntitlements(
              plan,
              PLANS[plan].maxAssets,
              PLANS[plan].maxUsers,
            ),
```

`customer.subscription.updated` uses `legacyPlanToEntitlements(planKey, planCfg.maxAssets, planCfg.maxUsers)`; `customer.subscription.deleted` uses `legacyPlanToEntitlements("starter", PLANS.starter.maxAssets, PLANS.starter.maxUsers)`.

In `src/app/api/cron/check-trials/route.ts`, import `isLegacyBillingActive` and `legacyPlanToEntitlements`, and extend the `updateMany` data:

```ts
      data: {
        plan: "starter",
        trialEndsAt: null,
        maxAssets: PLANS.starter.maxAssets,
        maxUsers: PLANS.starter.maxUsers,
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

In `src/app/api/auth/register/route.ts`, import both helpers and change only the trial branch:

```ts
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
            entitlements: legacyPlanToEntitlements("professional", 5000, 25),
          }
        : {}),
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billing/webhook/route.ts src/app/api/cron/check-trials/route.ts src/app/api/auth/register/route.ts src/app/api/__tests__/billing-webhook.test.ts src/app/api/__tests__/check-trials.test.ts src/app/api/__tests__/auth-register.test.ts
git commit -m "feat: record entitlements alongside the legacy plan columns"
```

---

### Task 4: Guarded entitlements backfill script

The script runs from a laptop or CI shell against the SaaS database only. It does not use the generated Prisma client, whose schema name is baked in at `prisma generate` time (`public` locally, `assettool` in deployed builds), so a client could silently query the wrong schema. It uses raw `pg` with an explicit, validated schema instead.

**Files:**

- Create: `scripts/lib/db-target.ts`
- Create: `scripts/lib/backfill-entitlements.ts` (testable core)
- Create: `scripts/backfill-entitlements.ts` (CLI wrapper)
- Test: `tests/scripts/db-target.test.ts` (create)
- Test: `tests/scripts/backfill-entitlements.test.ts` (create; pure)
- Test: `tests/scripts/backfill-entitlements.db.test.ts` (create; DB-gated)

**Interfaces:**

- Consumes: `legacyPlanToEntitlements`, `isLegacyPlan`, `ENFORCED_BEFORE_ENTITLEMENTS` (Task 2); `GATED_FEATURES`, `isOverLimit`, `type Entitlements`, `type GatedFeature` (Task 2).
- Produces (`scripts/lib/db-target.ts`; phase 1b's cut-over script reuses it):
  - `parseSchemaName(value: string | undefined): string` (throws `Error` unless it matches `/^[a-z_][a-z0-9_]{0,62}$/`)
  - `describeTarget(connectionString: string, schema: string): string` (`host:port/database/schema`, never credentials; port defaults to `5432`)
  - `qualified(schema: string, table: string): string` (`"schema"."table"`)
  - `assertColumns(client: ClientBase, schema: string, table: string, columns: readonly string[]): Promise<void>` (throws naming the missing columns)
- Produces (`scripts/lib/backfill-entitlements.ts`):
  - `interface BackfillRow { id; name; slug; plan; knownPlan: boolean; entitlementsSet: boolean; currentAccess: GatedFeature[]; proposed: Entitlements; losesFeatures: GatedFeature[]; usage: { assets: number; users: number; activeUsers: number }; overLimit: boolean }`
  - `currentAccessFor(plan: string, deploymentSelfHosted: boolean): GatedFeature[]`
  - `planBackfill(client: ClientBase, schema: string, options: { deploymentSelfHosted: boolean }): Promise<BackfillRow[]>`
  - `applyBackfill(client: ClientBase, schema: string, rows: readonly BackfillRow[]): Promise<number>` (rows updated)
  - `countUnset(client: ClientBase, schema: string): Promise<number>`

"Current effective access" reflects real enforcement: through 0.15.0 only `api_keys` and `procurement` were checked per plan, so every organization can use the other five features today. The report shows what each organization loses at the phase 1b switch.

- [ ] **Step 1: Write the failing pure tests**

```ts
// tests/scripts/db-target.test.ts
import { describe, it, expect } from "vitest";
import {
  describeTarget,
  parseSchemaName,
  qualified,
} from "../../scripts/lib/db-target";

describe("parseSchemaName", () => {
  it.each(["public", "assettool", "_x1"])("accepts %s", (name) => {
    expect(parseSchemaName(name)).toBe(name);
  });

  it.each([undefined, "", "Public", 'a"b', "a.b", "1abc", "x".repeat(64)])(
    "rejects %s",
    (name) => {
      expect(() => parseSchemaName(name)).toThrow();
    },
  );
});

describe("describeTarget", () => {
  it("names host, port, database and schema without credentials", () => {
    expect(
      describeTarget(
        "postgresql://admin:s3cret@db.example.com:6543/postgres?sslmode=require",
        "public",
      ),
    ).toBe("db.example.com:6543/postgres/public");
  });

  it("defaults the port to 5432", () => {
    expect(describeTarget("postgres://u:p@localhost/app", "assettool")).toBe(
      "localhost:5432/app/assettool",
    );
  });
});

describe("qualified", () => {
  it("quotes schema and table", () => {
    expect(qualified("public", "organizations")).toBe(
      '"public"."organizations"',
    );
  });
});
```

```ts
// tests/scripts/backfill-entitlements.test.ts
import { describe, it, expect } from "vitest";
import { GATED_FEATURES } from "@/lib/entitlements-shared";
import { currentAccessFor } from "../../scripts/lib/backfill-entitlements";

describe("currentAccessFor", () => {
  it("is every feature on a self-hosted deployment", () => {
    expect(currentAccessFor("starter", true)).toEqual([...GATED_FEATURES]);
  });

  it("gives starter every feature that was never enforced", () => {
    expect(currentAccessFor("starter", false)).toEqual([
      "scim",
      "advanced_reports",
      "tco_dashboard",
      "custom_fields",
      "workflow_automation",
    ]);
  });

  it("gives professional everything", () => {
    expect(currentAccessFor("professional", false)).toEqual([
      ...GATED_FEATURES,
    ]);
  });

  it("treats an unknown plan like starter", () => {
    expect(currentAccessFor("gold", false)).toEqual(
      currentAccessFor("starter", false),
    );
  });
});
```

- [ ] **Step 2: Write the failing DB test**

```ts
// tests/scripts/backfill-entitlements.db.test.ts
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import pg from "pg";
import {
  applyBackfill,
  countUnset,
  planBackfill,
} from "../../scripts/lib/backfill-entitlements";

// Same opt-in as src/lib/__tests__/scope-automation-migration.test.ts: never
// trust the host of DATABASE_URL; CI sets ALLOW_DESTRUCTIVE_DB_TESTS=1 for its
// throwaway Postgres. Everything runs in a transaction that is rolled back.
const databaseUrl = process.env.DATABASE_URL;
const describeDb =
  databaseUrl && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1"
    ? describe
    : describe.skip;
const DB_TEST = { timeout: 30_000 };
const SCHEMA = process.env.DB_SCHEMA || "assettool";
const t = (name: string): string => `"${SCHEMA}"."${name}"`;

async function inRolledBackTransaction(
  fn: (client: pg.Client) => Promise<void>,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

async function insertOrg(
  client: pg.Client,
  fields: {
    plan: string;
    maxAssets: number;
    maxUsers: number;
    entitlements?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO ${t("organizations")}
       ("id", "name", "slug", "plan", "maxAssets", "maxUsers", "entitlements", "updatedAt")
     VALUES ($1::uuid, $2, $2, $3, $4, $5, $6::jsonb, now())`,
    [
      id,
      `org-${id}`,
      fields.plan,
      fields.maxAssets,
      fields.maxUsers,
      fields.entitlements ?? null,
    ],
  );
  return id;
}

async function storedEntitlements(
  client: pg.Client,
  id: string,
): Promise<unknown> {
  const result = await client.query(
    `SELECT "entitlements" FROM ${t("organizations")} WHERE "id" = $1::uuid`,
    [id],
  );
  return result.rows[0].entitlements;
}

describeDb("backfill-entitlements against Postgres", () => {
  it(
    "fills unset rows from the legacy plan and leaves set rows alone",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        const starter = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
        });
        const enterprise = await insertOrg(client, {
          plan: "enterprise",
          maxAssets: 999999,
          maxUsers: -1,
        });
        const unknown = await insertOrg(client, {
          plan: "gold",
          maxAssets: 100,
          maxUsers: 3,
        });
        const jsonNull = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
          entitlements: "null",
        });
        const alreadySet = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
          entitlements: JSON.stringify({
            features: ["scim"],
            maxAssets: 7,
            maxUsers: 7,
          }),
        });

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));

        expect(byId.get(starter)?.entitlementsSet).toBe(false);
        expect(byId.get(jsonNull)?.entitlementsSet).toBe(false);
        expect(byId.get(alreadySet)?.entitlementsSet).toBe(true);
        expect(byId.get(unknown)?.knownPlan).toBe(false);
        expect(byId.get(starter)?.losesFeatures).toEqual([
          "scim",
          "advanced_reports",
          "tco_dashboard",
          "custom_fields",
          "workflow_automation",
        ]);

        const ours = rows.filter((row) =>
          [starter, enterprise, unknown, jsonNull, alreadySet].includes(row.id),
        );
        expect(await applyBackfill(client, SCHEMA, ours)).toBe(4);

        expect(await storedEntitlements(client, enterprise)).toMatchObject({
          maxAssets: null,
          maxUsers: null,
        });
        expect(await storedEntitlements(client, jsonNull)).toEqual({
          features: [],
          maxAssets: 100,
          maxUsers: 3,
        });
        expect(await storedEntitlements(client, alreadySet)).toEqual({
          features: ["scim"],
          maxAssets: 7,
          maxUsers: 7,
        });

        expect(await applyBackfill(client, SCHEMA, ours)).toBe(0);
        expect(await countUnset(client, SCHEMA)).toBe(0);
      });
    },
  );

  it(
    "counts active users and assets and flags orgs over the proposed limits",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        const org = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 1,
        });
        for (const isActive of [true, true, false]) {
          await client.query(
            `INSERT INTO ${t("user")}
               ("userid", "firstname", "lastname", "creation_date", "canrequest", "isadmin", "isActive", "organizationId")
             VALUES ($1::uuid, 'T', 'U', now(), false, false, $2, $3::uuid)`,
            [randomUUID(), isActive, org],
          );
        }

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const row = rows.find((candidate) => candidate.id === org);

        expect(row?.usage).toEqual({ assets: 0, users: 3, activeUsers: 2 });
        expect(row?.overLimit).toBe(true);
      });
    },
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/scripts`
Expected: FAIL (modules do not exist). The DB test is skipped locally; it runs in CI.

- [ ] **Step 4: Write the target guard**

```ts
// scripts/lib/db-target.ts
import type { ClientBase } from "pg";

/**
 * Guards for scripts that write to a database: an explicit schema, a printed
 * target without credentials, and a column fingerprint check. The host of
 * DATABASE_URL is never trusted (see scope-automation-migration.test.ts).
 */

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export function parseSchemaName(value: string | undefined): string {
  if (!value || !SCHEMA_NAME.test(value)) {
    throw new Error(
      "--schema is required: a lowercase Postgres schema name such as public or assettool",
    );
  }
  return value;
}

export function describeTarget(
  connectionString: string,
  schema: string,
): string {
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, "") || "postgres";
  return `${url.hostname}:${url.port || "5432"}/${database}/${schema}`;
}

export function qualified(schema: string, table: string): string {
  return `"${parseSchemaName(schema)}"."${table}"`;
}

export async function assertColumns(
  client: ClientBase,
  schema: string,
  table: string,
  columns: readonly string[],
): Promise<void> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  const present = new Set(result.rows.map((row) => row.column_name));
  const missing = columns.filter((column) => !present.has(column));
  if (missing.length > 0) {
    throw new Error(
      `${schema}.${table} is missing ${missing.join(", ")}. ` +
        "Wrong schema, or the migration has not been applied.",
    );
  }
}
```

- [ ] **Step 5: Write the backfill core**

```ts
// scripts/lib/backfill-entitlements.ts
import type { ClientBase } from "pg";
import {
  GATED_FEATURES,
  isOverLimit,
  type Entitlements,
  type GatedFeature,
} from "@/lib/entitlements-shared";
import {
  ENFORCED_BEFORE_ENTITLEMENTS,
  isLegacyPlan,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";
import { qualified } from "./db-target";

export interface BackfillRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  knownPlan: boolean;
  /** True when a non-null JSON value is stored; such rows are never touched. */
  entitlementsSet: boolean;
  /** What the organization can use today, given real enforcement. */
  currentAccess: GatedFeature[];
  proposed: Entitlements;
  losesFeatures: GatedFeature[];
  usage: { assets: number; users: number; activeUsers: number };
  /** Usage above the proposed limits (active users only, as in phase 1b). */
  overLimit: boolean;
}

/**
 * Features an organization can use today. Self-hosted deployments allow
 * everything; otherwise only api_keys and procurement were checked per plan.
 */
export function currentAccessFor(
  plan: string,
  deploymentSelfHosted: boolean,
): GatedFeature[] {
  if (deploymentSelfHosted) return [...GATED_FEATURES];
  const planFeatures = new Set(legacyPlanToEntitlements(plan, 0, 0).features);
  return GATED_FEATURES.filter(
    (feature) =>
      !ENFORCED_BEFORE_ENTITLEMENTS.includes(feature) ||
      planFeatures.has(feature),
  );
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  maxAssets: number;
  maxUsers: number;
  entitlementsSet: boolean;
  assets: number;
  users: number;
  activeUsers: number;
}

export async function planBackfill(
  client: ClientBase,
  schema: string,
  options: { deploymentSelfHosted: boolean },
): Promise<BackfillRow[]> {
  const result = await client.query<OrgRow>(
    `SELECT o."id", o."name", o."slug", o."plan", o."maxAssets", o."maxUsers",
            (o."entitlements" IS NOT NULL AND o."entitlements" <> 'null'::jsonb) AS "entitlementsSet",
            (SELECT count(*) FROM ${qualified(schema, "asset")} a
              WHERE a."organizationId" = o."id")::int AS "assets",
            (SELECT count(*) FROM ${qualified(schema, "user")} u
              WHERE u."organizationId" = o."id")::int AS "users",
            (SELECT count(*) FROM ${qualified(schema, "user")} u
              WHERE u."organizationId" = o."id" AND u."isActive")::int AS "activeUsers"
       FROM ${qualified(schema, "organizations")} o
      ORDER BY o."createdAt", o."id"`,
  );
  return result.rows.map((row) => {
    const proposed = legacyPlanToEntitlements(
      row.plan,
      row.maxAssets,
      row.maxUsers,
    );
    const currentAccess = currentAccessFor(
      row.plan,
      options.deploymentSelfHosted,
    );
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      knownPlan: isLegacyPlan(row.plan),
      entitlementsSet: row.entitlementsSet,
      currentAccess,
      proposed,
      losesFeatures: currentAccess.filter(
        (feature) => !proposed.features.includes(feature),
      ),
      usage: {
        assets: row.assets,
        users: row.users,
        activeUsers: row.activeUsers,
      },
      overLimit: isOverLimit(proposed, {
        assets: row.assets,
        users: row.activeUsers,
      }),
    };
  });
}

/** Writes proposed entitlements to rows that have none. Idempotent. */
export async function applyBackfill(
  client: ClientBase,
  schema: string,
  rows: readonly BackfillRow[],
): Promise<number> {
  let updated = 0;
  for (const row of rows) {
    if (row.entitlementsSet) continue;
    const result = await client.query(
      `UPDATE ${qualified(schema, "organizations")}
          SET "entitlements" = $1::jsonb
        WHERE "id" = $2::uuid
          AND ("entitlements" IS NULL OR "entitlements" = 'null'::jsonb)`,
      [JSON.stringify(row.proposed), row.id],
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

export async function countUnset(
  client: ClientBase,
  schema: string,
): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS "count" FROM ${qualified(schema, "organizations")}
      WHERE "entitlements" IS NULL OR "entitlements" = 'null'::jsonb`,
  );
  return result.rows[0].count;
}
```

- [ ] **Step 6: Write the CLI wrapper**

```ts
// scripts/backfill-entitlements.ts
/**
 * Backfill organizations.entitlements from the legacy plan columns
 * (SaaS boundary phase 1a). Run only against the SaaS database.
 *
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false \
 *     --apply --confirm "host:5432/postgres/public"
 *
 * --deployment-self-hosted is the SELF_HOSTED value of the deployment that uses
 * this database (not of your shell); it decides the "currentAccess" column.
 * Bun loads .env automatically: check the printed target before applying.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import {
  assertColumns,
  describeTarget,
  parseSchemaName,
} from "./lib/db-target";
import {
  applyBackfill,
  countUnset,
  planBackfill,
} from "./lib/backfill-entitlements";

const REQUIRED_COLUMNS = [
  "id",
  "slug",
  "plan",
  "maxAssets",
  "maxUsers",
  "entitlements",
] as const;

function parseBoolean(name: string, value: string | undefined): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      schema: { type: "string" },
      "deployment-self-hosted": { type: "string" },
      apply: { type: "boolean", default: false },
      confirm: { type: "string" },
    },
    strict: true,
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const schema = parseSchemaName(values.schema);
  const deploymentSelfHosted = parseBoolean(
    "deployment-self-hosted",
    values["deployment-self-hosted"],
  );
  const target = describeTarget(connectionString, schema);
  console.log(`Target: ${target}`);
  if (values.apply && values.confirm !== target) {
    throw new Error(`--apply requires --confirm "${target}"`);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(values.apply ? "BEGIN" : "BEGIN READ ONLY");
    await assertColumns(client, schema, "organizations", REQUIRED_COLUMNS);
    const rows = await planBackfill(client, schema, { deploymentSelfHosted });
    for (const row of rows) console.log(JSON.stringify(row));
    console.log(
      JSON.stringify({
        organizations: rows.length,
        unset: rows.filter((row) => !row.entitlementsSet).length,
        losingFeatures: rows.filter((row) => row.losesFeatures.length > 0)
          .length,
        overLimit: rows.filter((row) => row.overLimit).length,
        unknownPlans: rows
          .filter((row) => !row.knownPlan)
          .map((row) => row.slug),
      }),
    );
    if (!values.apply) {
      await client.query("ROLLBACK");
      console.log("Dry run: nothing written.");
      return;
    }
    const updated = await applyBackfill(client, schema, rows);
    const remaining = await countUnset(client, schema);
    await client.query("COMMIT");
    console.log(
      `Updated ${updated} organizations; ${remaining} without entitlements.`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 7: Run the tests and the type check**

Run: `npx vitest run tests/scripts` (the DB test is skipped locally), then `npx tsc --noEmit -p .`
Expected: PASS. Do not run the script itself.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/db-target.ts scripts/lib/backfill-entitlements.ts scripts/backfill-entitlements.ts tests/scripts
git commit -m "feat: add a guarded entitlements backfill script"
```

---

### Task 5: Release 0.15.0

**Files:**

- Modify: `CHANGELOG.md` (new `## [0.15.0] - <release date>` above `## [0.14.0]`; keep the empty `## [Unreleased]`)
- Modify: `TECHNICAL_DEBT.md` (header "Last updated" line; item 8a cross-reference)
- Modify: `package.json` (`"version": "0.15.0"`)

- [ ] **Step 1: Write the CHANGELOG entry**

```markdown
## [0.15.0] - 2026-10-12

Phase 1a of the SaaS boundary (`docs/superpowers/specs/2026-10-05-saas-boundary-design.md`):
the database gains the columns the control plane will drive, and the legacy billing code
starts recording entitlements. Nothing reads them yet, so behaviour is unchanged.

### Added

- `organizations.entitlements` (JSONB) and `organizations.lockedAt` (timestamp), both
  nullable, migration `20261012_org_entitlements_locked_at`.
- The Stripe webhook, the trial cron and the register trial record `entitlements`
  alongside `plan`, `maxAssets` and `maxUsers` while Stripe is configured.
- `scripts/backfill-entitlements.ts` maps every organization's legacy plan to
  entitlements (dry run by default).

### Security

- The organization routes (`GET`/`POST /api/organizations`, `GET`/`PUT
/api/organizations/[id]`) return an allow-list of fields. They no longer send `plan`,
  the Stripe customer and subscription ids, `trialEndsAt`, `maxAssets`, `maxUsers` or
  `suspendedAt` to org admins, and never the new columns.

**Upgrade notes**

Before deploying:

- The migration only adds two nullable columns. Preview deployments that share the
  production database fail on organization reads from the moment they run 0.15.0 until
  production has applied the migration; deploy production promptly or keep Preview off
  the production database.

After deploying (SaaS database only, never a self-hosted one):

- Dry run, with the deployment's real `SELF_HOSTED` value:
  `bun scripts/backfill-entitlements.ts --schema <schema> --deployment-self-hosted <true|false>`
  It prints one JSON line per organization (`currentAccess`, `proposed`, `losesFeatures`,
  usage, `overLimit`) and a summary. `losesFeatures` lists what the organization loses
  when phase 1b switches enforcement on; through 0.15.0 only API keys and procurement
  were enforced per plan.
- Decide per organization, then apply with the printed target:
  `bun scripts/backfill-entitlements.ts --schema <schema> --deployment-self-hosted <...> --apply --confirm "<target>"`
  Rows that already hold entitlements are never changed; re-running is safe.
- Gate to phase 1b: re-run the dry run right before deploying 1b; its summary must show
  `"unset":0`.
```

- [ ] **Step 2: Update the debt register and the version**

In `TECHNICAL_DEBT.md`, set the header to `Last updated: 2026-10-12 (v0.15.0, SaaS boundary phase 1a)` and add to item 8a: "The phase 1a migration (`20261012_org_entitlements_locked_at`) is additive; a Preview deployment on the production database breaks on organization reads until production migrates (item 7)." Set `"version": "0.15.0"` in `package.json`.

- [ ] **Step 3: Verify the whole suite**

Run: `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint src/`
Expected: all pass (DB tests skipped locally).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md TECHNICAL_DEBT.md package.json
git commit -m "docs: release notes for 0.15.0"
```
