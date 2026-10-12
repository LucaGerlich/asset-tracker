### Task 5: Deployment marker guard and cut-over script

A hosted database carries a `system_settings` row `deployment.mode = 'cloud'`. A production server that finds it but has no `CONTROL_PLANE_SECRET` refuses to start, so a hosted deployment that loses its secret (or a Preview deployment on the production database) can never run unrestricted. Only a stored `cloud` marker can stop a server; a failed read, a missing table or an unreachable database lets it start, because a self-hoster must never be blocked by this check. Two commits: the guard (Steps 1 to 6), then the operator script that writes the marker (Steps 7 to 11).

**Files:**

- Create: `src/lib/deployment-marker.ts`
- Create: `scripts/lib/deployment-mode-marker.ts`
- Create: `scripts/set-deployment-mode.ts`
- Modify: `src/instrumentation.ts`
- Modify: `src/lib/settings-keys.ts` (add `HIDDEN_SETTING_KEY_PREFIXES`)
- Modify: `src/app/admin/settings/page.tsx` (`getSystemSettings` only)
- Modify: `src/app/api/cron/demo-reset/route.ts`
- Test: `src/lib/__tests__/deployment-marker.test.ts` (create)
- Test: `src/__tests__/instrumentation.test.ts` (create)
- Test: `src/lib/__tests__/settings-keys.test.ts` (extend)
- Test: `src/app/__tests__/settings-page-hidden-keys.test.ts` (create)
- Test: `src/app/api/__tests__/demo-reset.test.ts` (create)
- Test: `tests/scripts/deployment-mode-marker.test.ts` (create; pure)
- Test: `tests/scripts/deployment-mode-marker.db.test.ts` (create; DB-gated, CI only)

**Interfaces:**

- Consumes: `isCloudMode` (`src/lib/deployment-mode.ts`, Task 2); `stubCloudMode` (`tests/setup/cloud-mode.ts`, Task 2); `parseSchemaName`, `describeTarget`, `qualified`, `assertColumns` (`scripts/lib/db-target.ts`, phase 1a); the `system_settings` model (`settingKey` unique, `settingValue`, `settingType`, `category`, `updatedAt` without a default).
- Produces in `src/lib/deployment-marker.ts`:
  - `DEPLOYMENT_MODE_KEY = "deployment.mode"`
  - `assertDeploymentMarker(marker: string | null): void` (throws `Error("Refusing to start: this database belongs to a cloud deployment, but CONTROL_PLANE_SECRET is not set")` when `marker === "cloud"` and not cloud mode; otherwise returns)
  - `readDeploymentMarker(): Promise<string | null>` (one `system_settings` read through a dynamic `import("@/lib/prisma")`; any error is logged at error level and yields `null`)
  - `warnIfSelfHostedSet(): void` (one `logger.warn` when `process.env.SELF_HOSTED !== undefined`: deprecated and ignored)
- `src/instrumentation.ts` `register()`, `nodejs` branch, after env validation: `warnIfSelfHostedSet()`; then, only when `NODE_ENV === "production"` and `NEXT_PHASE !== PHASE_PRODUCTION_BUILD` **and not in cloud mode** (spec section 1: the secret is already there, so no read is needed), `assertDeploymentMarker(await readDeploymentMarker())`.
- Produces in `src/lib/settings-keys.ts`: `HIDDEN_SETTING_KEY_PREFIXES = ["sso.token.", "deployment."] as const`.
- Produces in `scripts/lib/deployment-mode-marker.ts`:
  - `type DeploymentMode = "cloud"`
  - `assertConfirmed(target: string, confirm: string | undefined): void` (throws unless `confirm === target`)
  - `readDeploymentMode(client: pg.ClientBase, schema: string): Promise<string | null>`
  - `writeDeploymentMode(client: pg.ClientBase, schema: string, mode: DeploymentMode): Promise<void>` (`INSERT ... ON CONFLICT ("settingKey") DO UPDATE`, `settingType 'string'`, `category 'deployment'`, `updatedAt` now in UTC)
- `scripts/set-deployment-mode.ts`: `--schema` (required, `parseSchemaName`), `--confirm "<describeTarget>"` (required), writes `cloud`. `describeTarget` accepts only a `postgres:` or `postgresql:` URL that names host, port and database explicitly (there is no default port) and has no `host`, `hostaddr`, `port`, `dbname` or `service` query parameter, so `DATABASE_URL` for this script always carries an explicit port.
- Marker exclusions: `getSystemSettings` never returns a key starting with `deployment.`; the demo reset deletes every `system_settings` row except `DEPLOYMENT_MODE_KEY`, and refuses to run at all in cloud mode. (The four settings PUT routes already refuse to write the key: `settings-keys.test.ts`, `settings-sso.test.ts`, `settings-platform-routes.test.ts`.)

- [ ] **Step 1: Write the failing tests**

