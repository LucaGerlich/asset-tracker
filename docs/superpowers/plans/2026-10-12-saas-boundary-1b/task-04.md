### Task 4: Control-plane configuration and production preflight

The rules for the new variables live in one pure module that startup validation and a production build preflight share, so a bad hosted configuration fails the build or the boot, never a request. Two commits: the rules and their wiring (Steps 1 to 10), then the preflight and its `vercel.json` hook (Steps 11 to 15). The second one changes how production builds run, so it must be revertable on its own.

**Files:**

- Create: `src/lib/control-plane/config.ts`
- Create: `scripts/preflight-env.ts`
- Modify: `src/lib/env-validation.ts`
- Modify: `src/lib/super-admin.ts`
- Modify: `vercel.json`
- Test: `src/lib/__tests__/control-plane-config.test.ts` (create)
- Test: `src/lib/__tests__/env-validation.test.ts` (extend)
- Test: `src/lib/__tests__/super-admin.test.ts` (extend)
- Test: `tests/scripts/preflight-env.test.ts` (create)

**Interfaces:**

- Consumes: `entitlementsSchema`, `type Entitlements` (`src/lib/entitlements-shared.ts`, phase 1a); `type EnvRecord` (`src/lib/host-routing.ts`); `isCloudMode` (`src/lib/deployment-mode.ts`, Task 2); `stubCloudMode`, `TEST_CONTROL_PLANE_SECRET` (`tests/setup/cloud-mode.ts`, Task 2).
- Produces in `src/lib/control-plane/config.ts` (imports only `entitlements-shared` and the `EnvRecord` type of `host-routing`; no prisma, no logger, no Next, so the preflight can load it):
  - `MIN_SECRET_LENGTH = 32`
  - `parseSuperAdminEmails(raw: string | undefined): string[]` (trimmed, lower-cased, empty entries dropped; the one parser of `SUPER_ADMIN_EMAILS`, which `getSuperAdminEmails` now delegates to)
  - `interface ServiceUrlOptions { originOnly?: boolean }`
  - `validateServiceUrl(name: string, value: string | undefined, env: EnvRecord, options?: ServiceUrlOptions): string | null` (unset or empty gives `null`; must parse; `https:`, or `http:` with host `localhost` or `127.0.0.1` when `env.NODE_ENV !== "production"`; no username, password, query or fragment, a dangling `?` or `#` included; with `originOnly` the path must be `/`)
  - `parseNewOrgEntitlements(env?: EnvRecord): Entitlements` (throws `Error` with a readable message when the variable is missing, not JSON, or fails `entitlementsSchema`; parses on every call)
  - `validateControlPlaneConfig(env?: EnvRecord): string[]`: secret length; previous secret length, previous without current, previous equal to current; with the secret set: `NEW_ORG_ENTITLEMENTS` valid and `SUPER_ADMIN_EMAILS` listing at least one email address; `CONTROL_PLANE_WEBHOOK_URL` via `validateServiceUrl`; `BILLING_URL` via `validateServiceUrl(..., { originOnly: true })`. The two URL rules apply whenever the variable is set, with or without the secret. Messages name the variable and the rule and never contain a value.
- Modifies `validateEnvironment()`: every `validateControlPlaneConfig()` message goes into `errors`, next to the split check. `ENV_CONFIG` gains six entries, all `required: false`, the two secrets `sensitive: true`.
- Modifies `isSuperAdmin`: in cloud mode an empty or blank `SUPER_ADMIN_EMAILS` returns `false` before the organization-count fallback.
- `scripts/preflight-env.ts`: sets `NODE_ENV` to `production` before `await import("@/lib/env-validation")`, runs `validateEnvironment()`, prints every error and exits 1 on any. `vercel.json` `buildCommand` runs it inside the production branch, before `prisma migrate deploy`.

- [ ] **Step 1: Write the failing tests for the pure rules**

