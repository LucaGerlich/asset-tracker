### Task 13: Organization creation through one helper

Today three code paths insert an organization row (`auth/register`, `setup`, `organizations` POST) and none of them knows about entitlements or the control plane. This task funnels them through `createOrganization`, so a new organization gets the right stored entitlements, and makes each creating route announce the organization with `notifyOrgCreated` once its transaction has resolved. Registration also becomes transactional: today a failure after the organization insert leaves an orphan organization behind.

Two commits: the helper and the transaction-aware seeding first (Steps 1-5), then the routes (Steps 6-13).

**Files:**

- Modify: `src/lib/organizations.ts` (from 1a: adds `createOrganization`)
- Modify: `src/lib/org-defaults.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/setup/route.ts`
- Modify: `src/app/api/organizations/route.ts`
- Modify: `prisma/demo-seed.js` (comment only)
- Test: `src/lib/__tests__/organizations.test.ts` (extend the 1a file)
- Test: `src/lib/__tests__/org-defaults.test.ts` (create)
- Test: `src/lib/__tests__/organization-creation-paths.test.ts` (create; static scan)
- Test: `src/app/api/__tests__/auth-register.test.ts`
- Test: `src/app/api/__tests__/setup.test.ts`
- Test: `src/app/api/__tests__/organizations-list-create.test.ts` (extend the 1a file)
- Check, no edit expected: `src/app/api/__tests__/email-ownership-routes.test.ts` (its register part mocks `@/lib/org-defaults` with a factory and uses the prisma automock, whose `$transaction` hands the callback the same mock, so the transactional route passes unchanged)

**Interfaces:**

- Consumes: `notifyOrgCreated` (Task 12); `parseNewOrgEntitlements` (`src/lib/control-plane/config.ts`, Task 4); `isCloudMode` (Task 2); `legacyPlanToEntitlements`, `isLegacyBillingActive` (`src/lib/legacy-billing.ts`, 1a); `organizationApiSelect` (`src/lib/organizations.ts`, 1a); `stubCloudMode`, `TEST_NEW_ORG_ENTITLEMENTS` (`tests/setup/cloud-mode.ts`, Task 2).
- Produces in `src/lib/organizations.ts`:
  - `interface CreateOrganizationInput { name: string; slug: string; description?: string | null; settings?: Prisma.InputJsonValue; entitlements?: Entitlements; legacy?: LegacyOrganizationColumns }` where `LegacyOrganizationColumns` is the exported alias `{ plan: string; trialEndsAt: Date | null; maxAssets: number; maxUsers: number }`
  - `createOrganization(tx: Prisma.TransactionClient, input: CreateOrganizationInput): Promise<OrganizationApiRow>` where `OrganizationApiRow` is the exported alias `Prisma.OrganizationGetPayload<{ select: typeof organizationApiSelect }>`. Stored entitlements: the explicit argument; otherwise, in cloud mode, `NEW_ORG_ENTITLEMENTS` (parsed on every call, throws when missing or invalid); otherwise the field is omitted (SQL NULL). A JSON null is never written.
- Modifies `seedOrgDefaults(organizationId: string, db: Prisma.TransactionClient = prisma): Promise<void>`.
- Behaviour notes the tests pin: sign-up in cloud mode with legacy billing keeps the 14 day Professional trial (legacy columns plus explicit trial entitlements); cloud without legacy billing writes no plan columns and lets the helper store `NEW_ORG_ENTITLEMENTS`; outside cloud mode it writes `plan: "starter"` with unlimited legacy limits and no entitlements. `POST /api/organizations` never takes entitlements from the request body. Without `settings` in the body it now stores SQL NULL instead of the JSON null it wrote before (every reader treats both as `null`).

- [ ] **Step 1: Write the failing tests for the helper and the seeding**