`deployment-marker.test.ts` covers the three exports. `readDeploymentMarker` runs against the Prisma automock. Create `src/lib/__tests__/deployment-marker.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  DEPLOYMENT_MODE_KEY,
  assertDeploymentMarker,
  readDeploymentMarker,
  warnIfSelfHostedSet,
} from "@/lib/deployment-marker";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  // CI or a developer shell may have either variable set.
  vi.stubEnv("CONTROL_PLANE_SECRET", undefined);
  vi.stubEnv("SELF_HOSTED", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEPLOYMENT_MODE_KEY", () => {
  it("is the key the cut-over script writes and the settings routes refuse", () => {
    expect(DEPLOYMENT_MODE_KEY).toBe("deployment.mode");
  });
});

describe("assertDeploymentMarker", () => {
  it("refuses to start when the database is marked cloud and the secret is missing", () => {
    expect(() => assertDeploymentMarker("cloud")).toThrow(
      "Refusing to start: this database belongs to a cloud deployment, but CONTROL_PLANE_SECRET is not set",
    );
  });

  it("starts when the database is marked cloud and the secret is set", () => {
    stubCloudMode();

    expect(() => assertDeploymentMarker("cloud")).not.toThrow();
  });

  it("starts when there is no marker (every self-hosted database)", () => {
    expect(() => assertDeploymentMarker(null)).not.toThrow();
  });

  it.each(["", "self-hosted", "Cloud", "true"])(
    "starts for the unrelated marker value %j",
    (marker) => {
      expect(() => assertDeploymentMarker(marker)).not.toThrow();
    },
  );
});

describe("readDeploymentMarker", () => {
  it("reads only the marker row, once", async () => {
    mockPrisma.system_settings.findUnique.mockResolvedValue({
      settingValue: "cloud",
    } as never);

    await expect(readDeploymentMarker()).resolves.toBe("cloud");

    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledWith({
      where: { settingKey: "deployment.mode" },
      select: { settingValue: true },
    });
  });

  it("returns null when there is no marker row", async () => {
    mockPrisma.system_settings.findUnique.mockResolvedValue(null);

    await expect(readDeploymentMarker()).resolves.toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns null when the row has no value", async () => {
    mockPrisma.system_settings.findUnique.mockResolvedValue({
      settingValue: null,
    } as never);

    await expect(readDeploymentMarker()).resolves.toBeNull();
  });

  it("logs a database error at error level and returns null instead of blocking start-up", async () => {
    const failure = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    mockPrisma.system_settings.findUnique.mockRejectedValue(failure);

    await expect(readDeploymentMarker()).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("deployment marker"),
      { error: failure },
    );
  });

  it("returns null when the system_settings table does not exist yet", async () => {
    mockPrisma.system_settings.findUnique.mockRejectedValue(
      new Error('relation "system_settings" does not exist'),
    );

    await expect(readDeploymentMarker()).resolves.toBeNull();
  });
});

describe("warnIfSelfHostedSet", () => {
  it("warns once that SELF_HOSTED is deprecated and ignored", () => {
    vi.stubEnv("SELF_HOSTED", "true");

    warnIfSelfHostedSet();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/SELF_HOSTED.*deprecated.*ignored/),
    );
  });

  it("warns for any value, including false and an empty string", () => {
    vi.stubEnv("SELF_HOSTED", "false");
    warnIfSelfHostedSet();
    vi.stubEnv("SELF_HOSTED", "");
    warnIfSelfHostedSet();

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("stays silent when the variable is unset", () => {
    warnIfSelfHostedSet();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
```

`instrumentation.test.ts` drives the real `register()`. Only Sentry, the environment validation and Prisma are replaced; `deployment-marker.ts` and `deployment-mode.ts` are real, so the chain from a stored marker (or a database error) to "refuses to start" or "starts" is tested end to end. This replaces a static scan of the file. Create `src/__tests__/instrumentation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }));
vi.mock("../../sentry.server.config", () => ({}));
vi.mock("../../sentry.edge.config", () => ({}));
vi.mock("@/lib/logger");
vi.mock("@/lib/prisma");
vi.mock("@/lib/env-validation", () => ({
  validateAndLogEnvironment: vi.fn(),
  validateEnvironment: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  validateAndLogEnvironment,
  validateEnvironment,
} from "@/lib/env-validation";
import { register } from "@/instrumentation";
import { stubCloudMode } from "../../tests/setup/cloud-mode";

const mockPrisma = vi.mocked(prisma, true);
const mockValidateAndLog = vi.mocked(validateAndLogEnvironment);
const mockValidate = vi.mocked(validateEnvironment);

/** What the system_settings lookup of the marker returns. */
function storedMarker(settingValue: string | null): void {
  mockPrisma.system_settings.findUnique.mockResolvedValue(
    settingValue === null ? null : ({ settingValue } as never),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAndLog.mockReturnValue(true);
  mockValidate.mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
    variables: {},
  });
  storedMarker(null);
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PHASE", "phase-production-server");
  vi.stubEnv("CONTROL_PLANE_SECRET", undefined);
  vi.stubEnv("SELF_HOSTED", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("register(): deployment marker guard", () => {
  it("refuses to start when the database is marked cloud and the secret is missing", async () => {
    storedMarker("cloud");

    await expect(register()).rejects.toThrow(
      "Refusing to start: this database belongs to a cloud deployment, but CONTROL_PLANE_SECRET is not set",
    );
  });

  it("starts when the database has no marker, after one lookup", async () => {
    await expect(register()).resolves.toBeUndefined();

    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledWith({
      where: { settingKey: "deployment.mode" },
      select: { settingValue: true },
    });
  });

  it("starts when the database is unreachable, and logs the failure", async () => {
    mockPrisma.system_settings.findUnique.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:1"),
    );

    await expect(register()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("starts when the marker has an unrelated value", async () => {
    storedMarker("self-hosted");

    await expect(register()).resolves.toBeUndefined();
  });

  it("does not look up the marker in cloud mode: the secret is there", async () => {
    stubCloudMode();
    storedMarker("cloud");

    await expect(register()).resolves.toBeUndefined();

    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
  });

  it("skips the guard during next build, even with a cloud marker", async () => {
    vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);
    storedMarker("cloud");

    await expect(register()).resolves.toBeUndefined();

    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
  });

  it.each(["development", "test"])(
    "skips the guard when NODE_ENV is %s",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      storedMarker("cloud");

      await expect(register()).resolves.toBeUndefined();

      expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
    },
  );

  it("does nothing in the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    storedMarker("cloud");

    await expect(register()).resolves.toBeUndefined();

    expect(mockValidateAndLog).not.toHaveBeenCalled();
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
  });

  it("still refuses an invalid environment first, without a lookup", async () => {
    mockValidateAndLog.mockReturnValue(false);
    mockValidate.mockReturnValue({
      valid: false,
      errors: ["Missing required environment variable: CRON_SECRET"],
      warnings: [],
      variables: {},
    });

    await expect(register()).rejects.toThrow(
      "Refusing to start: environment validation failed — Missing required environment variable: CRON_SECRET",
    );
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
  });
});

describe("register(): SELF_HOSTED deprecation", () => {
  it("warns once when SELF_HOSTED is set", async () => {
    vi.stubEnv("SELF_HOSTED", "true");

    await register();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/SELF_HOSTED.*deprecated.*ignored/),
    );
  });

  it("warns outside production too", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SELF_HOSTED", "true");

    await register();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("does not run in the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("SELF_HOSTED", "true");

    await register();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("stays silent when SELF_HOSTED is unset", async () => {
    await register();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
```