The style is `host-routing.test.ts` (`validateSplitConfig`): call the pure function with a plain env object. Create `src/lib/__tests__/control-plane-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MIN_SECRET_LENGTH,
  parseNewOrgEntitlements,
  parseSuperAdminEmails,
  validateControlPlaneConfig,
  validateServiceUrl,
} from "@/lib/control-plane/config";

const SECRET = "c".repeat(48);
const PREVIOUS = "p".repeat(48);
const ENTITLEMENTS = JSON.stringify({
  features: ["api_keys"],
  maxAssets: 100,
  maxUsers: 3,
});

/** A complete, valid cloud configuration. */
const ok = {
  CONTROL_PLANE_SECRET: SECRET,
  NEW_ORG_ENTITLEMENTS: ENTITLEMENTS,
  SUPER_ADMIN_EMAILS: "operator@example.com",
  NODE_ENV: "production",
};

describe("validateServiceUrl", () => {
  const production = { NODE_ENV: "production" };
  const development = { NODE_ENV: "development" };

  it("treats an unset or empty value as fine", () => {
    expect(validateServiceUrl("X_URL", undefined, production)).toBeNull();
    expect(validateServiceUrl("X_URL", "", production)).toBeNull();
  });

  it("accepts an https URL, with or without a path", () => {
    expect(
      validateServiceUrl("X_URL", "https://hooks.example.com", production),
    ).toBeNull();
    expect(
      validateServiceUrl(
        "X_URL",
        "https://hooks.example.com/v1/events",
        production,
      ),
    ).toBeNull();
  });

  it("rejects a value that is not a URL and names the variable", () => {
    expect(validateServiceUrl("X_URL", "not a url", production)).toBe(
      "X_URL must be a valid URL",
    );
  });

  it("rejects http in production, even for localhost", () => {
    expect(
      validateServiceUrl("X_URL", "http://example.com", production),
    ).toMatch(/must use https/);
    expect(
      validateServiceUrl("X_URL", "http://localhost:4000", production),
    ).toMatch(/must use https/);
  });

  it("allows http for localhost and 127.0.0.1 outside production", () => {
    expect(
      validateServiceUrl("X_URL", "http://localhost:4000/hook", development),
    ).toBeNull();
    expect(
      validateServiceUrl("X_URL", "http://127.0.0.1:4000", development),
    ).toBeNull();
    expect(validateServiceUrl("X_URL", "http://localhost", {})).toBeNull();
  });

  it("rejects http for any other host outside production", () => {
    expect(
      validateServiceUrl("X_URL", "http://hooks.example.com", development),
    ).toMatch(/must use https/);
    expect(
      validateServiceUrl("X_URL", "http://localhost.evil.test", development),
    ).toMatch(/must use https/);
  });

  it("rejects other schemes", () => {
    expect(
      validateServiceUrl("X_URL", "ftp://hooks.example.com", development),
    ).toMatch(/must use https/);
    expect(
      validateServiceUrl("X_URL", "javascript:alert(1)", development),
    ).toMatch(/must use https/);
  });

  it("rejects credentials without echoing them", () => {
    const message = validateServiceUrl(
      "X_URL",
      "https://user:hunter2@hooks.example.com",
      production,
    );
    expect(message).toBe("X_URL must not contain credentials");
    expect(message).not.toContain("hunter2");
    expect(
      validateServiceUrl("X_URL", "https://user@hooks.example.com", production),
    ).toMatch(/credentials/);
  });

  it("rejects a query, a fragment and a dangling separator", () => {
    for (const value of [
      "https://hooks.example.com/?token=abc",
      "https://hooks.example.com/#frag",
      "https://hooks.example.com/?",
      "https://hooks.example.com#",
    ]) {
      expect(validateServiceUrl("X_URL", value, production)).toMatch(
        /query or fragment/,
      );
    }
  });

  describe("originOnly", () => {
    it("accepts a bare origin with or without the trailing slash", () => {
      expect(
        validateServiceUrl("B_URL", "https://billing.example.com", production, {
          originOnly: true,
        }),
      ).toBeNull();
      expect(
        validateServiceUrl(
          "B_URL",
          "https://billing.example.com/",
          production,
          { originOnly: true },
        ),
      ).toBeNull();
    });

    it("rejects a path", () => {
      expect(
        validateServiceUrl(
          "B_URL",
          "https://billing.example.com/app",
          production,
          { originOnly: true },
        ),
      ).toBe("B_URL must be a bare origin (no path)");
    });
  });
});

describe("parseNewOrgEntitlements", () => {
  it("returns the parsed entitlements", () => {
    expect(
      parseNewOrgEntitlements({ NEW_ORG_ENTITLEMENTS: ENTITLEMENTS }),
    ).toEqual({ features: ["api_keys"], maxAssets: 100, maxUsers: 3 });
  });

  it("accepts unlimited limits", () => {
    expect(
      parseNewOrgEntitlements({
        NEW_ORG_ENTITLEMENTS:
          '{"features":[],"maxAssets":null,"maxUsers":null}',
      }),
    ).toEqual({ features: [], maxAssets: null, maxUsers: null });
  });

  it("parses on every call and hands out a fresh object", () => {
    const env = { NEW_ORG_ENTITLEMENTS: ENTITLEMENTS };
    expect(parseNewOrgEntitlements(env)).not.toBe(parseNewOrgEntitlements(env));
  });

  it("throws when it is missing or blank", () => {
    expect(() => parseNewOrgEntitlements({})).toThrow(
      "NEW_ORG_ENTITLEMENTS is not set",
    );
    expect(() => parseNewOrgEntitlements({ NEW_ORG_ENTITLEMENTS: "" })).toThrow(
      "NEW_ORG_ENTITLEMENTS is not set",
    );
    expect(() =>
      parseNewOrgEntitlements({ NEW_ORG_ENTITLEMENTS: "   " }),
    ).toThrow("NEW_ORG_ENTITLEMENTS is not set");
  });

  it("throws when it is not JSON", () => {
    expect(() =>
      parseNewOrgEntitlements({ NEW_ORG_ENTITLEMENTS: "{features: []}" }),
    ).toThrow("NEW_ORG_ENTITLEMENTS is not valid JSON");
  });

  it.each([
    [
      "an unknown feature",
      '{"features":["white_label"],"maxAssets":1,"maxUsers":1}',
      /features\.0/,
    ],
    [
      "an unknown key",
      '{"features":[],"maxAssets":1,"maxUsers":1,"plan":"pro"}',
      /NEW_ORG_ENTITLEMENTS is invalid/,
    ],
    [
      "a negative limit",
      '{"features":[],"maxAssets":-1,"maxUsers":1}',
      /maxAssets/,
    ],
    [
      "a fractional limit",
      '{"features":[],"maxAssets":1.5,"maxUsers":1}',
      /maxAssets/,
    ],
    ["a missing limit", '{"features":[]}', /maxAssets/],
    ["JSON null", "null", /\(root\)/],
    ["a JSON array", "[]", /\(root\)/],
  ])("throws for %s", (_label, value, pattern) => {
    expect(() =>
      parseNewOrgEntitlements({ NEW_ORG_ENTITLEMENTS: value }),
    ).toThrow(pattern);
  });
});

describe("parseSuperAdminEmails", () => {
  it("trims, lower-cases and drops empty entries", () => {
    expect(parseSuperAdminEmails(" , A@x.io ,B@Y.io,")).toEqual([
      "a@x.io",
      "b@y.io",
    ]);
  });

  it("returns an empty list for unset and blank values", () => {
    expect(parseSuperAdminEmails(undefined)).toEqual([]);
    expect(parseSuperAdminEmails("  ,  ")).toEqual([]);
  });
});

describe("validateControlPlaneConfig", () => {
  it("accepts a complete cloud configuration", () => {
    expect(validateControlPlaneConfig(ok)).toEqual([]);
  });

  it("accepts a self-hosted environment that sets nothing", () => {
    expect(validateControlPlaneConfig({ NODE_ENV: "production" })).toEqual([]);
  });

  it("does not require entitlements or super-admins without the secret", () => {
    expect(
      validateControlPlaneConfig({
        NODE_ENV: "production",
        SUPER_ADMIN_EMAILS: "",
      }),
    ).toEqual([]);
  });

  describe("secrets", () => {
    it("requires at least 32 characters", () => {
      expect(MIN_SECRET_LENGTH).toBe(32);
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_SECRET: "c".repeat(31),
        }),
      ).toEqual(["CONTROL_PLANE_SECRET must be at least 32 characters long"]);
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_SECRET: "c".repeat(32),
        }),
      ).toEqual([]);
    });

    it("never echoes the secret", () => {
      const errors = validateControlPlaneConfig({
        ...ok,
        CONTROL_PLANE_SECRET: "hunter2",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]).not.toContain("hunter2");
    });

    it("accepts a valid previous secret that differs from the current one", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_SECRET_PREVIOUS: PREVIOUS,
        }),
      ).toEqual([]);
    });

    it("requires 32 characters for the previous secret too", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_SECRET_PREVIOUS: "p".repeat(31),
        }),
      ).toEqual([
        "CONTROL_PLANE_SECRET_PREVIOUS must be at least 32 characters long",
      ]);
    });

    it("rejects a previous secret without a current one", () => {
      expect(
        validateControlPlaneConfig({
          NODE_ENV: "production",
          CONTROL_PLANE_SECRET_PREVIOUS: PREVIOUS,
        }),
      ).toEqual([
        "CONTROL_PLANE_SECRET_PREVIOUS is set but CONTROL_PLANE_SECRET is not",
      ]);
    });

    it("rejects a previous secret equal to the current one", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_SECRET_PREVIOUS: SECRET,
        }),
      ).toEqual([
        "CONTROL_PLANE_SECRET_PREVIOUS must differ from CONTROL_PLANE_SECRET",
      ]);
    });
  });

  describe("with the secret set", () => {
    it("requires NEW_ORG_ENTITLEMENTS", () => {
      expect(
        validateControlPlaneConfig({ ...ok, NEW_ORG_ENTITLEMENTS: undefined }),
      ).toEqual(["NEW_ORG_ENTITLEMENTS is not set"]);
    });

    it("rejects NEW_ORG_ENTITLEMENTS that is not JSON or fails the schema", () => {
      expect(
        validateControlPlaneConfig({ ...ok, NEW_ORG_ENTITLEMENTS: "nope" }),
      ).toEqual(["NEW_ORG_ENTITLEMENTS is not valid JSON"]);
      expect(
        validateControlPlaneConfig({
          ...ok,
          NEW_ORG_ENTITLEMENTS: '{"features":["white_label"]}',
        })[0],
      ).toMatch(/^NEW_ORG_ENTITLEMENTS is invalid/);
    });

    it("requires at least one super-admin address", () => {
      const expected = [
        "SUPER_ADMIN_EMAILS must list at least one email address when CONTROL_PLANE_SECRET is set",
      ];
      expect(
        validateControlPlaneConfig({ ...ok, SUPER_ADMIN_EMAILS: undefined }),
      ).toEqual(expected);
      expect(
        validateControlPlaneConfig({ ...ok, SUPER_ADMIN_EMAILS: " , " }),
      ).toEqual(expected);
    });

    it("does not count an entry that is not an email address", () => {
      expect(
        validateControlPlaneConfig({ ...ok, SUPER_ADMIN_EMAILS: "admin" }),
      ).toHaveLength(1);
      expect(
        validateControlPlaneConfig({
          ...ok,
          SUPER_ADMIN_EMAILS: "admin, Operator@Example.com ",
        }),
      ).toEqual([]);
    });
  });

  describe("service URLs", () => {
    it("accepts a valid webhook URL and billing origin", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_WEBHOOK_URL: "https://cp.example.com/events",
          BILLING_URL: "https://billing.example.com",
        }),
      ).toEqual([]);
    });

    it("rejects an http webhook URL in production", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_WEBHOOK_URL: "http://cp.example.com/events",
        }),
      ).toEqual([
        "CONTROL_PLANE_WEBHOOK_URL must use https (http is allowed only for localhost outside production)",
      ]);
    });

    it("allows an http localhost webhook URL outside production", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          NODE_ENV: "development",
          CONTROL_PLANE_WEBHOOK_URL: "http://localhost:4000/events",
        }),
      ).toEqual([]);
    });

    it("rejects a billing URL with a path", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          BILLING_URL: "https://billing.example.com/portal",
        }),
      ).toEqual(["BILLING_URL must be a bare origin (no path)"]);
    });

    it("rejects credentials and queries in either URL", () => {
      expect(
        validateControlPlaneConfig({
          ...ok,
          CONTROL_PLANE_WEBHOOK_URL: "https://u:p@cp.example.com",
          BILLING_URL: "https://billing.example.com/?x=1",
        }),
      ).toEqual([
        "CONTROL_PLANE_WEBHOOK_URL must not contain credentials",
        "BILLING_URL must not contain a query or fragment",
      ]);
    });
  });

  it("reports every problem at once", () => {
    const errors = validateControlPlaneConfig({
      NODE_ENV: "production",
      CONTROL_PLANE_SECRET: "short",
      CONTROL_PLANE_SECRET_PREVIOUS: "tiny",
      BILLING_URL: "ftp://billing.example.com",
    });
    expect(errors).toEqual([
      "CONTROL_PLANE_SECRET must be at least 32 characters long",
      "CONTROL_PLANE_SECRET_PREVIOUS must be at least 32 characters long",
      "NEW_ORG_ENTITLEMENTS is not set",
      "SUPER_ADMIN_EMAILS must list at least one email address when CONTROL_PLANE_SECRET is set",
      "BILLING_URL must use https (http is allowed only for localhost outside production)",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/control-plane-config.test.ts`
