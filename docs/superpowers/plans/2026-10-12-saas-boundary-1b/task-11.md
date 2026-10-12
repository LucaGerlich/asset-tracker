### Task 11: Limits in SCIM, SSO and the identity syncs

Task 10 moved the route creators to the capacity guards. This task covers the creators that cannot use the throwing guards or have no limit at all today:

- **SCIM** creates users on a bearer token and answers in SCIM error format. Task 10 already passes the token's organization (the old call fell back to a session that SCIM never has). Here the denial becomes a SCIM 403, and reactivating a user through PUT or PATCH takes a seat like creating one, because only active users count.
- **SSO provisioning hook** (BetterAuth OAuth sign-up) keeps its own inline count of all users and reads the legacy `maxUsers` column. It switches to `checkUserLimit`.
- **OIDC and SAML callbacks** create users without an organization. In cloud mode they now refuse instead.
- **LDAP and Intune syncs** create users and assets with no check at all, and their crons pass no organization. In cloud mode without an organization they create nothing; with one they read the free room once and count down. Both skip and log rather than fail the run.

The task has two commits: part A (SCIM, the hook, the callbacks) and part B (the syncs).

**Files:**

- Modify: `src/app/api/scim/v2/Users/route.ts`, `src/app/api/scim/v2/Users/[id]/route.ts`, `src/lib/sso-provisioning.ts`, `src/app/api/auth/callback/oidc/route.ts`, `src/app/api/auth/callback/saml/route.ts`, `src/lib/ldap.ts`, `src/lib/integrations/intune.ts`
- Test: `src/app/api/__tests__/scim-users.test.ts` (extend), `src/lib/__tests__/sso-provisioning.test.ts` (rewrite), `src/lib/__tests__/ldap-sync-email.test.ts` (extend)
- Test: `src/app/api/__tests__/sso-callbacks-cloud.test.ts` (create), `src/lib/integrations/__tests__/intune-sync-limits.test.ts` (create)

**Interfaces:**

- Consumes: `checkUserLimit` and `remainingCapacity` (`src/lib/tenant-limits.ts`, Task 10); `isCloudMode` (Task 2); `stubCloudMode` (`tests/setup/cloud-mode.ts`, Task 2).
- Does not consume `requireUserCapacity` or `LimitError`. `route-conventions.test.ts` requires `apiErrorResponse(` in every route file that calls a throwing guard, and SCIM answers in SCIM format instead, so the SCIM routes use the non-throwing `checkUserLimit` and map the denial themselves.
- Produces:
  - SCIM POST, PUT and PATCH answer `403` with `Content-Type: application/scim+json` and `detail: "The organization has reached its user limit"` when the seat is not free. POST checks only when the user is created active; PUT and PATCH check only when an inactive user is set to `active: true`. An IdP that syncs an already-active user is never blocked at the limit.
  - OIDC and SAML callbacks in cloud mode redirect an unknown user to `/login?error=organization_required` and create nothing. Existing users still sign in.
  - `syncUsers(organizationId?, triggeredBy)` (LDAP): in cloud mode without an organization it creates and reactivates nothing; with one it reads `remainingCapacity(organizationId, "users")` once and counts down per creation or reactivation. A skipped entry adds `Entry <dn>: user limit reached` (or `organization required`) to `errors` and logs a warning. Updating an active user takes no seat.
  - `syncIntuneDevices(organizationId, triggeredBy)`: the same for asset creation, counted in `skipped` with a warning per device. Updating known devices is unaffected.

## Part A: SCIM, the SSO hook and the callbacks

- [ ] **Step 1: Write the failing tests**

`src/app/api/__tests__/scim-users.test.ts` runs the SCIM routes against a mocked `authenticateScim`. Mock the limit module so the cases can set the outcome. Apply these edits:

Replace:

```ts
vi.mock("@/lib/logger");
```

with:

```ts
vi.mock("@/lib/logger");
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 0, max: null }),
}));
```

Replace:

```ts
import prisma from "@/lib/prisma";
```

with:

```ts
import prisma from "@/lib/prisma";
import { checkUserLimit } from "@/lib/tenant-limits";
```