`demo-reset.test.ts` makes the seeding fail right after the clear (`statusType.create` rejects), because only the `system_settings` clear is under test. Create `src/app/api/__tests__/demo-reset.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({ isValidCronAuth: vi.fn(() => true) }));

import { GET } from "@/app/api/cron/demo-reset/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("DEMO_ALLOW_RESET", "true");
  // Stop right after the database has been cleared: seeding is not under test.
  mockPrisma.statusType.create.mockRejectedValue(new Error("stop after clear"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/demo-reset", () => {
  it("clears system_settings but never the deployment marker", async () => {
    await GET(createMockRequest("/api/cron/demo-reset"));

    expect(mockPrisma.system_settings.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.system_settings.deleteMany).toHaveBeenCalledWith({
      where: { settingKey: { not: "deployment.mode" } },
    });
  });

  it("clears nothing outside demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    const res = await GET(createMockRequest("/api/cron/demo-reset"));

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.deleteMany).not.toHaveBeenCalled();
  });

  it("clears nothing without DEMO_ALLOW_RESET", async () => {
    vi.stubEnv("DEMO_ALLOW_RESET", "");

    const res = await GET(createMockRequest("/api/cron/demo-reset"));

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.deleteMany).not.toHaveBeenCalled();
  });

  it("never resets a cloud deployment, whatever the demo flags say", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "x".repeat(48));

    const res = await GET(createMockRequest("/api/cron/demo-reset"));

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.organization.deleteMany).not.toHaveBeenCalled();
  });
});
```

The settings page lists every `system_settings` row for a super-admin, and a page file cannot export its loader (Next.js restricts page exports), so the filter is a shared constant plus a static check of the page. Add to the imports of `src/lib/__tests__/settings-keys.test.ts`:

```ts
import { DEPLOYMENT_MODE_KEY } from "@/lib/deployment-marker";
```

and `HIDDEN_SETTING_KEY_PREFIXES` to the existing `@/lib/settings-keys` import list (between `ALLOWED_SETTING_KEYS` and `MASKED_VALUE`), then append at the end of the file:

```ts
describe("HIDDEN_SETTING_KEY_PREFIXES", () => {
  const isHidden = (key: string): boolean =>
    HIDDEN_SETTING_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

  it("hides the short-lived SSO login rows and the deployment marker", () => {
    expect([...HIDDEN_SETTING_KEY_PREFIXES]).toEqual([
      "sso.token.",
      "deployment.",
    ]);
  });

  it("covers the deployment marker key", () => {
    expect(isHidden(DEPLOYMENT_MODE_KEY)).toBe(true);
  });

  it("does not hide ordinary configuration keys", () => {
    expect(isHidden("sso.enabled")).toBe(false);
    expect(isHidden("sso.tokenUrl")).toBe(false);
    expect(isHidden("ldap.enabled")).toBe(false);
  });
});
```