Expected: FAIL (`Cannot find package '@/lib/control-plane/config'`).

- [ ] **Step 3: Write the rules**

Create `src/lib/control-plane/config.ts`. It is pure (no I/O), and every message names the variable and the rule, never a value:

```ts
import {
  entitlementsSchema,
  type Entitlements,
} from "@/lib/entitlements-shared";
import type { EnvRecord } from "@/lib/host-routing";

/**
 * Control-plane configuration rules (SaaS boundary spec, section 6).
 *
 * Pure and free of database, logger and Next.js imports, so the startup
 * validation (env-validation.ts) and the production build preflight
 * (scripts/preflight-env.ts) share exactly one rule set. Messages name the
 * variable and the rule, never the value: secrets must not reach build logs.
 */

/** Minimum length of CONTROL_PLANE_SECRET and CONTROL_PLANE_SECRET_PREVIOUS. */
export const MIN_SECRET_LENGTH = 32;

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/**
 * Parse SUPER_ADMIN_EMAILS: trimmed, lower-cased, empty entries dropped. The
 * single parser for the variable, shared with src/lib/super-admin.ts.
 */
export function parseSuperAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export interface ServiceUrlOptions {
  /** The URL must be a bare origin: the path has to be "/". */
  originOnly?: boolean;
}

/**
 * Validates a URL the core talks to or links to (the control plane's event
 * receiver, the billing service). Returns one message, or null when the value
 * is unset or acceptable. Rules: https, or http for localhost and 127.0.0.1
 * outside production; no credentials; no query or fragment; with `originOnly`
 * no path.
 */
export function validateServiceUrl(
  name: string,
  value: string | undefined,
  env: EnvRecord,
  options: ServiceUrlOptions = {},
): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${name} must be a valid URL`;
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    LOCAL_HOSTS.has(url.hostname) &&
    env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !isLocalHttp) {
    return `${name} must use https (http is allowed only for localhost outside production)`;
  }
  if (url.username || url.password) {
    return `${name} must not contain credentials`;
  }
  // new URL() drops an empty "?" or "#", so check the raw value as well.
  if (/[?#]/.test(value)) {
    return `${name} must not contain a query or fragment`;
  }
  if (options.originOnly && url.pathname !== "/") {
    return `${name} must be a bare origin (no path)`;
  }
  return null;
}