In `src/lib/__tests__/organizations.test.ts` (created by 1a), replace the two import lines at the top (`import { describe, it, expect } from "vitest";` and `import { organizationApiSelect } from "@/lib/organizations";`) with:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { createOrganization, organizationApiSelect } from "@/lib/organizations";
import type { Entitlements } from "@/lib/entitlements-shared";
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});
```

Keep the existing `describe("organizationApiSelect", ...)` block and append:

```ts
describe("createOrganization", () => {
  const created = {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    createdAt: new Date("2026-10-12T08:00:00.000Z"),
  };

  function fakeTx() {
    const create = vi.fn().mockResolvedValue(created);
    const tx = {
      organization: { create },
    } as unknown as Prisma.TransactionClient;
    return { tx, create };
  }

  /** The `data` the row was created with. */
  function dataOf(create: ReturnType<typeof vi.fn>): Record<string, unknown> {
    return create.mock.calls[0][0].data;
  }

  const explicit: Entitlements = {
    features: ["scim"],
    maxAssets: 7,
    maxUsers: null,
  };

  it("creates the row inside the given transaction and returns the allow-listed columns", async () => {
    const { tx, create } = fakeTx();

    const result = await createOrganization(tx, { name: "Acme", slug: "acme" });

    expect(result).toBe(created);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].select).toBe(organizationApiSelect);
    expect(dataOf(create)).toMatchObject({ name: "Acme", slug: "acme" });
  });

  it("stores no entitlements outside cloud mode (SQL NULL, never a JSON null)", async () => {
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    expect(dataOf(create)).not.toHaveProperty("entitlements");
  });

  it("ignores a stale NEW_ORG_ENTITLEMENTS outside cloud mode", async () => {
    vi.stubEnv(
      "NEW_ORG_ENTITLEMENTS",
      JSON.stringify(TEST_NEW_ORG_ENTITLEMENTS),
    );
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    expect(dataOf(create)).not.toHaveProperty("entitlements");
  });

  it("stores NEW_ORG_ENTITLEMENTS in cloud mode", async () => {
    stubCloudMode();
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    expect(dataOf(create).entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("reads NEW_ORG_ENTITLEMENTS again for every organization", async () => {
    stubCloudMode();
    const first = fakeTx();
    await createOrganization(first.tx, { name: "A", slug: "a" });
    vi.stubEnv(
      "NEW_ORG_ENTITLEMENTS",
      JSON.stringify({ features: ["api_keys"], maxAssets: 5, maxUsers: 1 }),
    );
    const second = fakeTx();
    await createOrganization(second.tx, { name: "B", slug: "b" });

    expect(dataOf(first.create).entitlements).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
    expect(dataOf(second.create).entitlements).toEqual({
      features: ["api_keys"],
      maxAssets: 5,
      maxUsers: 1,
    });
  });

  it("prefers explicit entitlements in cloud mode", async () => {
    stubCloudMode();
    const { tx, create } = fakeTx();

    await createOrganization(tx, {
      name: "Acme",
      slug: "acme",
      entitlements: explicit,
    });

    expect(dataOf(create).entitlements).toEqual(explicit);
  });

  it("stores explicit entitlements outside cloud mode too", async () => {
    const { tx, create } = fakeTx();

    await createOrganization(tx, {
      name: "Acme",
      slug: "acme",
      entitlements: explicit,
    });

    expect(dataOf(create).entitlements).toEqual(explicit);
  });

  it.each([
    ["missing", ""],
    ["not JSON", "{not json"],
    [
      "invalid",
      JSON.stringify({ features: ["white_label"], maxAssets: 1, maxUsers: 1 }),
    ],
  ])(
    "refuses to create an organization when NEW_ORG_ENTITLEMENTS is %s in cloud mode",
    async (_label, value) => {
      stubCloudMode();
      vi.stubEnv("NEW_ORG_ENTITLEMENTS", value);
      const { tx, create } = fakeTx();

      await expect(
        createOrganization(tx, { name: "Acme", slug: "acme" }),
      ).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("writes the legacy billing columns when given", async () => {
    const { tx, create } = fakeTx();
    const trialEndsAt = new Date("2026-10-26T08:00:00.000Z");

    await createOrganization(tx, {
      name: "Acme",
      slug: "acme",
      legacy: {
        plan: "professional",
        trialEndsAt,
        maxAssets: 5000,
        maxUsers: 25,
      },
    });

    expect(dataOf(create)).toMatchObject({
      plan: "professional",
      trialEndsAt,
      maxAssets: 5000,
      maxUsers: 25,
    });
  });

  it("leaves the legacy billing columns to the column defaults when not given", async () => {
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    const data = dataOf(create);
    for (const column of ["plan", "trialEndsAt", "maxAssets", "maxUsers"]) {
      expect(data).not.toHaveProperty(column);
    }
  });

  it("passes the description and the settings through", async () => {
    const { tx, create } = fakeTx();

    await createOrganization(tx, {
      name: "Acme",
      slug: "acme",
      description: "Main site",
      settings: { theme: "dark" },
    });

    expect(dataOf(create)).toMatchObject({
      description: "Main site",
      settings: { theme: "dark" },
    });
  });

  it("omits the settings when none are given", async () => {
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    expect(dataOf(create)).not.toHaveProperty("settings");
  });

  it("never writes billing state the caller did not ask for", async () => {
    stubCloudMode();
    const { tx, create } = fakeTx();

    await createOrganization(tx, { name: "Acme", slug: "acme" });

    const data = dataOf(create);
    expect(data).not.toHaveProperty("lockedAt");
    expect(data).not.toHaveProperty("suspendedAt");
    expect(data).not.toHaveProperty("stripeCustomerId");
  });
});
```

Create the seeding test:

```ts
// src/lib/__tests__/org-defaults.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { seedOrgDefaults } from "@/lib/org-defaults";

const mockPrisma = vi.mocked(prisma, true);

const SEEDED_MODELS = [
  "statusType",
  "assetCategoryType",
  "accessorieCategoryType",
  "consumableCategoryType",
  "licenceCategoryType",
] as const;

function fakeTx() {
  const model = () => ({ createMany: vi.fn().mockResolvedValue({ count: 0 }) });
  return {
    statusType: model(),
    assetCategoryType: model(),
    accessorieCategoryType: model(),
    consumableCategoryType: model(),
    licenceCategoryType: model(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("seedOrgDefaults", () => {
  it("writes every default through the transaction client it is given", async () => {
    const tx = fakeTx();

    await seedOrgDefaults("org-1", tx as unknown as Prisma.TransactionClient);

    for (const model of SEEDED_MODELS) {
      expect(tx[model].createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma[model].createMany).not.toHaveBeenCalled();
    }
  });

  it("scopes every seeded row to the organization", async () => {
    const tx = fakeTx();

    await seedOrgDefaults("org-1", tx as unknown as Prisma.TransactionClient);

    for (const model of SEEDED_MODELS) {
      const { data } = tx[model].createMany.mock.calls[0][0] as {
        data: Array<{ organizationId: string }>;
      };
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((row) => row.organizationId === "org-1")).toBe(true);
    }
  });

  it("uses the global client when no transaction client is given", async () => {
    await seedOrgDefaults("org-2");

    for (const model of SEEDED_MODELS) {
      expect(mockPrisma[model].createMany).toHaveBeenCalledTimes(1);
    }
  });

  it("marks exactly one status type as the default", async () => {
    const tx = fakeTx();

    await seedOrgDefaults("org-1", tx as unknown as Prisma.TransactionClient);

    const { data } = tx.statusType.createMany.mock.calls[0][0] as {
      data: Array<{ isDefault: boolean }>;
    };
    expect(data.filter((row) => row.isDefault)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts`
Expected: FAIL (`createOrganization is not a function`; the first seeding test fails because the defaults are written through the global client, not the one passed in).

- [ ] **Step 3: Write the helper and let the seeding take a client**

Replace `src/lib/organizations.ts` with the following. `organizationApiSelect` is unchanged from 1a; everything below it is new.

```ts
// src/lib/organizations.ts
import type { Prisma } from "@prisma/client";
import { parseNewOrgEntitlements } from "@/lib/control-plane/config";
import { isCloudMode } from "@/lib/deployment-mode";
import type { Entitlements } from "@/lib/entitlements-shared";

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

export type OrganizationApiRow = Prisma.OrganizationGetPayload<{
  select: typeof organizationApiSelect;
}>;

/** Legacy billing columns, written while legacy billing exists (until phase 3a). */
export interface LegacyOrganizationColumns {
  plan: string;
  trialEndsAt: Date | null;
  maxAssets: number;
  maxUsers: number;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string | null;
  settings?: Prisma.InputJsonValue;
  /** Stored as given. Without it, cloud mode stores NEW_ORG_ENTITLEMENTS. */
  entitlements?: Entitlements;
  legacy?: LegacyOrganizationColumns;
}

/**
 * The one place that inserts an organization row. It only writes the row: the
 * caller creates the admin and the defaults in the same transaction and calls
 * `notifyOrgCreated` once the transaction has resolved.
 *
 * Stored entitlements, in order: the explicit argument; in cloud mode
 * NEW_ORG_ENTITLEMENTS (throws when it is missing or invalid, which startup
 * validation rules out); otherwise nothing, which is SQL NULL. A JSON null is
 * never written, so a NULL always means "not set".
 */
export async function createOrganization(
  tx: Prisma.TransactionClient,
  input: CreateOrganizationInput,
): Promise<OrganizationApiRow> {
  const entitlements =
    input.entitlements ??
    (isCloudMode() ? parseNewOrgEntitlements() : undefined);

  return tx.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      ...(input.settings === undefined ? {} : { settings: input.settings }),
      ...input.legacy,
      ...(entitlements === undefined ? {} : { entitlements }),
    },
    select: organizationApiSelect,
  });
}
```

In `src/lib/org-defaults.ts`, replace the first line

```ts
import prisma from "@/lib/prisma";
```

with

```ts
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
```

and replace the doc comment and function at the end of the file (from `/** Seed default status types, categories ...` to the closing brace; the default lists above it stay as they are) with:

```ts
/**
 * Seed default status types, categories for a newly created organization.
 * Called during registration to give new orgs a usable starting set.
 *
 * Pass the transaction client when the organization was created inside
 * `prisma.$transaction`: the rows then commit or roll back together with it,
 * and no second pool connection is needed while the transaction is open.
 */
export async function seedOrgDefaults(
  organizationId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.statusType.createMany({
    data: DEFAULT_STATUS_TYPES.map((st) => ({
      statustypename: st.name,
      color: st.color,
      isDefault: st.isDefault,
      organizationId,
    })),
  });

  await db.assetCategoryType.createMany({
    data: DEFAULT_ASSET_CATEGORIES.map((name) => ({
      assetcategorytypename: name,
      organizationId,
    })),
  });

  await db.accessorieCategoryType.createMany({
    data: DEFAULT_ACCESSORY_CATEGORIES.map((name) => ({
      accessoriecategorytypename: name,
      organizationId,
    })),
  });

  await db.consumableCategoryType.createMany({
    data: DEFAULT_CONSUMABLE_CATEGORIES.map((name) => ({
      consumablecategorytypename: name,
      organizationId,
    })),
  });

  await db.licenceCategoryType.createMany({
    data: DEFAULT_LICENCE_CATEGORIES.map((name) => ({
      licencecategorytypename: name,
      organizationId,
    })),
  });
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `tsc` rejects `entitlements` in the `create` data, the Prisma client was generated before 1a added the column: run `npx prisma generate` (never `db push` or `migrate`).

Run: `npx eslint src/lib/organizations.ts src/lib/org-defaults.ts src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/organizations.ts src/lib/org-defaults.ts src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts
git commit -m "feat: add createOrganization and let seedOrgDefaults join a transaction"
```

- [ ] **Step 6: Write the failing route tests and the creation-path scan**

The scan fails when a new code path inserts an organization row without the helper, and when a route that creates organizations forgets `notifyOrgCreated` or the `maxDuration` that the `after()` delivery needs (3 attempts of 5 s plus the pauses is 16.5 s):

```ts
// src/lib/__tests__/organization-creation-paths.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Every organization is created through createOrganization (src/lib/organizations.ts):
 * it stores the right entitlements, and the route that called it announces the
 * organization to the control plane (org.created) once its transaction has
 * committed. This scan fails when a new code path inserts an organization row
 * directly, or when a route that creates organizations forgets the
 * announcement or the duration budget that its delivery needs.
 */

const SRC_DIR = path.resolve(__dirname, "../..");
const HELPER = path.join(SRC_DIR, "lib", "organizations.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "__tests__" || entry === "__mocks__") return [];
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const files = sourceFiles(SRC_DIR).map((full) => ({
  full,
  rel: path.relative(SRC_DIR, full),
  source: readFileSync(full, "utf8"),
}));

const DIRECT_INSERT = /\.organization\.create(?:Many)?\s*\(/;
const HELPER_CALL = /\bcreateOrganization\s*\(/;

describe("organization creation paths", () => {
  it("inserts organization rows only inside createOrganization", () => {
    const offenders = files
      .filter((file) => file.full !== HELPER && DIRECT_INSERT.test(file.source))
      .map((file) => file.rel);

    expect(offenders).toEqual([]);
  });

  it("still finds the insert inside the helper, so the scan above is not vacuous", () => {
    const helper = files.find((file) => file.full === HELPER);

    expect(helper?.source).toMatch(DIRECT_INSERT);
  });

  it("finds the known creators", () => {
    const creators = files
      .filter((file) => file.full !== HELPER && HELPER_CALL.test(file.source))
      .map((file) => file.rel.split(path.sep).join("/"));

    expect(creators).toEqual(
      expect.arrayContaining([
        "app/api/auth/register/route.ts",
        "app/api/organizations/route.ts",
        "app/api/setup/route.ts",
      ]),
    );
  });

  it("announces every organization a route creates, within a duration budget", () => {
    const creators = files.filter(
      (file) => file.full !== HELPER && HELPER_CALL.test(file.source),
    );

    for (const file of creators) {
      expect(file.source, `${file.rel} must call notifyOrgCreated(`).toMatch(
        /\bnotifyOrgCreated\s*\(/,
      );
      expect(
        file.source,
        `${file.rel} must export maxDuration (after() delivery takes up to 16.5 s)`,
      ).toMatch(/export const maxDuration\s*=\s*\d+/);
    }
  });
});
```

In `src/app/api/__tests__/auth-register.test.ts`:

1. Task 2 added `import { stubCloudMode } from "../../../../tests/setup/cloud-mode";` below the `rate-limit` import. Replace that line with:

```ts
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../../tests/setup/cloud-mode";
```

2. Directly after the existing `vi.mock("@/lib/logger");` line add:

```ts
vi.mock("@/lib/org-defaults", () => ({
  seedOrgDefaults: vi.fn().mockResolvedValue(undefined),
}));

// notifyOrgCreated is a spy around the real function, so a test can both
// assert on the call and let the real delivery run.
vi.mock("@/lib/control-plane/events", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/control-plane/events")>();
  return { ...actual, notifyOrgCreated: vi.fn(actual.notifyOrgCreated) };
});

// `after()` only works inside a request scope: record what the route schedules.
const afterMock = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    afterMock.scheduled.push(task);
  },
}));
```

3. Directly after the existing `import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";` line add:

```ts
import { seedOrgDefaults } from "@/lib/org-defaults";
import { notifyOrgCreated } from "@/lib/control-plane/events";
```

4. Delete the `describe("trial rule per deployment mode", ...)` block that Task 2 put inside `describe("POST /api/auth/register")` (it replaced the `trial entitlements (phase 1a dual-write)` block of 1a). Its cases assert the exact `data` that `prisma.organization.create` received, for example `{ name, slug }` in cloud mode without legacy billing and `{ name, slug, maxAssets: -1, maxUsers: -1 }` when self-hosted. Those shapes change in this task (cloud mode without legacy billing now carries `entitlements`, the self-hosted case now also carries `plan` and `trialEndsAt`). The same rules, and the deprecated-`SELF_HOSTED` case, are covered by the new `describe("organization creation")` below.

5. Append at the end of the file:

```ts
describe("organization creation", () => {
  const validBody = {
    firstname: "Test",
    lastname: "User",
    email: "test@example.com",
    organization: "Test Corp",
    username: "testuser",
    password: "SecurePass123!",
  };
  const createdOrg = {
    id: "new-org-id",
    name: "Test Corp",
    slug: "test-corp-abc123",
    createdAt: new Date("2026-10-12T08:00:00.000Z"),
  };

  function fakeTx() {
    return {
      organization: { create: vi.fn().mockResolvedValue(createdOrg) },
      user: { create: vi.fn().mockResolvedValue({ userid: "new-user-id" }) },
      accounts: { create: vi.fn().mockResolvedValue({}) },
    };
  }

  function runInTransaction(tx: ReturnType<typeof fakeTx>) {
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => callback(tx)) as never);
  }

  function register() {
    return POST(
      createMockRequest("/api/auth/register", {
        method: "POST",
        body: validBody,
      }),
    );
  }

  /** The `data` the organization row was created with. */
  async function registeredOrgData(): Promise<Record<string, unknown>> {
    await register();
    return mockPrisma.organization.create.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
  }

  beforeEach(() => {
    afterMock.scheduled.length = 0;
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue(createdOrg as never);
    mockPrisma.user.create.mockResolvedValue({
      userid: "new-user-id",
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("writes organization, admin, account and defaults in one transaction", async () => {
    const tx = fakeTx();
    runInTransaction(tx);

    const res = await register();

    expect(res.status).toBe(201);
    expect(tx.organization.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "new-org-id",
          isadmin: true,
          username: "testuser",
        }),
      }),
    );
    expect(tx.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "new-user-id",
          providerId: "credential",
        }),
      }),
    );
    expect(seedOrgDefaults).toHaveBeenCalledWith("new-org-id", tx);
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.accounts.create).not.toHaveBeenCalled();
  });

  it("answers 500 and announces nothing when a write inside the transaction fails", async () => {
    const tx = fakeTx();
    tx.accounts.create.mockRejectedValue(new Error("connection lost"));
    runInTransaction(tx);

    const res = await register();

    expect(res.status).toBe(500);
    expect(seedOrgDefaults).not.toHaveBeenCalled();
    expect(notifyOrgCreated).not.toHaveBeenCalled();
  });

  it("announces the organization once, after the transaction has resolved", async () => {
    const order: string[] = [];
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => {
      order.push("transaction started");
      const result = await callback(mockPrisma);
      order.push("transaction resolved");
      return result;
    }) as never);
    vi.mocked(notifyOrgCreated).mockImplementationOnce(() => {
      order.push("announced");
    });

    const res = await register();

    expect(res.status).toBe(201);
    expect(order).toEqual([
      "transaction started",
      "transaction resolved",
      "announced",
    ]);
    expect(notifyOrgCreated).toHaveBeenCalledTimes(1);
    expect(notifyOrgCreated).toHaveBeenCalledWith(createdOrg);
  });

  it("does not announce a duplicate username", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "existing",
      username: "testuser",
    } as never);

    const res = await register();

    expect(res.status).toBe(409);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(notifyOrgCreated).not.toHaveBeenCalled();
  });

  it("creates an unlimited organization without entitlements when self-hosted", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const data = await registeredOrgData();

    expect(data).toMatchObject({
      plan: "starter",
      trialEndsAt: null,
      maxAssets: -1,
      maxUsers: -1,
    });
    expect(data).not.toHaveProperty("entitlements");
  });

  it("starts the 14 day Professional trial in cloud mode with legacy billing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T08:00:00.000Z"));
    stubCloudMode();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const data = await registeredOrgData();

    expect(data).toMatchObject({
      plan: "professional",
      trialEndsAt: new Date("2026-10-26T08:00:00.000Z"),
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
  });

  it("ignores the deprecated SELF_HOSTED variable", async () => {
    stubCloudMode();
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    expect(await registeredOrgData()).toMatchObject({ plan: "professional" });
  });

  it("stores NEW_ORG_ENTITLEMENTS and no trial in cloud mode without legacy billing", async () => {
    stubCloudMode();
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const data = await registeredOrgData();

    expect(data.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
    expect(data).not.toHaveProperty("plan");
    expect(data).not.toHaveProperty("trialEndsAt");
    expect(data).not.toHaveProperty("maxAssets");
    expect(data).not.toHaveProperty("maxUsers");
  });

  it("still answers 201 while the control plane is down, and delivers in the background", async () => {
    vi.useFakeTimers();
    stubCloudMode();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv(
      "CONTROL_PLANE_WEBHOOK_URL",
      "https://control.example.com/hooks",
    );
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchImpl);

    const res = await register();

    // The response is out before anything is sent.
    expect(res.status).toBe(201);
    expect(afterMock.scheduled).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();

    const delivery = Promise.all(afterMock.scheduled.map((task) => task()));
    await vi.advanceTimersByTimeAsync(2_000);
    await delivery;

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("sends no event while the control plane URL is unset", async () => {
    stubCloudMode();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("CONTROL_PLANE_WEBHOOK_URL", "");

    const res = await register();

    expect(res.status).toBe(201);
    expect(afterMock.scheduled).toHaveLength(0);
  });
});
```

In `src/app/api/__tests__/setup.test.ts`:

1. Change the first line to `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";` and add below the `test-helpers` import:

```ts
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../../tests/setup/cloud-mode";
```

2. Directly after the existing `vi.mock("@/lib/logger");` line add:

```ts
vi.mock("@/lib/control-plane/events", () => ({
  notifyOrgCreated: vi.fn(),
}));
```

3. Directly after the existing `import prisma from "@/lib/prisma";` line add:

```ts
import { notifyOrgCreated } from "@/lib/control-plane/events";
```

4. Append at the end of the file:

```ts
describe("POST /api/setup: organization creation", () => {
  const validBody = {
    firstname: "Admin",
    lastname: "User",
    email: "admin@example.com",
    organization: "My Company",
    username: "admin",
    password: "SecurePass123!@",
  };
  const createdOrg = {
    id: "org-id",
    name: "My Company",
    slug: "my-company-abc123",
    createdAt: new Date("2026-10-12T08:00:00.000Z"),
  };

  function setup() {
    return POST(
      createMockRequest("/api/setup", { method: "POST", body: validBody }),
    );
  }

  /** The `data` the organization row was created with. */
  async function setupOrgData(): Promise<Record<string, unknown>> {
    await setup();
    return mockPrisma.organization.create.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
  }

  beforeEach(() => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.organization.create.mockResolvedValue(createdOrg as never);
    mockPrisma.user.create.mockResolvedValue({
      userid: "user-id",
      username: "admin",
    } as never);
    mockPrisma.accounts.create.mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the organization through the transaction client", async () => {
    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ userid: "user-id" }),
      },
      organization: { create: vi.fn().mockResolvedValue(createdOrg) },
      accounts: { create: vi.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => callback(tx)) as never);

    const res = await setup();

    expect(res.status).toBe(201);
    expect(tx.organization.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-id" }),
      }),
    );
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
  });

  it("stores no entitlements outside cloud mode", async () => {
    expect(await setupOrgData()).not.toHaveProperty("entitlements");
  });

  it("stores NEW_ORG_ENTITLEMENTS in cloud mode", async () => {
    stubCloudMode();

    expect((await setupOrgData()).entitlements).toEqual(
      TEST_NEW_ORG_ENTITLEMENTS,
    );
  });

  it("announces the organization once, after the transaction has resolved", async () => {
    const order: string[] = [];
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => {
      order.push("transaction started");
      const result = await callback(mockPrisma);
      order.push("transaction resolved");
      return result;
    }) as never);
    vi.mocked(notifyOrgCreated).mockImplementationOnce(() => {
      order.push("announced");
    });

    const res = await setup();

    expect(res.status).toBe(201);
    expect(order).toEqual([
      "transaction started",
      "transaction resolved",
      "announced",
    ]);
    expect(notifyOrgCreated).toHaveBeenCalledTimes(1);
    expect(notifyOrgCreated).toHaveBeenCalledWith(createdOrg);
  });

  it("announces nothing when setup was already completed", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await setup();

    expect(res.status).toBe(403);
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    expect(notifyOrgCreated).not.toHaveBeenCalled();
  });

  it("announces nothing when the transaction fails", async () => {
    mockPrisma.accounts.create.mockRejectedValue(new Error("connection lost"));

    const res = await setup();

    expect(res.status).toBe(500);
    expect(notifyOrgCreated).not.toHaveBeenCalled();
  });
});
```

In `src/app/api/__tests__/organizations-list-create.test.ts` (created by 1a):

1. Change the first line to `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";` and add below the `test-helpers` import:

```ts
import {
  TEST_NEW_ORG_ENTITLEMENTS,
  stubCloudMode,
} from "../../../../tests/setup/cloud-mode";
```

2. Directly after the existing `vi.mock("@/lib/audit-log", ...)` block add:

```ts
vi.mock("@/lib/control-plane/events", () => ({ notifyOrgCreated: vi.fn() }));
```

3. Directly after the existing `import prisma from "@/lib/prisma";` line add:

```ts
import { createAuditLog } from "@/lib/audit-log";
import { notifyOrgCreated } from "@/lib/control-plane/events";
```

4. Directly above `describe("GET /api/organizations", ...)` add:

```ts
afterEach(() => {
  vi.unstubAllEnvs();
});
```

5. Append at the end of the file:

```ts
describe("POST /api/organizations: creation through createOrganization", () => {
  const created = {
    id: "org-new",
    name: "New",
    slug: "new",
    createdAt: new Date("2026-10-12T08:00:00.000Z"),
  };

  function post(body: Record<string, unknown> = { name: "New", slug: "new" }) {
    return POST(
      createMockRequest("/api/organizations", { method: "POST", body }),
    );
  }

  function createdData(): Record<string, unknown> {
    return mockPrisma.organization.create.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
  }

  beforeEach(() => {
    mockPrisma.organization.create.mockResolvedValue(created as never);
  });

  it("writes the organization through the transaction client", async () => {
    const tx = { organization: { create: vi.fn().mockResolvedValue(created) } };
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => callback(tx)) as never);

    const res = await post();

    expect(res.status).toBe(201);
    expect(tx.organization.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
  });

  it("stores no entitlements outside cloud mode", async () => {
    await post();

    expect(createdData()).not.toHaveProperty("entitlements");
  });

  it("stores NEW_ORG_ENTITLEMENTS in cloud mode", async () => {
    stubCloudMode();

    await post();

    expect(createdData().entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
  });

  it("never takes entitlements or billing columns from the request body", async () => {
    stubCloudMode();

    await post({
      name: "New",
      slug: "new",
      entitlements: { features: ["scim"], maxAssets: null, maxUsers: null },
      plan: "enterprise",
      maxAssets: 999999,
      lockedAt: null,
    });

    const data = createdData();
    expect(data.entitlements).toEqual(TEST_NEW_ORG_ENTITLEMENTS);
    expect(data).not.toHaveProperty("plan");
    expect(data).not.toHaveProperty("maxAssets");
    expect(data).not.toHaveProperty("lockedAt");
  });

  it("leaves settings unset when the body has none", async () => {
    await post();

    expect(createdData()).not.toHaveProperty("settings");
  });

  it("stores the settings the body carries", async () => {
    await post({ name: "New", slug: "new", settings: { theme: "dark" } });

    expect(createdData().settings).toEqual({ theme: "dark" });
  });

  it("announces the organization only after the transaction has resolved", async () => {
    const order: string[] = [];
    mockPrisma.$transaction.mockImplementationOnce((async (
      callback: (client: unknown) => unknown,
    ) => {
      order.push("transaction started");
      const result = await callback(mockPrisma);
      order.push("transaction resolved");
      return result;
    }) as never);
    vi.mocked(notifyOrgCreated).mockImplementationOnce(() => {
      order.push("announced");
    });

    await post();

    expect(order).toEqual([
      "transaction started",
      "transaction resolved",
      "announced",
    ]);
    expect(notifyOrgCreated).toHaveBeenCalledTimes(1);
    expect(notifyOrgCreated).toHaveBeenCalledWith(created);
  });

  it("does not announce an organization whose slug is taken", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "other",
    } as never);

    const res = await post();

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(notifyOrgCreated).not.toHaveBeenCalled();
  });

  it("does not announce when the transaction fails", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db down"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(notifyOrgCreated).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("writes the audit entry for the created organization", async () => {
    await post();

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Organization",
        entityId: "org-new",
      }),
    );
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/organization-creation-paths.test.ts src/app/api/__tests__/auth-register.test.ts src/app/api/__tests__/setup.test.ts src/app/api/__tests__/organizations-list-create.test.ts`
Expected: FAIL. The scan reports the three route files as direct inserts and finds no creators; the register, setup and organization tests fail because the routes still write through the global client and never call `notifyOrgCreated`.

- [ ] **Step 8: Create the organization in registration through the helper, in one transaction**

In `src/app/api/auth/register/route.ts` make four edits.

Edit 1, imports. Earlier tasks changed this block (1a added `isLegacyBillingActive` and `legacyPlanToEntitlements`, Task 2 replaced `isSelfHosted` by `isCloudMode`). Replace the whole block, from the first line down to the line before `const registerSchema`, with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { randomBytes } from "crypto";
import {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
} from "@/lib/rate-limit";
import { requireNotDemoMode } from "@/lib/api-auth";
import { seedOrgDefaults } from "@/lib/org-defaults";
import { isCloudMode } from "@/lib/deployment-mode";
import {
  isLegacyBillingActive,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";
import {
  createOrganization,
  type CreateOrganizationInput,
} from "@/lib/organizations";
import { notifyOrgCreated } from "@/lib/control-plane/events";
import { isPublicSignupEnabled } from "@/lib/signup";
import { logger } from "@/lib/logger";
import { ForbiddenError } from "@/lib/errors";
import {
  assertEmailAssignable,
  EmailConflictError,
} from "@/lib/email-ownership";
```

Edit 2, the sign-up options. Insert directly above `export async function POST(req: Request) {` (below `generateSlug`):

```ts
const TRIAL_DAYS = 14;

/**
 * The plan columns and entitlements of an organization created by public
 * sign-up (SaaS boundary spec, sections 5 and 7).
 *
 * - Self-hosted: unlimited and no trial. Stored entitlements are ignored there,
 *   so none are written.
 * - Cloud with legacy billing (Stripe configured): the 14 day Professional trial,
 *   recorded in the legacy columns and as entitlements, until the control plane
 *   owns billing.
 * - Cloud without legacy billing: nothing here; `createOrganization` stores
 *   NEW_ORG_ENTITLEMENTS.
 */
function signUpOrgOptions(): Pick<
  CreateOrganizationInput,
  "legacy" | "entitlements"
> {
  if (!isCloudMode()) {
    return {
      legacy: {
        plan: "starter",
        trialEndsAt: null,
        maxAssets: -1,
        maxUsers: -1,
      },
    };
  }
  if (!isLegacyBillingActive()) return {};
  return {
    legacy: {
      plan: "professional",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      maxAssets: 5000,
      maxUsers: 25,
    },
    entitlements: legacyPlanToEntitlements("professional", 5000, 25),
  };
}
```

Edit 3, the transaction. Replace everything from `const hashedPassword = await hashPassword(password);` through `await seedOrgDefaults(org.id);` (the trial block as Task 2 left it, the three `prisma.*.create` calls and the seeding; the `return NextResponse.json(...)` that follows stays) with:

```ts
const hashedPassword = await hashPassword(password);

// Organization, admin, credential account and defaults commit together, so
// a failure half way leaves no orphan organization behind. Only `tx` is used
// inside: the production pool has three connections.
const org = await prisma.$transaction(async (tx) => {
  const created = await createOrganization(tx, {
    name: organization,
    slug: generateSlug(organization),
    ...signUpOrgOptions(),
  });

  const user = await tx.user.create({
    data: {
      firstname,
      lastname,
      email: normalizedEmail,
      username,
      password: hashedPassword,
      isadmin: true,
      canrequest: true,
      organizationId: created.id,
      creation_date: new Date(),
    },
  });

  // Create BetterAuth credential account for email/password login
  await tx.accounts.create({
    data: {
      userId: user.userid,
      providerId: "credential",
      accountId: user.userid,
      password: hashedPassword,
    },
  });

  // Seed default status types and categories for the new organization
  await seedOrgDefaults(created.id, tx);

  return created;
});

// After the commit; never throws, so the sign-up cannot fail because the
// control plane is down.
notifyOrgCreated(org);
```

Edit 4, the duration budget. Directly below `export const dynamic = "force-dynamic";` add:

```ts
// The org.created delivery runs in after() and can take up to 16.5 s.
export const maxDuration = 30;
```

- [ ] **Step 9: Create the setup organization through the helper**

In `src/app/api/setup/route.ts`:

Edit 1. Directly after `import { logger } from "@/lib/logger";` add:

```ts
import { createOrganization } from "@/lib/organizations";
import { notifyOrgCreated } from "@/lib/control-plane/events";
```

Edit 2. The transaction now returns the organization as well. Replace

```ts
    const user = await prisma.$transaction(
```

with

```ts
    const { user, org } = await prisma.$transaction(
```

Edit 3. Replace

```ts
const org = await tx.organization.create({
  data: {
    name: organization,
    slug: generateSlug(organization),
  },
});
```

with

```ts
const createdOrg = await createOrganization(tx, {
  name: organization,
  slug: generateSlug(organization),
});
```

and, in the `tx.user.create` call below it, replace `organizationId: org.id,` with `organizationId: createdOrg.id,`.

Edit 4. Replace

```ts
        return createdUser;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
```

with

```ts
        return { user: createdUser, org: createdOrg };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // After the commit; never throws, so the setup cannot fail because the
    // control plane is down.
    notifyOrgCreated(org);
```

Edit 5. Directly below `export const dynamic = "force-dynamic";` add:

```ts
// The org.created delivery runs in after() and can take up to 16.5 s.
export const maxDuration = 30;
```

- [ ] **Step 10: Create the organization in the admin route through the helper**

In `src/app/api/organizations/route.ts`:

Edit 1. 1a imports `organizationApiSelect` from `@/lib/organizations`. Extend that import and add the event import below it:

```ts
import { createOrganization, organizationApiSelect } from "@/lib/organizations";
import { notifyOrgCreated } from "@/lib/control-plane/events";
```

Edit 2. In `POST`, replace the create call as 1a left it

```ts
const organization = await prisma.organization.create({
  data: {
    name: validated.name,
    slug: validated.slug,
    description: validated.description,
    settings: validated.settings
      ? (validated.settings as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  },
  select: organizationApiSelect,
});
```

with

```ts
// Entitlements are never taken from the request body: only the internal
// API sets them. The helper stores NEW_ORG_ENTITLEMENTS in cloud mode.
const organization = await prisma.$transaction((tx) =>
  createOrganization(tx, {
    name: validated.name,
    slug: validated.slug,
    description: validated.description,
    settings: validated.settings
      ? (validated.settings as Prisma.InputJsonValue)
      : undefined,
  }),
);

// After the commit; never throws.
notifyOrgCreated(organization);
```

The `createAuditLog(...)` call and the `return NextResponse.json(organization, { status: 201 })` below stay as they are (the helper selects `organizationApiSelect`, so the response keeps the allow-list from 1a).

Edit 3. Directly below `export const dynamic = "force-dynamic";` add:

```ts
// The org.created delivery runs in after() and can take up to 16.5 s.
export const maxDuration = 30;
```

- [ ] **Step 11: Document the demo seed**

`prisma/demo-seed.js` is plain CommonJS and cannot import the TypeScript helper. It keeps NULL entitlements on purpose. In `createDefaultOrganization`, replace

```js
  console.log("Creating default organization...");

  const org = await prisma.organization.create({
```

with

```js
  console.log("Creating default organization...");

  // Entitlements stay NULL on purpose. The demo never runs in cloud mode, and a
  // NULL resolves to "not set" everywhere (SaaS boundary spec, section 5).
  // This file is plain CommonJS and cannot import createOrganization from
  // src/lib/organizations.ts, so it is the one place that inserts an
  // organization outside the helper.
  const org = await prisma.organization.create({
```

- [ ] **Step 12: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts src/lib/__tests__/organization-creation-paths.test.ts src/app/api/__tests__/auth-register.test.ts src/app/api/__tests__/setup.test.ts src/app/api/__tests__/organizations-list-create.test.ts src/app/api/__tests__/organizations-id.test.ts src/app/api/__tests__/email-ownership-routes.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/organizations.ts src/lib/org-defaults.ts src/app/api/auth/register/route.ts src/app/api/setup/route.ts src/app/api/organizations/route.ts src/lib/__tests__/organizations.test.ts src/lib/__tests__/org-defaults.test.ts src/lib/__tests__/organization-creation-paths.test.ts src/app/api/__tests__/auth-register.test.ts src/app/api/__tests__/setup.test.ts src/app/api/__tests__/organizations-list-create.test.ts`
Expected: no output.

This task changes routes other tests exercise, so run the whole suite before committing: `npx vitest run`
Expected: PASS (DB-backed tests skipped locally).

- [ ] **Step 13: Commit**

```bash
git add src/app/api/auth/register/route.ts src/app/api/setup/route.ts src/app/api/organizations/route.ts prisma/demo-seed.js src/lib/__tests__/organization-creation-paths.test.ts src/app/api/__tests__/auth-register.test.ts src/app/api/__tests__/setup.test.ts src/app/api/__tests__/organizations-list-create.test.ts
git commit -m "feat: create organizations through one helper and announce them to the control plane"
```