then append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// User limit (creating and reactivating take a seat)
// ---------------------------------------------------------------------------
describe("SCIM user limit", () => {
  const mockCheckUserLimit = vi.mocked(checkUserLimit);
  const usersUrl = "http://localhost:3000/api/scim/v2/Users";
  const userUrl = `${usersUrl}/user-001`;
  const params = { params: Promise.resolve({ id: "user-001" }) };
  const inactiveUser = { ...mockUser, isActive: false };
  const full = { allowed: false, current: 3, max: 3 };

  beforeEach(() => {
    mockCheckUserLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      max: null,
    });
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockUser as any);
    mockPrisma.user.update.mockResolvedValue(mockUser as any);
  });

  describe("POST", () => {
    const create = (body: Record<string, unknown>) =>
      createUser(createMockRequest(usersUrl, { method: "POST", body }));

    it("checks the seats of the token's organization, not the session's", async () => {
      const res = await create({ userName: "new" });

      expect(res.status).toBe(201);
      expect(mockCheckUserLimit).toHaveBeenCalledWith("org-uuid-001");
    });

    it("answers a SCIM 403 without a plan or price and creates nothing when the organization is full", async () => {
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await create({ userName: "new" });
      const { status, body } = await parseResponse<any>(res);

      expect(status).toBe(403);
      expect(res.headers.get("content-type")).toBe("application/scim+json");
      expect(body).toEqual({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "The organization has reached its user limit",
        status: 403,
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("takes no seat for a user that is created inactive", async () => {
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await create({ userName: "new", active: false });

      expect(res.status).toBe(201);
      expect(mockCheckUserLimit).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    const replace = (body: Record<string, unknown>) =>
      replaceUser(createMockRequest(userUrl, { method: "PUT", body }), params);

    it("refuses to reactivate a user when the organization is full", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await replace({ userName: "jdoe", active: true });
      const { status, body } = await parseResponse<any>(res);

      expect(status).toBe(403);
      expect(body.detail).toBe("The organization has reached its user limit");
      expect(mockCheckUserLimit).toHaveBeenCalledWith("org-uuid-001");
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("reactivates a user while a seat is free", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);

      const res = await replace({ userName: "jdoe", active: true });

      expect(res.status).toBe(200);
      expect(mockCheckUserLimit).toHaveBeenCalledWith("org-uuid-001");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it("never blocks an IdP sync that leaves an active user active", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser as any);
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await replace({ userName: "jdoe", active: true });

      expect(res.status).toBe(200);
      expect(mockCheckUserLimit).not.toHaveBeenCalled();
    });

    it("never blocks a deactivation", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser as any);
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await replace({ userName: "jdoe", active: false });

      expect(res.status).toBe(200);
      expect(mockCheckUserLimit).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    const patch = (operations: Array<Record<string, unknown>>) =>
      patchUser(
        createMockRequest(userUrl, {
          method: "PATCH",
          body: { Operations: operations },
        }),
        params,
      );

    it("refuses to reactivate a user through a path operation when the organization is full", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await patch([{ op: "replace", path: "active", value: true }]);
      const { status, body } = await parseResponse<any>(res);

      expect(status).toBe(403);
      expect(body.detail).toBe("The organization has reached its user limit");
      expect(mockCheckUserLimit).toHaveBeenCalledWith("org-uuid-001");
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses to reactivate a user through a value object when the organization is full", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);
      mockCheckUserLimit.mockResolvedValue(full);

      const res = await patch([{ op: "replace", value: { active: true } }]);

      expect(res.status).toBe(403);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("reactivates a user while a seat is free", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);

      const res = await patch([{ op: "replace", path: "active", value: true }]);

      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it("does not check seats for an active user or a deactivation", async () => {
      mockCheckUserLimit.mockResolvedValue(full);
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser as any);
      await patch([{ op: "replace", path: "active", value: true }]);
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser as any);
      await patch([{ op: "replace", path: "active", value: false }]);
      mockPrisma.user.findFirst.mockResolvedValueOnce(inactiveUser as any);
      await patch([{ op: "replace", path: "username", value: "renamed" }]);

      expect(mockCheckUserLimit).not.toHaveBeenCalled();
    });
  });
});
```

Replace the whole of `src/lib/__tests__/sso-provisioning.test.ts`. The quota cases move to `tenant-limits.test.ts`; this file now checks that the hook asks for the configured organization's seats and refuses when there are none:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn(),
}));

import { resolveSsoUserData } from "../sso-provisioning";
import prisma from "@/lib/prisma";
import { checkUserLimit } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);
const mockCheckUserLimit = vi.mocked(checkUserLimit);
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const ssoUser = { email: "jane@fitseveneleven.de", name: "Jane" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SSO_DEFAULT_ORGANIZATION_ID", ORG_ID);
  vi.stubEnv("MICROSOFT_TENANT_ID", TENANT_ID);
  mockPrisma.organization.findUnique.mockResolvedValue({
    isActive: true,
  } as never);
  mockCheckUserLimit.mockResolvedValue({ allowed: true, current: 3, max: 10 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSsoUserData", () => {
  it("assigns Microsoft users to the configured org", async () => {
    const result = await resolveSsoUserData(ssoUser, "microsoft");
    expect(result).toEqual({
      ...ssoUser,
      organizationId: ORG_ID,
      authProvider: "microsoft",
    });
  });

  it("rejects when no default org is configured", async () => {
    vi.stubEnv("SSO_DEFAULT_ORGANIZATION_ID", "");
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });

  it.each(["", "common", "organizations", "consumers"])(
    "rejects when the Microsoft tenant is not pinned (%s)",
    async (tenant) => {
      vi.stubEnv("MICROSOFT_TENANT_ID", tenant);
      expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
    },
  );

  it("rejects providers without tenant restriction", async () => {
    expect(await resolveSsoUserData(ssoUser, "google")).toBeNull();
  });

  it("rejects when the org is missing or inactive", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: false,
    } as never);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });
});

describe("resolveSsoUserData user limit", () => {
  it("checks the seats of the configured org", async () => {
    await resolveSsoUserData(ssoUser, "microsoft");

    expect(mockCheckUserLimit).toHaveBeenCalledTimes(1);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(ORG_ID);
  });

  it("rejects when the org user limit is reached", async () => {
    mockCheckUserLimit.mockResolvedValue({
      allowed: false,
      current: 10,
      max: 10,
    });

    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });

  it("no longer reads the legacy maxUsers column", async () => {
    await resolveSsoUserData(ssoUser, "microsoft");

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: { isActive: true },
    });
  });

  it.each([
    [
      "no default org is configured",
      () => vi.stubEnv("SSO_DEFAULT_ORGANIZATION_ID", ""),
    ],
    [
      "the Microsoft tenant is not pinned",
      () => vi.stubEnv("MICROSOFT_TENANT_ID", "common"),
    ],
  ])("does not check seats when %s", async (_reason, arrange) => {
    arrange();

    await resolveSsoUserData(ssoUser, "microsoft");

    expect(mockCheckUserLimit).not.toHaveBeenCalled();
  });

  it("does not check seats for an inactive org", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: false,
    } as never);

    await resolveSsoUserData(ssoUser, "microsoft");

    expect(mockCheckUserLimit).not.toHaveBeenCalled();
  });
});
```

Create `src/app/api/__tests__/sso-callbacks-cloud.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { LOGIN: "login" },
  AUDIT_ENTITIES: { USER: "user" },
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));
vi.mock("@/lib/sso", () => ({
  exchangeOidcCode: vi.fn(),
  validateSamlResponse: vi.fn(),
}));

import { GET as oidcCallback } from "@/app/api/auth/callback/oidc/route";
import { POST as samlCallback } from "@/app/api/auth/callback/saml/route";
import prisma from "@/lib/prisma";
import { exchangeOidcCode, validateSamlResponse } from "@/lib/sso";

const mockPrisma = vi.mocked(prisma, true);

const STATE = "state-1234";
const existingUser = {
  userid: "user-1",
  firstname: "Ada",
  lastname: "Lovelace",
};

function oidcRequest() {
  return new Request(
    `http://localhost:3000/api/auth/callback/oidc?code=abc&state=${STATE}`,
    { headers: { cookie: `oidc_state=${STATE}` } },
  );
}