/**
 * The entitlements every new organization starts with in cloud mode. Parsed
 * from the environment on every call (never cached), so a bad value can only
 * surface as this error. Startup validation rejects such a value first.
 */
export function parseNewOrgEntitlements(
  env: EnvRecord = process.env,
): Entitlements {
  const raw = env.NEW_ORG_ENTITLEMENTS;
  if (!raw || raw.trim() === "") {
    throw new Error("NEW_ORG_ENTITLEMENTS is not set");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("NEW_ORG_ENTITLEMENTS is not valid JSON");
  }

  const result = entitlementsSchema.safeParse(json);
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`NEW_ORG_ENTITLEMENTS is invalid (${details})`);
  }
  return result.data;
}

/**
 * Every configuration problem of the control-plane variables, as messages.
 * Empty when the configuration is fine. A deployment that sets none of the
 * variables (every self-hosted install) always passes.
 */
export function validateControlPlaneConfig(
  env: EnvRecord = process.env,
): string[] {
  const errors: string[] = [];
  const secret = env.CONTROL_PLANE_SECRET;
  const previous = env.CONTROL_PLANE_SECRET_PREVIOUS;

  if (secret && secret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `CONTROL_PLANE_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }
  if (previous) {
    if (previous.length < MIN_SECRET_LENGTH) {
      errors.push(
        `CONTROL_PLANE_SECRET_PREVIOUS must be at least ${MIN_SECRET_LENGTH} characters long`,
      );
    }
    if (!secret) {
      errors.push(
        "CONTROL_PLANE_SECRET_PREVIOUS is set but CONTROL_PLANE_SECRET is not",
      );
    } else if (previous === secret) {
      errors.push(
        "CONTROL_PLANE_SECRET_PREVIOUS must differ from CONTROL_PLANE_SECRET",
      );
    }
  }

  // The secret switches the deployment to cloud mode: these two are then
  // mandatory, because cloud mode has no sensible default for either.
  if (secret) {
    try {
      parseNewOrgEntitlements(env);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "NEW_ORG_ENTITLEMENTS is invalid",
      );
    }
    const hasSuperAdmin = parseSuperAdminEmails(env.SUPER_ADMIN_EMAILS).some(
      (address) => EMAIL_ADDRESS.test(address),
    );
    if (!hasSuperAdmin) {
      errors.push(
        "SUPER_ADMIN_EMAILS must list at least one email address when CONTROL_PLANE_SECRET is set",
      );
    }
  }

  const webhookError = validateServiceUrl(
    "CONTROL_PLANE_WEBHOOK_URL",
    env.CONTROL_PLANE_WEBHOOK_URL,
    env,
  );
  if (webhookError) errors.push(webhookError);

  const billingError = validateServiceUrl("BILLING_URL", env.BILLING_URL, env, {
    originOnly: true,
  });
  if (billingError) errors.push(billingError);

  return errors;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/control-plane-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing wiring tests**

In `src/lib/__tests__/env-validation.test.ts`, add `ENV_CONFIG` to the existing import and a second import for the cloud-mode helpers (if Task 2 already imports from `tests/setup/cloud-mode` here, extend that import instead of adding a second one):

```ts
import {
  ENV_CONFIG,
  validateEnvironment,
  getEnvVar,
  getOptionalEnvVar,
  getBoolEnvVar,
  getIntEnvVar,
} from "@/lib/env-validation";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";
```

and append this block at the end of the file, after the existing `describe("domain split config", ...)`:

```ts
describe("control plane config", () => {
  const CONTROL_PLANE_VARIABLES = [
    "CONTROL_PLANE_SECRET",
    "CONTROL_PLANE_SECRET_PREVIOUS",
    "NEW_ORG_ENTITLEMENTS",
    "SUPER_ADMIN_EMAILS",
    "CONTROL_PLANE_WEBHOOK_URL",
    "BILLING_URL",
  ];

  /** Errors about any control-plane variable (the base variables stay out of it). */
  function controlPlaneErrors(errors: string[]): string[] {
    return errors.filter((error) =>
      CONTROL_PLANE_VARIABLES.some((name) => error.includes(name)),
    );
  }

  beforeEach(() => {
    for (const name of CONTROL_PLANE_VARIABLES) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(() => vi.unstubAllEnvs());

  it("raises no control-plane error for a deployment that sets none", () => {
    expect(controlPlaneErrors(validateEnvironment().errors)).toEqual([]);
  });

  it("raises no control-plane error for a complete cloud configuration", () => {
    stubCloudMode();

    expect(controlPlaneErrors(validateEnvironment().errors)).toEqual([]);
  });

  it("reports a too-short control plane secret as an error", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "too-short");

    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "CONTROL_PLANE_SECRET must be at least 32 characters long",
    );
  });

  it("reports missing cloud variables as errors", () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", TEST_CONTROL_PLANE_SECRET);

    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("NEW_ORG_ENTITLEMENTS is not set");
    expect(
      result.errors.some((error) => error.startsWith("SUPER_ADMIN_EMAILS")),
    ).toBe(true);
  });

  it("reports an invalid billing URL as an error", () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com/portal");

    expect(validateEnvironment().errors).toContain(
      "BILLING_URL must be a bare origin (no path)",
    );
  });

  it("masks the control plane secrets in the result", () => {
    stubCloudMode();
    vi.stubEnv("CONTROL_PLANE_SECRET_PREVIOUS", "p".repeat(48));

    const { variables } = validateEnvironment();

    for (const name of [
      "CONTROL_PLANE_SECRET",
      "CONTROL_PLANE_SECRET_PREVIOUS",
    ]) {
      expect(variables[name].masked).toBe(true);
      expect(variables[name].value).toContain("****");
    }
    expect(variables["CONTROL_PLANE_SECRET"].value).not.toBe(
      TEST_CONTROL_PLANE_SECRET,
    );
  });

  it("documents every control plane variable and never requires one", () => {
    const entries = ENV_CONFIG.filter((config) =>
      CONTROL_PLANE_VARIABLES.includes(config.name),
    );

    expect(entries.map((config) => config.name).sort()).toEqual(
      [...CONTROL_PLANE_VARIABLES].sort(),
    );
    expect(entries.every((config) => !config.required)).toBe(true);
  });
});
```

In `src/lib/__tests__/super-admin.test.ts`, add the import below next to the existing `@/lib/super-admin` import:

```ts
import { TEST_CONTROL_PLANE_SECRET } from "../../../tests/setup/cloud-mode";
```

and append at the end of the file:

```ts
describe("isSuperAdmin in cloud mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    vi.stubEnv("CONTROL_PLANE_SECRET", TEST_CONTROL_PLANE_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("denies when SUPER_ADMIN_EMAILS is unset, even for a single organization", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAILS", undefined);
    mockPrisma.organization.count.mockResolvedValue(1);

    await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
      false,
    );
    expect(mockPrisma.organization.count).not.toHaveBeenCalled();
  });

  it("denies when the platform has no organization yet", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAILS", undefined);
    mockPrisma.organization.count.mockResolvedValue(0);

    await expect(isSuperAdmin({ id: "u1", email: null })).resolves.toBe(false);
  });

  it("treats a blank list like an unset one", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAILS", " , ");
    mockPrisma.organization.count.mockResolvedValue(1);

    await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
      false,
    );
  });

  it("still allows a listed address held by exactly one user", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAILS", "Operator@Example.com");
    holders(1);

    await expect(
      isSuperAdmin({ id: "u1", email: "operator@example.com" }),
    ).resolves.toBe(true);
  });

  it("still denies an address that is not listed", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAILS", "operator@example.com");
    holders(1);

    await expect(isSuperAdmin({ id: "u1", email: "other@x.io" })).resolves.toBe(
      false,
    );
  });
});