Create `src/app/__tests__/settings-page-hidden-keys.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static guard: the admin settings page lists every system_settings row for a
 * super-admin, and the table also holds the deployment marker. The query has
 * to filter through HIDDEN_SETTING_KEY_PREFIXES, or the marker is shipped to
 * the browser. (The page cannot export its loader: Next.js restricts the
 * exports of a page file.)
 */

const PAGE = path.resolve(__dirname, "../admin/settings/page.tsx");

describe("admin settings page", () => {
  const source = readFileSync(PAGE, "utf8");

  it("filters the system_settings list through HIDDEN_SETTING_KEY_PREFIXES", () => {
    const call = source.slice(
      source.indexOf("prisma.system_settings.findMany("),
    );
    const args = call.slice(0, call.indexOf("orderBy"));

    expect(args).toContain("NOT: HIDDEN_SETTING_KEY_PREFIXES.map");
    expect(args).toContain("startsWith: prefix");
  });

  it("imports the prefix list from settings-keys", () => {
    expect(source).toMatch(
      /import \{[^}]*HIDDEN_SETTING_KEY_PREFIXES[^}]*\} from "@\/lib\/settings-keys"/,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/deployment-marker.test.ts src/__tests__/instrumentation.test.ts src/app/api/__tests__/demo-reset.test.ts src/lib/__tests__/settings-keys.test.ts src/app/__tests__/settings-page-hidden-keys.test.ts`
Expected: FAIL. `deployment-marker.test.ts` and `settings-keys.test.ts` cannot resolve `@/lib/deployment-marker`; in `instrumentation.test.ts` the cases "refuses to start when the database is marked cloud...", "starts when the database has no marker, after one lookup", "starts when the database is unreachable, and logs the failure", "warns once when SELF_HOSTED is set" and "warns outside production too" fail; `demo-reset.test.ts` fails on "clears system_settings but never the deployment marker" (it is called with `{}`); the page check fails on `NOT: HIDDEN_SETTING_KEY_PREFIXES.map`.

- [ ] **Step 3: Write the guard and the exclusions**

Create `src/lib/deployment-marker.ts`:

```ts
import { isCloudMode } from "@/lib/deployment-mode";
import { logger } from "@/lib/logger";

/**
 * Fail-closed guard for hosted deployments (SaaS boundary spec, section 1).
 *
 * The cut-over script (scripts/set-deployment-mode.ts) writes the
 * system_settings row "deployment.mode" = "cloud" into the hosted database. A
 * server that finds this marker but has no CONTROL_PLANE_SECRET refuses to
 * start, so a hosted deployment that loses its secret (or a Preview pointed at
 * the production database) can never run unrestricted. A self-hosted database
 * never carries the marker.
 *
 * Only a stored "cloud" marker can stop a server. Every other outcome, a
 * failed read included, lets it start: a self-hoster must never be blocked by
 * this check.
 */

/** system_settings key of the marker. The settings routes refuse to write it. */
export const DEPLOYMENT_MODE_KEY = "deployment.mode";

/**
 * Throws when the database is marked as a cloud deployment but this server is
 * not one.
 */
export function assertDeploymentMarker(marker: string | null): void {
  if (marker === "cloud" && !isCloudMode()) {
    throw new Error(
      "Refusing to start: this database belongs to a cloud deployment, but CONTROL_PLANE_SECRET is not set",
    );
  }
}

/**
 * Reads the marker with one query. Any error (database down, table missing on
 * a fresh install, a DB-less test run) is logged and yields null. Prisma is
 * imported lazily, so a process that never calls this, such as the build,
 * never opens a connection pool.
 */
export async function readDeploymentMarker(): Promise<string | null> {
  try {
    const { default: prisma } = await import("@/lib/prisma");
    const row = await prisma.system_settings.findUnique({
      where: { settingKey: DEPLOYMENT_MODE_KEY },
      select: { settingValue: true },
    });
    return row?.settingValue ?? null;
  } catch (error) {
    logger.error(
      "Could not read the deployment marker; starting without the fail-closed check",
      { error },
    );
    return null;
  }
}

/**
 * SELF_HOSTED is gone: self-hosted is the default and CONTROL_PLANE_SECRET
 * selects cloud mode. Warns so that nobody believes the variable still works.
 */
export function warnIfSelfHostedSet(): void {
  if (process.env.SELF_HOSTED !== undefined) {
    logger.warn(
      "SELF_HOSTED is deprecated and ignored. Self-hosted is the default; remove the variable from the environment.",
    );
  }
}
```

In `src/instrumentation.ts`, the guard goes into the `nodejs` branch of `register()` after the environment validation. Both checks share one definition of "a production server that is really starting" (`next build` sets `NODE_ENV=production` too, and CI and the Docker builder build without secrets and without a database). The dynamic imports follow the file's existing pattern. Before:

```ts
    const { validateAndLogEnvironment, validateEnvironment } =
      await import("@/lib/env-validation");
    const environmentIsValid = validateAndLogEnvironment();

    // Refuse to boot a production server with missing/invalid required env
    // vars. Skip this during `next build` (NEXT_PHASE is set there but
    // NODE_ENV is also "production") — CI builds run without secrets like
    // CRON_SECRET, and the build itself doesn't need them.
    if (
      !environmentIsValid &&
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD
    ) {
      const { errors } = validateEnvironment();
      throw new Error(
        `Refusing to start: environment validation failed — ${errors.join("; ")}`,
      );
    }
  }
```

After:

```ts
    const { validateAndLogEnvironment, validateEnvironment } =
      await import("@/lib/env-validation");
    const environmentIsValid = validateAndLogEnvironment();

    // Both checks below are fatal only for a production server that is really
    // starting. Skip them during `next build` (NEXT_PHASE is set there but
    // NODE_ENV is also "production") — CI builds run without secrets like
    // CRON_SECRET and without a database, and the build needs neither.
    const isProductionRuntime =
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD;

    // Refuse to boot a production server with missing/invalid required env vars.
    if (!environmentIsValid && isProductionRuntime) {
      const { errors } = validateEnvironment();
      throw new Error(
        `Refusing to start: environment validation failed — ${errors.join("; ")}`,
      );
    }

    const {
      assertDeploymentMarker,
      readDeploymentMarker,
      warnIfSelfHostedSet,
    } = await import("@/lib/deployment-marker");
    warnIfSelfHostedSet();

    // Fail closed: a database marked as a cloud deployment must never be served
    // without CONTROL_PLANE_SECRET. Cloud mode itself needs no read (the secret
    // is there). A failed read lets the server start; see deployment-marker.ts.
    if (isProductionRuntime) {
      const { isCloudMode } = await import("@/lib/deployment-mode");
      if (!isCloudMode()) {
        assertDeploymentMarker(await readDeploymentMarker());
      }
    }
  }
```

In `src/lib/settings-keys.ts`, add the prefix list after the mask constant. Before:

```ts
/** Placeholder the GET routes return in place of an encrypted value. */
export const MASKED_VALUE = "********";
```

After:

```ts
/** Placeholder the GET routes return in place of an encrypted value. */
export const MASKED_VALUE = "********";

/**
 * Key prefixes that are not platform configuration: the short-lived SSO login
 * rows and the deployment marker. The admin settings page never sends rows
 * with these prefixes to the browser.
 */
export const HIDDEN_SETTING_KEY_PREFIXES = [
  "sso.token.",
  "deployment.",
] as const;
```

In `src/app/admin/settings/page.tsx`, use it in `getSystemSettings`. Before (import):

```ts
import { MASKED_VALUE } from "@/lib/settings-keys";
```

After:

```ts
import { HIDDEN_SETTING_KEY_PREFIXES, MASKED_VALUE } from "@/lib/settings-keys";
```

Before (the loader and its comment):

```ts
/**
 * Platform-wide system settings, grouped by category. The table is shared by
 * every tenant: call this only for a super-admin. Short-lived sso.token.*
 * login rows are never part of the configuration and never leave the server.
 */
async function getSystemSettings(): Promise<GroupedSettings> {
  const settings = await prisma.system_settings.findMany({
    where: { NOT: { settingKey: { startsWith: "sso.token." } } },
    orderBy: [{ category: "asc" }, { settingKey: "asc" }],
  });
```

After (`NOT` with a list means none of the conditions may match):

```ts
/**
 * Platform-wide system settings, grouped by category. The table is shared by
 * every tenant: call this only for a super-admin. Rows with a
 * HIDDEN_SETTING_KEY_PREFIXES prefix (the short-lived sso.token.* login rows
 * and the deployment.* marker) are never part of the configuration and never
 * leave the server.
 */
async function getSystemSettings(): Promise<GroupedSettings> {
  const settings = await prisma.system_settings.findMany({
    where: {
      NOT: HIDDEN_SETTING_KEY_PREFIXES.map((prefix) => ({
        settingKey: { startsWith: prefix },
      })),
    },
    orderBy: [{ category: "asc" }, { settingKey: "asc" }],
  });
```

In `src/app/api/cron/demo-reset/route.ts`, keep the marker when the reset clears the table. Before (import block):

```ts
import { logger } from "@/lib/logger";
```

After:

```ts
import { logger } from "@/lib/logger";
import { DEPLOYMENT_MODE_KEY } from "@/lib/deployment-marker";
import { isCloudMode } from "@/lib/deployment-mode";
```

Before (in `GET`, the second safety check):

```ts
// Extra safety: never allow demo reset when DEMO_ALLOW_RESET is not explicitly set
if (process.env.DEMO_ALLOW_RESET !== "true") {
  logger.warn(
    "Demo reset blocked: DEMO_ALLOW_RESET is not set. Set DEMO_ALLOW_RESET=true to enable.",
  );
  return NextResponse.json(
    { error: "Demo reset is disabled. Set DEMO_ALLOW_RESET=true to enable." },
    { status: 403 },
  );
}
```

After (append a third check below it):

```ts
// Extra safety: never allow demo reset when DEMO_ALLOW_RESET is not explicitly set
if (process.env.DEMO_ALLOW_RESET !== "true") {
  logger.warn(
    "Demo reset blocked: DEMO_ALLOW_RESET is not set. Set DEMO_ALLOW_RESET=true to enable.",
  );
  return NextResponse.json(
    { error: "Demo reset is disabled. Set DEMO_ALLOW_RESET=true to enable." },
    { status: 403 },
  );
}

// A hosted (cloud) database holds every tenant: a demo reset there would
// delete them all, so it is refused whatever the demo flags say.
if (isCloudMode()) {
  logger.warn("Demo reset blocked: refused in cloud mode.");
  return NextResponse.json(
    { error: "Demo reset is disabled in cloud mode." },
    { status: 403 },
  );
}
```

Before (in `clearDatabase`):

```ts
await prisma.system_settings.deleteMany({});
```

After:

```ts
// The deployment marker survives a reset: wiping it would silently disarm
// the fail-closed start-up guard of a hosted database.
await prisma.system_settings.deleteMany({
  where: { settingKey: { not: DEPLOYMENT_MODE_KEY } },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/deployment-marker.test.ts src/__tests__/instrumentation.test.ts src/app/api/__tests__/demo-reset.test.ts src/lib/__tests__/settings-keys.test.ts src/app/__tests__/settings-page-hidden-keys.test.ts src/app/__tests__/server-pages-static-scope.test.ts src/app/api/__tests__/settings-sso.test.ts src/app/api/__tests__/settings-platform-routes.test.ts`