function samlRequest() {
  const form = new FormData();
  form.set("SAMLResponse", "base64-assertion");
  return new Request("http://localhost:3000/api/auth/callback/saml", {
    method: "POST",
    body: form,
  });
}

function redirectTarget(res: Response): string {
  const location = res.headers.get("location");
  expect(location).not.toBeNull();
  return (
    new URL(location as string).pathname + new URL(location as string).search
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exchangeOidcCode).mockResolvedValue({
    sub: "oidc-sub-1",
    email: "ada@example.com",
    emailVerified: true,
    username: "ada",
    firstName: "Ada",
    lastName: "Lovelace",
  } as never);
  vi.mocked(validateSamlResponse).mockResolvedValue({
    nameID: "saml-name-1",
    email: "ada@example.com",
    username: "ada",
    firstName: "Ada",
    lastName: "Lovelace",
  } as never);
  mockPrisma.user.findFirst.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue(existingUser as never);
  mockPrisma.user.update.mockResolvedValue(existingUser as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OIDC callback", () => {
  it("creates the user outside cloud mode", async () => {
    const res = await oidcCallback(oidcRequest());

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(redirectTarget(res)).toMatch(/^\/api\/auth\/sso-login\?token=/);
  });

  describe("in cloud mode", () => {
    beforeEach(() => {
      stubCloudMode();
    });

    it("never creates an organization-less user and redirects to the login error", async () => {
      const res = await oidcCallback(oidcRequest());

      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/login?error=organization_required");
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
    });

    it("still signs in a user that already exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(existingUser as never);

      const res = await oidcCallback(oidcRequest());

      expect(redirectTarget(res)).toMatch(/^\/api\/auth\/sso-login\?token=/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });
  });
});