describe("isSuperAdmin outside cloud mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONTROL_PLANE_SECRET", undefined);
    vi.stubEnv("SUPER_ADMIN_EMAILS", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the single-organization fallback", async () => {
    mockPrisma.organization.count.mockResolvedValue(1);

    await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
      true,
    );
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/env-validation.test.ts src/lib/__tests__/super-admin.test.ts`
Expected: FAIL. In `env-validation.test.ts`: "reports a too-short control plane secret as an error", "reports missing cloud variables as errors", "reports an invalid billing URL as an error", "masks the control plane secrets in the result" and "documents every control plane variable and never requires one". In `super-admin.test.ts`: the cloud-mode cases "denies when SUPER_ADMIN_EMAILS is unset, even for a single organization", "denies when the platform has no organization yet" and "treats a blank list like an unset one".

- [ ] **Step 7: Wire the rules into `validateEnvironment()`**

In `src/lib/env-validation.ts`, import the validator next to the split check's import. Before:

```ts
import { validateSplitConfig } from "@/lib/host-routing";
```

After:

```ts
import { validateControlPlaneConfig } from "@/lib/control-plane/config";
import { validateSplitConfig } from "@/lib/host-routing";
```

Add the six variables at the end of `ENV_CONFIG`. They are documentation and masking only: a `validate` on an optional variable would only produce a warning, and `required` is a static flag fixed at import, so the real (fatal, conditional) rules stay in `validateControlPlaneConfig()`. Before (the end of the Stripe entries, whatever Task 2 left in them, and the start of the next interface):

```ts
    sensitive: true,
  },
];