Expected: PASS. The last three files pin that the settings routes still refuse to write `deployment.mode` and that the settings page still has a `where` on every `findMany`.

- [ ] **Step 5: Type check, lint and the whole suite**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/deployment-marker.ts src/instrumentation.ts src/lib/settings-keys.ts src/app/admin/settings/page.tsx src/app/api/cron/demo-reset/route.ts src/lib/__tests__/deployment-marker.test.ts src/__tests__/instrumentation.test.ts src/lib/__tests__/settings-keys.test.ts src/app/__tests__/settings-page-hidden-keys.test.ts src/app/api/__tests__/demo-reset.test.ts`
Expected: no output.

Run: `npx vitest run` (`instrumentation.ts` and `settings-keys.ts` are shared)
Expected: PASS (DB tests skipped locally).

- [ ] **Step 6: Commit**

```bash
git add src/lib/deployment-marker.ts src/instrumentation.ts src/lib/settings-keys.ts src/app/admin/settings/page.tsx src/app/api/cron/demo-reset/route.ts src/lib/__tests__/deployment-marker.test.ts src/__tests__/instrumentation.test.ts src/lib/__tests__/settings-keys.test.ts src/app/__tests__/settings-page-hidden-keys.test.ts src/app/api/__tests__/demo-reset.test.ts
git commit -F - <<'EOF'
feat: refuse to start a hosted database without the control-plane secret

A system_settings row deployment.mode = cloud marks a database as hosted. In a
production runtime (not during next build) that is not in cloud mode, register()
reads the row once and refuses to start when it says cloud. Any read failure is
logged and the server starts, so a self-hoster is never blocked by the check.

The settings page no longer lists deployment.* rows and the demo reset keeps the
marker. A set SELF_HOSTED now logs a one-time deprecation warning.
EOF
```

- [ ] **Step 7: Write the failing script tests**

The pure test uses a fake `pg` client that records its statements, so the SQL and the confirmation guard are tested locally. The DB test runs the real statements against Postgres in a rolled-back transaction, in CI only. Vitest 4 removed the `it(name, fn, options)` signature: options go second, `it(name, DB_TEST, fn)`. Create `tests/scripts/deployment-mode-marker.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type pg from "pg";
import {
  assertConfirmed,
  readDeploymentMode,
  writeDeploymentMode,
} from "../../scripts/lib/deployment-mode-marker";

const TARGET = "db.example.com:5432/postgres/public";

/** A pg client that records the statements it receives. */
function fakeClient(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return { client: { query } as unknown as pg.ClientBase, query };
}

describe("assertConfirmed", () => {
  it("accepts the exact target", () => {
    expect(() => assertConfirmed(TARGET, TARGET)).not.toThrow();
  });

  it("requires --confirm and shows the value to repeat", () => {
    expect(() => assertConfirmed(TARGET, undefined)).toThrow(
      `--confirm "${TARGET}" is required`,
    );
  });

  it.each([
    "db.example.com:5432/postgres/assettool",
    "other.example.com:5432/postgres/public",
    `${TARGET} `,
    "",
  ])("rejects the different target %j", (confirm) => {
    expect(() => assertConfirmed(TARGET, confirm)).toThrow(
      `--confirm "${TARGET}" is required`,
    );
  });
});