describe("SAML callback", () => {
  it("creates the user outside cloud mode", async () => {
    const res = await samlCallback(samlRequest());

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(redirectTarget(res)).toMatch(/^\/api\/auth\/sso-login\?token=/);
  });

  describe("in cloud mode", () => {
    beforeEach(() => {
      stubCloudMode();
    });

    it("never creates an organization-less user and redirects to the login error", async () => {
      const res = await samlCallback(samlRequest());

      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/login?error=organization_required");
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
    });

    it("still signs in a user that already exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(existingUser as never);

      const res = await samlCallback(samlRequest());

      expect(redirectTarget(res)).toMatch(/^\/api\/auth\/sso-login\?token=/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/scim-users.test.ts src/lib/__tests__/sso-provisioning.test.ts src/app/api/__tests__/sso-callbacks-cloud.test.ts`
Expected: FAIL, 13 tests. SCIM still builds its denial from the old `limitCheck.max` message and never checks reactivation; the hook still reads `maxUsers` and counts users itself; the callbacks create the user in cloud mode.

- [ ] **Step 3: Enforce the limit in the SCIM routes**

`src/app/api/scim/v2/Users/route.ts` (POST; `active` is already parsed above as `body.active !== false`). Task 10 changed the call to `checkUserLimit(organizationId)`; the denial body is replaced here:

Replace:

```ts
const USER_SELECT = {
```

with:

```ts
const USER_LIMIT_DETAIL = "The organization has reached its user limit";

const USER_SELECT = {
```

Replace:

```ts
const limitCheck = await checkUserLimit(organizationId);
if (!limitCheck.allowed) {
  return NextResponse.json(
    scimError(
      `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade plan to provision more users.`,
      403,
    ),
    { status: 403, headers: scimHeaders() },
  );
}
```

with:

```ts
// A user created inactive takes no seat; activating it later is checked on
// PUT and PATCH.
if (active) {
  const limitCheck = await checkUserLimit(organizationId);
  if (!limitCheck.allowed) {
    return NextResponse.json(scimError(USER_LIMIT_DETAIL, 403), {
      status: 403,
      headers: scimHeaders(),
    });
  }
}
```

`src/app/api/scim/v2/Users/[id]/route.ts`. PUT and PATCH select `isActive` with the existing row, so a user who is already active never needs a seat. The same denial helper serves both:

Replace:

```ts
import { logger } from "@/lib/logger";
import { assertEmailAssignable } from "@/lib/email-ownership";
```

with:

```ts
import { checkUserLimit } from "@/lib/tenant-limits";
import { logger } from "@/lib/logger";
import { assertEmailAssignable } from "@/lib/email-ownership";
```

Replace:

```ts
const USER_SELECT = {
```

with:

```ts
const USER_LIMIT_DETAIL = "The organization has reached its user limit";

/** 403 for a reactivation that would take the organization past its limit. */
function userLimitReached(): NextResponse {
  return NextResponse.json(scimError(USER_LIMIT_DETAIL, 403), {
    status: 403,
    headers: scimHeaders(),
  });
}

const USER_SELECT = {
```

Replace:

```ts
const existing = await prisma.user.findFirst({
  where: { userid: id, organizationId },
  select: { userid: true },
});

if (!existing) {
  return NextResponse.json(scimError("User not found", 404), {
    status: 404,
    headers: scimHeaders(),
  });
}

// IdPs can never assign a reserved (super-admin) or already-used address.
const requestedEmail: unknown = body.emails?.[0]?.value;
```

with:

```ts
const existing = await prisma.user.findFirst({
  where: { userid: id, organizationId },
  select: { userid: true, isActive: true },
});

if (!existing) {
  return NextResponse.json(scimError("User not found", 404), {
    status: 404,
    headers: scimHeaders(),
  });
}

// Reactivating a deactivated user takes a seat, like creating one. Keeping
// an active user active is the IdP's routine sync and is never blocked.
if (body.active === true && !existing.isActive) {
  const limitCheck = await checkUserLimit(organizationId);
  if (!limitCheck.allowed) return userLimitReached();
}

// IdPs can never assign a reserved (super-admin) or already-used address.
const requestedEmail: unknown = body.emails?.[0]?.value;
```

Replace:

```ts
    const existing = await prisma.user.findFirst({
      where: { userid: id, organizationId },
      select: { userid: true },
    });

    if (!existing) {
      return NextResponse.json(scimError("User not found", 404), {
        status: 404,
        headers: scimHeaders(),
      });
    }

    const updateData: Record<string, unknown> = {
```

with:

```ts
    const existing = await prisma.user.findFirst({
      where: { userid: id, organizationId },
      select: { userid: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json(scimError("User not found", 404), {
        status: 404,
        headers: scimHeaders(),
      });
    }

    const updateData: Record<string, unknown> = {
```

Replace:

```ts
    // IdPs can never assign a reserved (super-admin) or already-used address.
    if (sanitized.email !== undefined) {
```

with:

```ts
    // Reactivating a deactivated user takes a seat, like creating one.
    if (sanitized.isActive === true && !existing.isActive) {
      const limitCheck = await checkUserLimit(organizationId);
      if (!limitCheck.allowed) return userLimitReached();
    }

    // IdPs can never assign a reserved (super-admin) or already-used address.
    if (sanitized.email !== undefined) {
```

- [ ] **Step 4: Check seats in the SSO provisioning hook**

Replace the whole of `src/lib/sso-provisioning.ts`. The organization and tenant checks are unchanged. The quota block that read `maxUsers` and counted all users, whatever form Task 2 gave it, is replaced by `checkUserLimit`.

```ts
/**
 * Org assignment for users created by an OAuth sign-in (BetterAuth generic OAuth).
 *
 * Every query is org-scoped, so a user created without an organizationId is
 * invisible to admins and sees an empty app. New OAuth users are therefore
 * assigned to SSO_DEFAULT_ORGANIZATION_ID — but only for providers locked to a
 * single tenant, otherwise any Microsoft/Google account could join the org.
 */

import prisma from "@/lib/prisma";
import { checkUserLimit } from "@/lib/tenant-limits";
import { logger } from "@/lib/logger";

/** Microsoft multi-tenant authorities that accept accounts from any directory. */
const OPEN_MICROSOFT_TENANTS = new Set([
  "",
  "common",
  "organizations",
  "consumers",
]);

// ponytail: one env-configured org per deployment; add per-org email-domain
// mapping if a multi-tenant instance ever offers OAuth sign-in to several orgs.
function isTenantRestricted(providerId: string): boolean {
  if (providerId !== "microsoft") return false;
  const tenant = (process.env.MICROSOFT_TENANT_ID ?? "").trim().toLowerCase();
  return !OPEN_MICROSOFT_TENANTS.has(tenant);
}

/**
 * Returns the user data to insert, with org and provider set, or null when the
 * sign-up must be refused (BetterAuth then aborts with unable_to_create_user).
 */
export async function resolveSsoUserData<T extends Record<string, unknown>>(
  user: T,
  providerId: string,
): Promise<(T & { organizationId: string; authProvider: string }) | null> {
  const organizationId = process.env.SSO_DEFAULT_ORGANIZATION_ID?.trim();
  const reject = (reason: string) => {
    logger.warn("OAuth sign-up refused", { reason, providerId });
    return null;
  };

  if (!organizationId) return reject("SSO_DEFAULT_ORGANIZATION_ID not set");
  if (!isTenantRestricted(providerId)) {
    return reject("provider is not restricted to a single tenant");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true },
  });
  if (!org?.isActive) return reject("default organization missing or inactive");

  const limitCheck = await checkUserLimit(organizationId);
  if (!limitCheck.allowed) return reject("organization user limit reached");

  return { ...user, organizationId, authProvider: providerId };
}
```

- [ ] **Step 5: Refuse org-less sign-ups in the OIDC and SAML callbacks**

Both callbacks create the user with no `organizationId`. That user belongs to no tenant, sits outside every limit and sees an empty app. In cloud mode they now refuse. The redirect follows the `/login?error=<key>` convention of the existing keys (`missing_code`, `invalid_state`, `no_identity`); the login page does not display these keys today, which the SSO debt items already cover.

`src/app/api/auth/callback/oidc/route.ts`:

Replace:

```ts
import crypto from "crypto";
import { logger } from "@/lib/logger";
```

with:

```ts
import crypto from "crypto";
import { isCloudMode } from "@/lib/deployment-mode";
import { logger } from "@/lib/logger";
```

Replace:

```ts
    if (!user) {
      const randomPassword = await bcrypt.hash(
```

with:

```ts
    if (!user) {
      // A cloud deployment is multi-tenant: a user created here would belong to
      // no organization, sit outside every limit and see an empty app. Refuse
      // instead of creating one.
      if (isCloudMode()) {
        logger.warn(
          "OIDC sign-in refused: no organization to create the user in",
          {
            sub: profile.sub,
          },
        );
        return NextResponse.redirect(
          new URL("/login?error=organization_required", req.url),
        );
      }

      const randomPassword = await bcrypt.hash(
```

`src/app/api/auth/callback/saml/route.ts`:

Replace:

```ts
import crypto from "crypto";
import { logger } from "@/lib/logger";
```

with:

```ts
import crypto from "crypto";
import { isCloudMode } from "@/lib/deployment-mode";
import { logger } from "@/lib/logger";
```

Replace:

```ts
    if (!user) {
      // Auto-create SSO user
      const randomPassword = await bcrypt.hash(
```

with:

```ts
    if (!user) {
      // A cloud deployment is multi-tenant: a user created here would belong to
      // no organization, sit outside every limit and see an empty app. Refuse
      // instead of creating one.
      if (isCloudMode()) {
        logger.warn(
          "SAML sign-in refused: no organization to create the user in",
          {
            nameID: profile.nameID,
          },
        );
        return NextResponse.redirect(
          new URL("/login?error=organization_required", req.url),
        );
      }

      // Auto-create SSO user
      const randomPassword = await bcrypt.hash(
```

- [ ] **Step 6: Run the tests, the type check and the linter**

Run: `npx vitest run src/app/api/__tests__/scim-users.test.ts src/lib/__tests__/sso-provisioning.test.ts src/app/api/__tests__/sso-callbacks-cloud.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/sso-provisioning.ts src/app/api/scim src/app/api/auth/callback`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/scim/v2/Users/route.ts" "src/app/api/scim/v2/Users/[id]/route.ts" src/lib/sso-provisioning.ts src/app/api/auth/callback/oidc/route.ts src/app/api/auth/callback/saml/route.ts src/app/api/__tests__/scim-users.test.ts src/lib/__tests__/sso-provisioning.test.ts src/app/api/__tests__/sso-callbacks-cloud.test.ts
git commit -m "feat: enforce user limits in SCIM and SSO and refuse org-less cloud sign-ups"
```

## Part B: LDAP and Intune syncs

Both syncs run from crons that pass no organization (`syncUsers(undefined, "cron")`, `syncIntuneDevices(null, "cron")`) and from admin routes that pass the super-admin's organization. Reading the free room once and counting down avoids one or two queries per entry; the directory search can return 5000 entries.

- [ ] **Step 8: Write the failing tests**

`src/lib/__tests__/ldap-sync-email.test.ts` already runs `syncUsers` against a faked directory. Mock the limit module and import the cloud helper. Apply these edits:

Replace:

```ts
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
```

with:

```ts
import type { Prisma } from "@prisma/client";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/tenant-limits", () => ({
  remainingCapacity: vi.fn(),
}));
```

Replace:

```ts
import { logger } from "@/lib/logger";

const mockPrisma = vi.mocked(prisma, true);
```

with:

```ts
import { logger } from "@/lib/logger";
import { remainingCapacity } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);
```

then append at the end of the file:

```ts
describe("syncUsers user limit", () => {
  beforeEach(() => {
    stubCloudMode();
    vi.mocked(remainingCapacity).mockResolvedValue(null);
  });

  const created = () =>
    mockPrisma.user.create.mock.calls.map(
      (call) => (call[0].data as { username: string }).username,
    );

  it("reads the free seats of the sync's organization once", async () => {
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
      entry("carol", undefined, "guid-3"),
    ];
    vi.mocked(remainingCapacity).mockResolvedValue(10);

    const result = await syncUsers("org-1");

    expect(result.created).toBe(3);
    expect(remainingCapacity).toHaveBeenCalledTimes(1);
    expect(remainingCapacity).toHaveBeenCalledWith("org-1", "users");
  });

  it("creates users up to the free seats, then skips and logs the rest", async () => {
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
      entry("carol", undefined, "guid-3"),
    ];
    vi.mocked(remainingCapacity).mockResolvedValue(2);

    const result = await syncUsers("org-1");

    expect(result.success).toBe(true);
    expect(result.created).toBe(2);
    expect(created()).toEqual(["alice", "bob"]);
    expect(result.errors).toEqual([
      "Entry CN=carol,DC=example: user limit reached",
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "LDAP sync skipped user: no seat available",
      { dn: "CN=carol,DC=example", reason: "user limit reached" },
    );
  });

  it("creates nothing when the organization is full or over its limit", async () => {
    directory.entries = [entry("alice", undefined, "guid-1")];
    vi.mocked(remainingCapacity).mockResolvedValue(0);

    const result = await syncUsers("org-1");

    expect(result.created).toBe(0);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(1);
  });

  it("does not use a seat for an update of an active user", async () => {
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
    ];
    vi.mocked(remainingCapacity).mockResolvedValue(1);
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({
        userid: "alice-id",
        email: null,
        isActive: true,
      } as never)
      .mockResolvedValueOnce(null);

    const result = await syncUsers("org-1");

    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
    expect(created()).toEqual(["bob"]);
  });

  it("uses a seat to reactivate a deactivated user and skips it when none is left", async () => {
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
    ];
    vi.mocked(remainingCapacity).mockResolvedValue(1);
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({
        userid: "alice-id",
        email: null,
        isActive: false,
      } as never)
      .mockResolvedValueOnce({
        userid: "bob-id",
        email: null,
        isActive: false,
      } as never);

    const result = await syncUsers("org-1");

    expect(result.updated).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userid: "alice-id" } }),
    );
    expect(result.errors).toEqual([
      "Entry CN=bob,DC=example: user limit reached",
    ]);
  });

  it("creates and reactivates nothing without an organization, and logs why", async () => {
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
    ];
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        userid: "bob-id",
        email: null,
        isActive: false,
      } as never);

    const result = await syncUsers(undefined, "cron");

    expect(result.success).toBe(true);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(remainingCapacity).not.toHaveBeenCalled();
    expect(result.errors).toEqual([
      "Entry CN=alice,DC=example: organization required",
      "Entry CN=bob,DC=example: organization required",
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "LDAP sync skipped user: no seat available",
      { dn: "CN=alice,DC=example", reason: "organization required" },
    );
  });

  it("still updates active users without an organization", async () => {
    directory.entries = [entry("alice", undefined, "guid-1")];
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "alice-id",
      email: null,
      isActive: true,
    } as never);

    const result = await syncUsers(undefined, "cron");

    expect(result.updated).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("keeps a skipped user from being deactivated as missing", async () => {
    directory.entries = [entry("alice", undefined, "guid-1")];
    vi.mocked(remainingCapacity).mockResolvedValue(0);
    mockPrisma.system_settings.findMany.mockResolvedValue(
      [
        ["ldap.enabled", "true"],
        ["ldap.serverUrl", "ldap://ldap.example.test:389"],
        ["ldap.searchBase", "DC=example"],
        ["ldap.bindDN", "CN=svc,DC=example"],
        ["ldap.bindPassword", "secret"],
        ["ldap.autoDeactivateUsers", "true"],
      ].map(([settingKey, settingValue]) => ({
        settingKey,
        settingValue,
        isEncrypted: false,
      })) as never,
    );
    mockPrisma.user.findMany.mockResolvedValue([
      { userid: "alice-id", externalId: "guid-1", username: "alice" },
    ] as never);

    const result = await syncUsers("org-1");

    expect(result.deactivated).toBe(0);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("does not limit anything outside cloud mode", async () => {
    vi.unstubAllEnvs();
    directory.entries = [
      entry("alice", undefined, "guid-1"),
      entry("bob", undefined, "guid-2"),
    ];

    const result = await syncUsers(undefined, "cron");

    expect(result.created).toBe(2);
    expect(remainingCapacity).not.toHaveBeenCalled();
  });
});
```

Create `src/lib/integrations/__tests__/intune-sync-limits.test.ts`. It fakes the token and device requests with a stubbed `fetch`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/encryption", () => ({ decrypt: vi.fn((v: string) => v) }));
vi.mock("@/lib/organization-context", () => ({
  scopeToOrganization: vi.fn(
    (where: object, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId ?? null,
    }),
  ),
}));
vi.mock("@/lib/tenant-limits", () => ({
  remainingCapacity: vi.fn(),
}));

import { syncIntuneDevices } from "@/lib/integrations/intune";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { remainingCapacity } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);

function device(name: string) {
  return {
    id: `intune-${name}`,
    deviceName: name,
    serialNumber: `SN-${name}`,
    manufacturer: null,
    model: null,
    operatingSystem: null,
    osVersion: null,
    complianceState: null,
    deviceType: null,
    managedDeviceOwnerType: null,
    enrolledDateTime: null,
    lastSyncDateTime: null,
  };
}

/** Answers the token request, then the device list. */
function stubGraph(devices: Array<ReturnType<typeof device>>) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: devices }), { status: 200 }),
      ),
  );
}

function stubSettings(overrides: Record<string, string> = {}) {
  const settings: Record<string, string> = {
    "intune.enabled": "true",
    "intune.tenantId": "tenant",
    "intune.clientId": "client",
    "intune.clientSecret": "secret",
    ...overrides,
  };
  mockPrisma.system_settings.findMany.mockResolvedValue(
    Object.entries(settings).map(([settingKey, settingValue]) => ({
      settingKey,
      settingValue,
      isEncrypted: false,
    })) as never,
  );
}

const createdNames = () =>
  mockPrisma.asset.create.mock.calls.map(
    (call) => (call[0].data as { assetname: string }).assetname,
  );

beforeEach(() => {
  vi.clearAllMocks();
  stubSettings();
  mockPrisma.asset.findFirst.mockResolvedValue(null);
  mockPrisma.asset.create.mockResolvedValue({} as never);
  mockPrisma.asset.update.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("syncIntuneDevices asset limit", () => {
  it("creates every new device outside cloud mode, without reading any limit", async () => {
    stubGraph([device("a"), device("b"), device("c")]);

    const result = await syncIntuneDevices(null, "cron");

    expect(result).toMatchObject({ created: 3, skipped: 0, errors: [] });
    expect(remainingCapacity).not.toHaveBeenCalled();
  });

  describe("in cloud mode", () => {
    beforeEach(() => {
      stubCloudMode();
    });

    it("reads the free room of the sync's organization once", async () => {
      stubGraph([device("a"), device("b")]);
      vi.mocked(remainingCapacity).mockResolvedValue(10);

      const result = await syncIntuneDevices("org-1", "manual");

      expect(result.created).toBe(2);
      expect(remainingCapacity).toHaveBeenCalledTimes(1);
      expect(remainingCapacity).toHaveBeenCalledWith("org-1", "assets");
    });

    it("creates assets up to the free room, then skips and logs the rest", async () => {
      stubGraph([device("a"), device("b"), device("c")]);
      vi.mocked(remainingCapacity).mockResolvedValue(2);

      const result = await syncIntuneDevices("org-1", "manual");

      expect(result).toMatchObject({ created: 2, skipped: 1, errors: [] });
      expect(createdNames()).toEqual(["a", "b"]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Intune sync skipped device: cannot create asset",
        { deviceName: "c", reason: "asset limit reached" },
      );
    });

    it("creates nothing when the organization is full or over its limit", async () => {
      stubGraph([device("a")]);
      vi.mocked(remainingCapacity).mockResolvedValue(0);

      const result = await syncIntuneDevices("org-1", "manual");

      expect(result).toMatchObject({ created: 0, skipped: 1 });
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    });

    it("keeps updating known devices when there is no room left", async () => {
      stubGraph([device("a"), device("b")]);
      vi.mocked(remainingCapacity).mockResolvedValue(0);
      mockPrisma.asset.findFirst
        .mockResolvedValueOnce({ assetid: "asset-a" } as never)
        .mockResolvedValueOnce(null);

      const result = await syncIntuneDevices("org-1", "manual");

      expect(result).toMatchObject({ created: 0, updated: 1, skipped: 1 });
      expect(mockPrisma.asset.update).toHaveBeenCalledTimes(1);
    });

    it("creates nothing without an organization, and logs why", async () => {
      stubGraph([device("a"), device("b")]);

      const result = await syncIntuneDevices(null, "cron");

      expect(result).toMatchObject({ created: 0, skipped: 2, errors: [] });
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
      expect(remainingCapacity).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Intune sync skipped device: cannot create asset",
        { deviceName: "a", reason: "organization required" },
      );
    });

    it("does not spend room on devices skipped because auto-create is off", async () => {
      stubSettings({ "intune.autoCreateAssets": "false" });
      stubGraph([device("a"), device("b")]);
      vi.mocked(remainingCapacity).mockResolvedValue(1);

      const result = await syncIntuneDevices("org-1", "manual");

      expect(result).toMatchObject({ created: 0, skipped: 2 });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("records the limit skips in the sync log", async () => {
      stubGraph([device("a"), device("b")]);
      vi.mocked(remainingCapacity).mockResolvedValue(1);

      await syncIntuneDevices("org-1", "manual");

      expect(mockPrisma.intuneSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "success",
          devicesCreated: 1,
          devicesSkipped: 1,
        }),
      });
    });
  });
});
```

- [ ] **Step 9: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/ldap-sync-email.test.ts src/lib/integrations/__tests__/intune-sync-limits.test.ts`
Expected: FAIL, 11 tests (5 LDAP, 6 Intune). Neither sync reads a limit yet; the existing email-ownership cases still pass.

- [ ] **Step 10: Limit the LDAP sync**

In `src/lib/ldap.ts`. `syncUsers` looks an entry up by external id or username and sets `isActive: true` on every match, so a deactivated user that is back in the directory is reactivated by the update. That takes a seat, the same as creating a user. Updating an already-active user takes none.

Replace:

```ts
import { ForbiddenError } from "@/lib/errors";
```

with:

```ts
import { ForbiddenError } from "@/lib/errors";
import { isCloudMode } from "@/lib/deployment-mode";
import { remainingCapacity } from "@/lib/tenant-limits";
```

Replace:

```ts
    await bindAsync(client, cfg.bindDN, cfg.bindPassword);

    const ldapUsers = await searchAsync(client, cfg.searchBase, {
      filter: cfg.userFilter,
      scope: "sub",
      attributes: [
        cfg.attrUsername,
        cfg.attrEmail,
```

with:

```ts
    await bindAsync(client, cfg.bindDN, cfg.bindPassword);

    // Creating a user or reactivating a deactivated one takes a seat. Read the
    // free seats once and count down, instead of a check per directory entry.
    // Without an organization a cloud deployment has nowhere to put the user.
    let seatsLeft: number | null = null; // null = unlimited
    let noSeatReason = "user limit reached";
    if (isCloudMode()) {
      if (organizationId) {
        seatsLeft = await remainingCapacity(organizationId, "users");
      } else {
        seatsLeft = 0;
        noSeatReason = "organization required";
      }
    }
    const takeSeat = (dn: string): boolean => {
      if (seatsLeft === null) return true;
      if (seatsLeft > 0) {
        seatsLeft -= 1;
        return true;
      }
      logger.warn("LDAP sync skipped user: no seat available", {
        dn,
        reason: noSeatReason,
      });
      errors.push(`Entry ${dn}: ${noSeatReason}`);
      return false;
    };

    const ldapUsers = await searchAsync(client, cfg.searchBase, {
      filter: cfg.userFilter,
      scope: "sub",
      attributes: [
        cfg.attrUsername,
        cfg.attrEmail,
```

Replace:

```ts
        if (existingUser) {
          await prisma.user.update({
```

with:

```ts
        if (existingUser) {
          if (!existingUser.isActive && !takeSeat(dn)) continue;

          await prisma.user.update({
```

Replace:

```ts
        } else if (cfg.autoCreateUsers) {
          // Create new user with random password (they'll auth via LDAP)
```

with:

```ts
        } else if (cfg.autoCreateUsers) {
          if (!takeSeat(dn)) continue;

          // Create new user with random password (they'll auth via LDAP)
```

- [ ] **Step 11: Limit the Intune sync**

In `src/lib/integrations/intune.ts`. Only asset creation takes room; updates of known devices continue when the organization is full. The room is spent after the `autoCreateAssets` check, so devices that are skipped for configuration reasons use none.

Replace:

```ts
import { scopeToOrganization } from "@/lib/organization-context";
import { logger } from "@/lib/logger";
```

with:

```ts
import { scopeToOrganization } from "@/lib/organization-context";
import { isCloudMode } from "@/lib/deployment-mode";
import { remainingCapacity } from "@/lib/tenant-limits";
import { logger } from "@/lib/logger";
```

Replace:

```ts
const errors: Array<{ deviceName: string; error: string }> = [];

// Cache for auto-created entities to avoid repeated DB lookups
```

with:

```ts
const errors: Array<{ deviceName: string; error: string }> = [];

// New assets are limited per organization. Read the free room once and count
// down, instead of a check per device. Without an organization a cloud
// deployment has nowhere to put the asset.
let roomLeft: number | null = null; // null = unlimited
let noRoomReason = "asset limit reached";
if (isCloudMode()) {
  if (organizationId) {
    roomLeft = await remainingCapacity(organizationId, "assets");
  } else {
    roomLeft = 0;
    noRoomReason = "organization required";
  }
}

// Cache for auto-created entities to avoid repeated DB lookups
```

Replace:

```ts
if (!settings.autoCreateAssets) {
  skipped++;
  continue;
}

const serialNumber;
```

with:

```ts
if (!settings.autoCreateAssets) {
  skipped++;
  continue;
}

if (roomLeft !== null) {
  if (roomLeft <= 0) {
    skipped++;
    logger.warn("Intune sync skipped device: cannot create asset", {
      deviceName: device.deviceName,
      reason: noRoomReason,
    });
    continue;
  }
  roomLeft -= 1;
}

const serialNumber;
```

- [ ] **Step 12: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/ldap-sync-email.test.ts src/lib/integrations/__tests__/intune-sync-limits.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/ldap.ts src/lib/integrations/intune.ts`
Expected: no output.

Run: `grep -rn -E "Upgrade (your )?plan|limitCheck\.max !== -1|USER_LIMIT_MESSAGE" src`
Expected: no output. Every "Upgrade your plan" string and the `-1` sentinel check are gone.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/lib/ldap.ts src/lib/integrations/intune.ts src/lib/__tests__/ldap-sync-email.test.ts src/lib/integrations/__tests__/intune-sync-limits.test.ts
git commit -m "feat: skip identity sync creations that exceed the organization limits"
```