interface ValidationResult {
```

After:

```ts
    sensitive: true,
  },

  // Control plane (SaaS operator only). Self-hosters set none of these. The
  // cross-field rules live in validateControlPlaneConfig(); a per-variable
  // validate() on an optional variable would only produce a warning.
  {
    name: "CONTROL_PLANE_SECRET",
    required: false,
    description:
      "SaaS only: shared secret (32+ characters) of the control plane. Setting it switches the deployment to cloud mode",
    sensitive: true,
  },
  {
    name: "CONTROL_PLANE_SECRET_PREVIOUS",
    required: false,
    description:
      "SaaS only: previous control plane secret, still accepted during a rotation",
    sensitive: true,
  },
  {
    name: "NEW_ORG_ENTITLEMENTS",
    required: false,
    description:
      'SaaS only, required in cloud mode: JSON entitlements of new organizations, e.g. {"features":[],"maxAssets":100,"maxUsers":3}',
  },
  {
    name: "SUPER_ADMIN_EMAILS",
    required: false,
    description:
      "Comma-separated platform super-admin emails (required in cloud mode)",
  },
  {
    name: "CONTROL_PLANE_WEBHOOK_URL",
    required: false,
    description:
      "SaaS only: receiver of org.created events (https, no credentials or query)",
  },
  {
    name: "BILLING_URL",
    required: false,
    description:
      "SaaS only: origin of the billing service behind Manage billing (https, bare origin)",
  },
];

interface ValidationResult {
```

Push the messages. Before:

```ts
const splitError = validateSplitConfig();
if (splitError) errors.push(splitError);
```

After:

```ts
const splitError = validateSplitConfig();
if (splitError) errors.push(splitError);

errors.push(...validateControlPlaneConfig());
```

- [ ] **Step 8: Make `isSuperAdmin` fail closed in cloud mode**

In `src/lib/super-admin.ts`, replace the imports. Before:

```ts
import prisma from "./prisma";
import { countUsersByEmail } from "./user-email-query";
```

After:

```ts
import { parseSuperAdminEmails } from "./control-plane/config";
import { isCloudMode } from "./deployment-mode";
import prisma from "./prisma";
import { countUsersByEmail } from "./user-email-query";
```

Delegate the parser. Before:

```ts
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}
```

After:

```ts
export function getSuperAdminEmails(): string[] {
  return parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
}
```

Document the rule. Before (in the `isSuperAdmin` doc comment):

```ts
 * - SUPER_ADMIN_EMAILS unset: only while the platform has at most one
 *   organization (a self-hosted single-tenant install). Creating a second
 *   organization closes this, so admins of a tenant never become platform
 *   admins by default.