describe("readDeploymentMode", () => {
  it("reads the marker row from the given schema", async () => {
    const { client, query } = fakeClient([{ settingValue: "cloud" }]);

    await expect(readDeploymentMode(client, "assettool")).resolves.toBe(
      "cloud",
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('FROM "assettool"."system_settings"');
    expect(sql).toContain('"settingKey" = $1');
    expect(params).toEqual(["deployment.mode"]);
  });

  it("returns null when there is no row or no value", async () => {
    await expect(
      readDeploymentMode(fakeClient([]).client, "public"),
    ).resolves.toBeNull();
    await expect(
      readDeploymentMode(fakeClient([{ settingValue: null }]).client, "public"),
    ).resolves.toBeNull();
  });

  it("rejects an invalid schema name before querying", async () => {
    const { client, query } = fakeClient();

    await expect(readDeploymentMode(client, 'a"b')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("writeDeploymentMode", () => {
  it("upserts the marker with parameters, never string-built values", async () => {
    const { client, query } = fakeClient();

    await writeDeploymentMode(client, "public", "cloud");

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO "public"."system_settings"');
    expect(sql).toContain('ON CONFLICT ("settingKey") DO UPDATE');
    expect(sql).toContain("'string'");
    expect(sql).toContain("'deployment'");
    expect(sql).not.toContain("cloud");
    expect(params).toEqual(["deployment.mode", "cloud"]);
  });

  it("only touches the value and updatedAt of an existing row", async () => {
    const { client, query } = fakeClient();

    await writeDeploymentMode(client, "public", "cloud");

    const [sql] = query.mock.calls[0];
    const update = String(sql).slice(String(sql).indexOf("DO UPDATE"));
    expect(update).toContain('"settingValue" = EXCLUDED."settingValue"');
    expect(update).toContain('"updatedAt"');
    expect(update).not.toContain('"createdAt"');
    expect(update).not.toContain('"isEncrypted"');
  });

  it("rejects an invalid schema name before querying", async () => {
    const { client, query } = fakeClient();

    await expect(
      writeDeploymentMode(client, "Public", "cloud"),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
```

Create `tests/scripts/deployment-mode-marker.db.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import pg from "pg";
import {
  readDeploymentMode,
  writeDeploymentMode,
} from "../../scripts/lib/deployment-mode-marker";

// Same opt-in as backfill-entitlements.db.test.ts: never trust the host of
// DATABASE_URL; CI sets ALLOW_DESTRUCTIVE_DB_TESTS=1 for its throwaway
// Postgres. Everything runs in a transaction that is rolled back.
const databaseUrl = process.env.DATABASE_URL;
const describeDb =
  databaseUrl && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1"
    ? describe
    : describe.skip;
const DB_TEST = { timeout: 30_000 };
const SCHEMA = process.env.DB_SCHEMA || "assettool";
const SETTINGS = `"${SCHEMA}"."system_settings"`;

async function inRolledBackTransaction(
  fn: (client: pg.Client) => Promise<void>,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Hermetic: whatever the database holds, start without a marker.
    await client.query(
      `DELETE FROM ${SETTINGS} WHERE "settingKey" = 'deployment.mode'`,
    );
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

interface MarkerRow {
  id: string;
  settingValue: string;
  settingType: string;
  category: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

async function markerRows(client: pg.Client): Promise<MarkerRow[]> {
  const result = await client.query<MarkerRow>(
    `SELECT "id", "settingValue", "settingType", "category", "isEncrypted",
            "createdAt", "updatedAt"
       FROM ${SETTINGS} WHERE "settingKey" = 'deployment.mode'`,
  );
  return result.rows;
}

describeDb("set-deployment-mode against Postgres", () => {
  it("reports no marker before the first write", DB_TEST, async () => {
    await inRolledBackTransaction(async (client) => {
      await expect(readDeploymentMode(client, SCHEMA)).resolves.toBeNull();
    });
  });

  it("writes the marker and reads it back", DB_TEST, async () => {
    await inRolledBackTransaction(async (client) => {
      await writeDeploymentMode(client, SCHEMA, "cloud");

      await expect(readDeploymentMode(client, SCHEMA)).resolves.toBe("cloud");
      const rows = await markerRows(client);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        settingValue: "cloud",
        settingType: "string",
        category: "deployment",
        isEncrypted: false,
      });
      expect(rows[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  it(
    "is idempotent: a second write keeps one row and its identity",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        await writeDeploymentMode(client, SCHEMA, "cloud");
        const [first] = await markerRows(client);

        await writeDeploymentMode(client, SCHEMA, "cloud");
        const rows = await markerRows(client);

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(first.id);
        expect(rows[0].createdAt).toEqual(first.createdAt);
        expect(rows[0].settingValue).toBe("cloud");
      });
    },
  );

  it(
    "overwrites a stale value and leaves other settings alone",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        await client.query(
          `INSERT INTO ${SETTINGS}
             ("settingKey", "settingValue", "settingType", "category", "updatedAt")
           VALUES ('deployment.mode', 'stale', 'string', 'deployment', now()),
                  ('marker-test.other', 'keep', 'string', 'test', now())`,
        );

        await writeDeploymentMode(client, SCHEMA, "cloud");

        await expect(readDeploymentMode(client, SCHEMA)).resolves.toBe("cloud");
        const other = await client.query(
          `SELECT "settingValue" FROM ${SETTINGS} WHERE "settingKey" = 'marker-test.other'`,
        );
        expect(other.rows).toEqual([{ settingValue: "keep" }]);
      });
    },
  );
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run tests/scripts/deployment-mode-marker.test.ts tests/scripts/deployment-mode-marker.db.test.ts`
Expected: FAIL (`Cannot find module '../../scripts/lib/deployment-mode-marker'`).

- [ ] **Step 9: Write the script**

The library reuses the target guard from phase 1a (`scripts/lib/db-target.ts`) and goes through raw `pg` with an explicit, validated schema, because the generated Prisma client bakes its schema name in at build time. `DEPLOYMENT_MODE_KEY` is imported from the app module so the key has one definition. Create `scripts/lib/deployment-mode-marker.ts`:

```ts
import type pg from "pg";
import { DEPLOYMENT_MODE_KEY } from "@/lib/deployment-marker";
import { qualified } from "./db-target";

/**
 * Raw-SQL access to the deployment marker row of system_settings, for the
 * cut-over script. Like the other database scripts it avoids the generated
 * Prisma client, whose schema name is baked in at build time, and qualifies
 * every table with an explicit, validated schema instead.
 */

/**
 * The marker is only ever armed: the server reads "cloud" and refuses to start
 * without CONTROL_PLANE_SECRET (src/lib/deployment-marker.ts).
 */
export type DeploymentMode = "cloud";

/**
 * Refuses to continue unless --confirm repeats the printed target exactly. The
 * host of DATABASE_URL is never trusted: a marker written to the wrong
 * database makes every deployment that uses it refuse to start.
 */
export function assertConfirmed(
  target: string,
  confirm: string | undefined,
): void {
  if (confirm !== target) {
    throw new Error(
      `--confirm "${target}" is required to write the marker. Check that the target above is the hosted database.`,
    );
  }
}

export async function readDeploymentMode(
  client: pg.ClientBase,
  schema: string,
): Promise<string | null> {
  const result = await client.query<{ settingValue: string | null }>(
    `SELECT "settingValue" FROM ${qualified(schema, "system_settings")}
      WHERE "settingKey" = $1`,
    [DEPLOYMENT_MODE_KEY],
  );
  return result.rows[0]?.settingValue ?? null;
}

/** Writes the marker. Idempotent: a second call changes only updatedAt. */
export async function writeDeploymentMode(
  client: pg.ClientBase,
  schema: string,
  mode: DeploymentMode,
): Promise<void> {
  await client.query(
    `INSERT INTO ${qualified(schema, "system_settings")}
       ("settingKey", "settingValue", "settingType", "category", "description", "updatedAt")
     VALUES ($1, $2, 'string', 'deployment',
             'Fail-closed start-up marker. Written by scripts/set-deployment-mode.ts, never by the app.',
             now() AT TIME ZONE 'UTC')
     ON CONFLICT ("settingKey") DO UPDATE
       SET "settingValue" = EXCLUDED."settingValue",
           "updatedAt" = EXCLUDED."updatedAt"`,
    [DEPLOYMENT_MODE_KEY, mode],
  );
}
```

The CLI prints the target before it connects and refuses to go on unless `--confirm` repeats it. `describeTarget` (phase 1a) throws on a `DATABASE_URL` without an explicit host, port and database, or with a `host`, `hostaddr`, `port`, `dbname` or `service` query parameter, so the printed target is where pg really connects. It fingerprints both the `system_settings` and the `organizations` table (the latter carries the phase 1a columns), so a foreign schema that merely has a `system_settings` table is rejected. Create `scripts/set-deployment-mode.ts`:

```ts
/**
 * Cut-over step of the SaaS boundary (phase 1b): marks a database as belonging
 * to a hosted deployment by writing system_settings "deployment.mode" = "cloud".
 * From then on a server that uses this database without CONTROL_PLANE_SECRET
 * refuses to start (src/lib/deployment-marker.ts).
 *
 * Run it only against the SaaS database, and only after the production
 * environment has CONTROL_PLANE_SECRET, NEW_ORG_ENTITLEMENTS and
 * SUPER_ADMIN_EMAILS: a Preview or any other deployment on the same database
 * without them stops starting. The call is idempotent. To undo it, delete the
 * row by hand.
 *
 * DATABASE_URL must be a postgres:// or postgresql:// URL that names host, port
 * and database explicitly, without host, hostaddr, port, dbname or service query
 * parameters; describeTarget refuses anything else.
 *
 *   bun scripts/set-deployment-mode.ts --schema public
 *   bun scripts/set-deployment-mode.ts --schema public \
 *     --confirm "host:5432/postgres/public"
 *
 * The first call only prints the target and stops. Bun loads .env
 * automatically: check the printed target before confirming it.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import {
  assertColumns,
  describeTarget,
  parseSchemaName,
} from "./lib/db-target";
import {
  assertConfirmed,
  readDeploymentMode,
  writeDeploymentMode,
} from "./lib/deployment-mode-marker";

// A fingerprint of the application's schema: the marker table, and the
// organizations table phase 1a migrated. A foreign database that happens to
// have a system_settings table fails the second check.
const EXPECTED_COLUMNS = {
  system_settings: [
    "settingKey",
    "settingValue",
    "settingType",
    "category",
    "updatedAt",
  ],
  organizations: ["id", "slug", "entitlements", "lockedAt"],
} as const;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      schema: { type: "string" },
      confirm: { type: "string" },
    },
    strict: true,
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const schema = parseSchemaName(values.schema);
  const target = describeTarget(connectionString, schema);
  console.log(`Target: ${target}`);
  assertConfirmed(target, values.confirm);

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
      await assertColumns(client, schema, table, columns);
    }
    const before = await readDeploymentMode(client, schema);
    await writeDeploymentMode(client, schema, "cloud");
    const after = await readDeploymentMode(client, schema);
    await client.query("COMMIT");
    console.log(`deployment.mode: ${before ?? "(unset)"} -> ${after}`);
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

- [ ] **Step 10: Run the tests and the type check**

Run: `npx vitest run tests/scripts/deployment-mode-marker.test.ts tests/scripts/deployment-mode-marker.db.test.ts`
Expected: PASS for the pure test; the DB test is skipped locally and runs in CI.

Run: `npx tsc --noEmit -p .`
Expected: no errors. Do not run the script: Bun loads `.env`, which points at the shared production database.

- [ ] **Step 11: Commit**

```bash
git add scripts/lib/deployment-mode-marker.ts scripts/set-deployment-mode.ts tests/scripts/deployment-mode-marker.test.ts tests/scripts/deployment-mode-marker.db.test.ts
git commit -F - <<'EOF'
feat: add the cut-over script that arms the deployment marker

scripts/set-deployment-mode.ts writes system_settings deployment.mode = cloud. It
needs --schema, prints the target (host, port, database, schema) before it
connects, and refuses to write unless --confirm repeats that target exactly. It
also checks the system_settings and organizations columns, so a foreign schema
is rejected. Run it only against the hosted database, after its deployment has
CONTROL_PLANE_SECRET.
EOF
```