```

After:

```ts
 * - SUPER_ADMIN_EMAILS unset, cloud mode: nobody. A hosted platform has many
 *   tenants, so no admin may become a platform admin by default, not even
 *   while there is a single organization. Startup validation requires the
 *   variable in cloud mode; this is the second line of defence.
 * - SUPER_ADMIN_EMAILS unset, self-hosted: only while the platform has at
 *   most one organization (a self-hosted single-tenant install). Creating a
 *   second organization closes this, so admins of a tenant never become
 *   platform admins by default.
```

Enforce it. Before:

```ts
if (listed.length === 0) {
  return (await prisma.organization.count()) <= 1;
}
```

After:

```ts
if (listed.length === 0) {
  if (isCloudMode()) return false;
  return (await prisma.organization.count()) <= 1;
}
```

- [ ] **Step 9: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/lib/__tests__/control-plane-config.test.ts src/lib/__tests__/env-validation.test.ts src/lib/__tests__/super-admin.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/control-plane/config.ts src/lib/env-validation.ts src/lib/super-admin.ts src/lib/__tests__/control-plane-config.test.ts src/lib/__tests__/env-validation.test.ts src/lib/__tests__/super-admin.test.ts`
Expected: no output.

Run: `npx vitest run` (`env-validation` and `super-admin` are shared modules)
Expected: PASS (DB tests skipped locally).

- [ ] **Step 10: Commit**

```bash
git add src/lib/control-plane/config.ts src/lib/env-validation.ts src/lib/super-admin.ts src/lib/__tests__/control-plane-config.test.ts src/lib/__tests__/env-validation.test.ts src/lib/__tests__/super-admin.test.ts
git commit -F - <<'EOF'
feat: validate the control-plane configuration at startup

A pure module holds the rules for the control-plane variables: secret length and
rotation, NEW_ORG_ENTITLEMENTS, SUPER_ADMIN_EMAILS and the https-only service
URLs. validateEnvironment reports every violation, so a bad hosted configuration
refuses to start in production.

In cloud mode an empty SUPER_ADMIN_EMAILS now denies every admin instead of
falling back to the single-organization rule.
EOF
```

- [ ] **Step 11: Write the failing preflight tests**

`scripts/preflight-env.ts` runs `main()` when it is imported. These tests import it with its only dependency, the environment validation, replaced by a stub, so the script reads no real environment and no database. It must never be run from a shell as part of this plan: Bun would load the local `.env`. Create `tests/scripts/preflight-env.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

/**
 * scripts/preflight-env.ts runs main() when it is imported. These tests import
 * it with its only dependency, the environment validation, replaced by a stub:
 * the script reads no database and no real environment this way. It must never
 * be run from a shell here, where Bun would load the local .env.
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (relative: string): string =>
  readFileSync(path.join(ROOT, relative), "utf8");

const state = vi.hoisted(() => ({
  /** NODE_ENV at the moment the stubbed validation module was loaded. */
  nodeEnvAtImport: undefined as string | undefined,
  errors: [] as string[],
  warnings: [] as string[],
  failure: undefined as Error | undefined,
}));

vi.mock("@/lib/env-validation", () => {
  state.nodeEnvAtImport = process.env.NODE_ENV;
  return {
    validateEnvironment: () => {
      if (state.failure) throw state.failure;
      return {
        valid: state.errors.length === 0,
        errors: state.errors,
        warnings: state.warnings,
        variables: {},
      };
    },
  };
});

/** Imports the script and waits until it has reported its outcome. */
async function runPreflight(): Promise<void> {
  vi.resetModules();
  await import("../../scripts/preflight-env");
  await vi.waitFor(() => {
    const finished =
      vi.mocked(process.exit).mock.calls.length > 0 ||
      vi.mocked(console.log).mock.calls.length > 0;
    expect(finished).toBe(true);
  });
}

beforeEach(() => {
  state.nodeEnvAtImport = undefined;
  state.errors = [];
  state.warnings = [];
  state.failure = undefined;
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("scripts/preflight-env.ts", () => {
  it("forces production before the validation module is loaded", async () => {
    await runPreflight();

    expect(state.nodeEnvAtImport).toBe("production");
  });

  it("passes without exiting when the environment is valid", async () => {
    await runPreflight();

    expect(console.log).toHaveBeenCalledWith("Environment preflight passed.");
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("prints every error and exits 1 when the environment is invalid", async () => {
    state.errors = [
      "Missing required environment variable: CRON_SECRET",
      "BILLING_URL must be a bare origin (no path)",
    ];

    await runPreflight();

    expect(console.error).toHaveBeenCalledWith("Environment preflight failed:");
    expect(console.error).toHaveBeenCalledWith(
      "  - Missing required environment variable: CRON_SECRET",
    );
    expect(console.error).toHaveBeenCalledWith(
      "  - BILLING_URL must be a bare origin (no path)",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.log).not.toHaveBeenCalled();
  });

  it("prints warnings without failing", async () => {
    state.warnings = ["Invalid value for EMAIL_FROM: Must be a valid email"];

    await runPreflight();

    expect(console.warn).toHaveBeenCalledWith(
      "warning: Invalid value for EMAIL_FROM: Must be a valid email",
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("exits 1 when the validation itself throws", async () => {
    state.failure = new Error("boom");

    await runPreflight();

    expect(console.error).toHaveBeenCalledWith("boom");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("imports the validation module only dynamically and opens no database", () => {
    // A static import is hoisted above the NODE_ENV assignment, and ENV_CONFIG
    // fixes ENCRYPTION_KEY.required when the module is evaluated.
    const source = read("scripts/preflight-env.ts");

    expect(source).not.toMatch(/^import[^\n]*env-validation/m);
    expect(source).not.toMatch(/@\/lib\/prisma|@prisma\/client|from "pg"/);
  });
});

describe("validation under a forced production NODE_ENV", () => {
  it("enforces the production-only rules the preflight relies on", async () => {
    vi.doUnmock("@/lib/env-validation");
    vi.resetModules();
    // What the script does: set NODE_ENV first, then import the module fresh.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENCRYPTION_KEY", undefined);
    vi.stubEnv("BILLING_URL", "http://localhost:3000");

    const { validateEnvironment } = await import("@/lib/env-validation");
    const { errors } = validateEnvironment();

    expect(errors.some((error) => error.includes("ENCRYPTION_KEY"))).toBe(true);
    expect(errors).toContain(
      "BILLING_URL must use https (http is allowed only for localhost outside production)",
    );
  });
});

describe("build wiring", () => {
  it("vercel.json runs the preflight in the production branch, before migrating", () => {
    const { buildCommand } = JSON.parse(read("vercel.json")) as {
      buildCommand: string;
    };

    expect(buildCommand).toContain(
      '[ "$VERCEL_ENV" = "production" ]; then bun scripts/preflight-env.ts && prisma migrate deploy; fi',
    );
    expect(buildCommand.indexOf("preflight-env")).toBeLessThan(
      buildCommand.indexOf("prisma migrate deploy"),
    );
  });

  it("package.json build does not run the preflight", () => {
    // CI and the Docker builder build without production secrets.
    const { scripts } = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(scripts.build).not.toContain("preflight");
  });
});
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `npx vitest run tests/scripts/preflight-env.test.ts`
Expected: FAIL (seven tests: `Cannot find module '/scripts/preflight-env'` for the five that import the script, `ENOENT` for the static source check, and the `vercel.json` assertion).

- [ ] **Step 13: Write the preflight and hook it into the production build**

Create `scripts/preflight-env.ts`:

```ts
/**
 * Production build preflight (SaaS boundary spec, section 6).
 *
 * Runs the same environment validation as server start-up, so a bad production
 * environment fails the build and never reaches the live site. vercel.json runs
 * it inside the production branch, before `prisma migrate deploy`:
 *
 *   bun scripts/preflight-env.ts
 *
 * It reads no database and writes nothing. Do not add it to the package.json
 * build script: CI and the Docker builder build without production secrets.
 *
 * NODE_ENV is forced to "production" before env-validation is imported.
 * ENV_CONFIG fixes ENCRYPTION_KEY.required when the module is evaluated, and
 * the https rules of the URL checks depend on it. Static imports are hoisted
 * above every statement, so the module has to be imported dynamically.
 * (Object.assign because Next's types declare NODE_ENV readonly.)
 */

async function main(): Promise<void> {
  Object.assign(process.env, { NODE_ENV: "production" });
  const { validateEnvironment } = await import("@/lib/env-validation");

  const { errors, warnings } = validateEnvironment();
  for (const warning of warnings) console.warn(`warning: ${warning}`);

  if (errors.length === 0) {
    console.log("Environment preflight passed.");
    return;
  }
  console.error("Environment preflight failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
```

In `vercel.json`, run it inside the production branch, before the migration. It must not go into the `package.json` build script: CI (`.github/workflows/ci.yml`) and the Docker builder build without `CRON_SECRET`, `ENCRYPTION_KEY` or a database. Before:

```json
  "buildCommand": "node prisma/set-schema.mjs && prisma generate && if [ \"$VERCEL_ENV\" = \"production\" ]; then prisma migrate deploy; fi && next build",
```

After:

```json
  "buildCommand": "node prisma/set-schema.mjs && prisma generate && if [ \"$VERCEL_ENV\" = \"production\" ]; then bun scripts/preflight-env.ts && prisma migrate deploy; fi && next build",
```

- [ ] **Step 14: Run the tests and the type check**

Run: `npx vitest run tests/scripts/preflight-env.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors. Do not run the script itself.

- [ ] **Step 15: Commit**

```bash
git add scripts/preflight-env.ts vercel.json tests/scripts/preflight-env.test.ts
git commit -F - <<'EOF'
feat: run the environment validation as a production build preflight

scripts/preflight-env.ts forces NODE_ENV=production, runs the same
validateEnvironment as server start, prints every error and exits 1. vercel.json
runs it in the production branch before prisma migrate deploy, so a bad
environment fails the build and not the live site.
EOF
```
