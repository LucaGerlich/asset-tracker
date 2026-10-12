### Task 9: SCIM gate

`authenticateScim` is the single choke point for every SCIM request, and the token it matches already names an organization. The suspension check that sits there (`rejectSuspendedOrg`) becomes `authorizeScimOrg`, which makes one `getOrgAccess` read and decides status and the `scim` entitlement together. No code creates SCIM tokens, so there is no config-time gate (spec Revision 3); the legacy global token is refused in cloud mode instead.

**Files:**

- Modify: `src/lib/scim.ts`
- Test: `src/lib/__tests__/scim.test.ts` (extend)
- Test: `src/app/api/__tests__/scim-users.test.ts` (replace the org-suspension mock and the last `describe`)

**Interfaces:**

- Consumes (Task 2): `isCloudMode` from `@/lib/deployment-mode`; `stubCloudMode()` from `tests/setup/cloud-mode.ts` in tests. Consumes (Task 6): `getOrgAccess(orgId)` and `type OrgAccess` from `@/lib/org-access`; `allowsFeature` from `@/lib/entitlements-shared`.
- Produces in `src/lib/scim.ts`: `authorizeScimOrg(organizationId: string, method: string): Promise<NextResponse | ScimAuthResult>`, which replaces the private `rejectSuspendedOrg`. It is exported so it can be tested directly; no route imports it. One `getOrgAccess` read per call. Order of the checks:
  1. `locked_out`, or `read_only` with a method other than `GET`: 403 `Organization suspended`.
  2. No `scim` feature: 403 `SCIM is not available for your organization`.
  3. Otherwise `{ organizationId }`.
     All bodies are SCIM errors (`scimError`, `application/scim+json`), never `apiErrorResponse` bodies.
- `authenticateScim` signature and its success value are unchanged. `getOrgSuspensionStatus` has no caller left after this task and Task 8; it stays exported.

Decisions for this task:

- Outside cloud mode `getOrgAccess` resolves to an active organization with unrestricted entitlements without a query, so self-hosted SCIM behaves as before whatever is stored.
- The legacy global token is refused in cloud mode with a 401 before the `scim.bearerToken` setting is read. Outside cloud mode it behaves as today (it still maps to the first organization it finds; TECHNICAL_DEBT item 63 stays open).
- The SCIM discovery routes (`ServiceProviderConfig`, `Schemas`) are unauthenticated by design (RFC 7644) and untouched.
- Review Focus 1: with no control plane `getOrgAccess` is unrestricted and active (Task 6), so SCIM behaves exactly as before, including the legacy token. The tests pin that the legacy token is refused only in cloud mode.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/scim.test.ts`, replace:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma");

import { scimEmailRejection } from "@/lib/scim";
import { EmailConflictError } from "@/lib/email-ownership";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
```

with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

vi.mock("@/lib/prisma");
vi.mock("@/lib/org-access", () => ({ getOrgAccess: vi.fn() }));

import prisma from "@/lib/prisma";
import { getOrgAccess, type OrgAccess } from "@/lib/org-access";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";
import type { OrgStatus } from "@/lib/org-suspension";
import {
  authenticateScim,
  authorizeScimOrg,
  scimEmailRejection,
} from "@/lib/scim";
import { EmailConflictError } from "@/lib/email-ownership";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
```

Append to `src/lib/__tests__/scim.test.ts`:

```ts
const mockPrisma = vi.mocked(prisma, true);
const mockAccess = vi.mocked(getOrgAccess);

const ORG = "org-uuid-001";

function access(
  status: OrgStatus,
  features: readonly GatedFeature[] = GATED_FEATURES,
): OrgAccess {
  return {
    status,
    entitlements: { features: [...features], maxAssets: null, maxUsers: null },
  };
}

async function scimDenial(result: unknown) {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  return {
    status: response.status,
    contentType: response.headers.get("Content-Type"),
    body: (await response.json()) as {
      schemas: string[];
      detail: string;
      status: number;
    },
  };
}

describe("authorizeScimOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockResolvedValue(access("active"));
  });

  it.each<[OrgStatus, string]>([
    ["active", "GET"],
    ["active", "POST"],
    ["active", "DELETE"],
    ["read_only", "GET"],
  ])(
    "lets an organization with status %s and SCIM through on %s",
    async (status, method) => {
      mockAccess.mockResolvedValue(access(status));

      await expect(authorizeScimOrg(ORG, method)).resolves.toEqual({
        organizationId: ORG,
      });
    },
  );

  it.each<[OrgStatus, string]>([
    ["read_only", "POST"],
    ["read_only", "PATCH"],
    ["read_only", "DELETE"],
    ["locked_out", "GET"],
    ["locked_out", "POST"],
  ])(
    "refuses an organization with status %s on %s as suspended",
    async (status, method) => {
      mockAccess.mockResolvedValue(access(status));

      const denial = await scimDenial(await authorizeScimOrg(ORG, method));

      expect(denial.status).toBe(403);
      expect(denial.contentType).toBe("application/scim+json");
      expect(denial.body).toEqual({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "Organization suspended",
        status: 403,
      });
    },
  );

  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    "refuses an organization without the scim feature on %s",
    async (method) => {
      mockAccess.mockResolvedValue(access("active", ["api_keys"]));

      const denial = await scimDenial(await authorizeScimOrg(ORG, method));

      expect(denial.status).toBe(403);
      expect(denial.contentType).toBe("application/scim+json");
      expect(denial.body).toEqual({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: "SCIM is not available for your organization",
        status: 403,
      });
    },
  );

  it("reports a suspension before a missing entitlement", async () => {
    mockAccess.mockResolvedValue(access("locked_out", []));

    const denial = await scimDenial(await authorizeScimOrg(ORG, "GET"));

    expect(denial.body.detail).toBe("Organization suspended");
  });

  it("reads the access of the given organization exactly once", async () => {
    await authorizeScimOrg(ORG, "GET");

    expect(mockAccess).toHaveBeenCalledTimes(1);
    expect(mockAccess).toHaveBeenCalledWith(ORG);
  });
});

describe("authenticateScim legacy global token", () => {
  const request = () =>
    new Request("http://localhost/api/scim/v2/Users", {
      headers: { authorization: "Bearer legacy-token" },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.scimToken.findMany.mockResolvedValue([]);
    mockPrisma.system_settings.findUnique.mockResolvedValue({
      settingValue: "legacy-token",
      isEncrypted: false,
    } as never);
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: "org-legacy",
    } as never);
    mockAccess.mockResolvedValue(access("active"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("still accepts the legacy token outside cloud mode", async () => {
    await expect(authenticateScim(request())).resolves.toEqual({
      organizationId: "org-legacy",
    });
    expect(mockAccess).toHaveBeenCalledWith("org-legacy");
  });

  it("applies the entitlement check to the legacy token too", async () => {
    mockAccess.mockResolvedValue(access("active", []));

    const denial = await scimDenial(await authenticateScim(request()));

    expect(denial.status).toBe(403);
    expect(denial.body.detail).toBe(
      "SCIM is not available for your organization",
    );
  });

  it("refuses the legacy token in cloud mode before reading the setting", async () => {
    stubCloudMode();

    const denial = await scimDenial(await authenticateScim(request()));

    expect(denial.status).toBe(401);
    expect(denial.contentType).toBe("application/scim+json");
    expect(denial.body.detail).toBe("Invalid bearer token");
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("still accepts a per-organization token in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.scimToken.findMany.mockResolvedValue([
      { token: "legacy-token", organizationId: ORG },
    ] as never);

    await expect(authenticateScim(request())).resolves.toEqual({
      organizationId: ORG,
    });
    expect(mockAccess).toHaveBeenCalledWith(ORG);
  });
});
```

In `src/app/api/__tests__/scim-users.test.ts`, replace:

```ts
vi.mock("@/lib/org-suspension", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/org-suspension")>()),
  getOrgSuspensionStatus: vi.fn(),
}));
```

with:

```ts
vi.mock("@/lib/org-access", () => ({ getOrgAccess: vi.fn() }));
```

and replace:

```ts
import { getOrgSuspensionStatus } from "@/lib/org-suspension";
```

with:

```ts
import { getOrgAccess, type OrgAccess } from "@/lib/org-access";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";
import type { OrgStatus } from "@/lib/org-suspension";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";
```

and replace:

```ts
const mockOrgStatus = vi.mocked(getOrgSuspensionStatus);
```

with:

```ts
const mockOrgAccess = vi.mocked(getOrgAccess);
```

In `src/app/api/__tests__/scim-users.test.ts`, replace everything from the banner comment `// Organization suspension (real authenticateScim)` to the end of the file with:

```ts
// ---------------------------------------------------------------------------
// Organization status and entitlement (real authenticateScim)
// ---------------------------------------------------------------------------
describe("SCIM org access", () => {
  const authHeaders = { Authorization: "Bearer org-scim-token" };
  const usersUrl = "http://localhost:3000/api/scim/v2/Users";
  const userUrl = `${usersUrl}/user-001`;

  const access = (
    status: OrgStatus = "active",
    features: readonly GatedFeature[] = GATED_FEATURES,
  ): OrgAccess => ({
    status,
    entitlements: { features: [...features], maxAssets: null, maxUsers: null },
  });

  beforeEach(() => {
    mockAuth.mockImplementation(realAuthenticateScim);
    mockPrisma.scimToken.findMany.mockResolvedValue([
      { token: "org-scim-token", organizationId: "org-uuid-001" },
    ] as never);
    mockOrgAccess.mockResolvedValue(access());
    // Earlier tests leave resolved values behind; start from "no such user".
    mockPrisma.user.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the access of the organization the token belongs to, once", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUser] as never);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );

    expect(res.status).toBe(200);
    expect(mockOrgAccess).toHaveBeenCalledTimes(1);
    expect(mockOrgAccess).toHaveBeenCalledWith("org-uuid-001");
  });

  it("rejects POST with 403 and a SCIM error body when the org is read-only", async () => {
    mockOrgAccess.mockResolvedValue(access("read_only"));

    const res = await createUser(
      createMockRequest(usersUrl, {
        method: "POST",
        headers: authHeaders,
        body: { userName: "jdoe", name: { givenName: "J", familyName: "D" } },
      }),
    );
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(403);
    expect(res.headers.get("content-type")).toBe("application/scim+json");
    expect(body).toEqual({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Organization suspended",
      status: 403,
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects DELETE with 403 when the org is read-only", async () => {
    mockOrgAccess.mockResolvedValue(access("read_only"));

    const res = await deleteUser(
      createMockRequest(userUrl, { method: "DELETE", headers: authHeaders }),
      { params: Promise.resolve({ id: "user-001" }) },
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("allows GET with 200 when the org is read-only", async () => {
    mockOrgAccess.mockResolvedValue(access("read_only"));
    mockPrisma.user.findMany.mockResolvedValue([mockUser] as never);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );

    expect(res.status).toBe(200);
  });

  it("rejects GET with 403 when the org is locked out", async () => {
    mockOrgAccess.mockResolvedValue(access("locked_out"));

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(403);
    expect(body.detail).toBe("Organization suspended");
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("rejects POST with 403 when the org is locked out", async () => {
    mockOrgAccess.mockResolvedValue(access("locked_out"));

    const res = await createUser(
      createMockRequest(usersUrl, {
        method: "POST",
        headers: authHeaders,
        body: { userName: "jdoe" },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects GET with 403 when the org has no SCIM entitlement", async () => {
    mockOrgAccess.mockResolvedValue(access("active", ["api_keys"]));

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(403);
    expect(res.headers.get("content-type")).toBe("application/scim+json");
    expect(body).toEqual({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "SCIM is not available for your organization",
      status: 403,
    });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("rejects POST and creates nothing when the org has no SCIM entitlement", async () => {
    mockOrgAccess.mockResolvedValue(access("active", []));

    const res = await createUser(
      createMockRequest(usersUrl, {
        method: "POST",
        headers: authHeaders,
        body: { userName: "jdoe" },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("applies the same checks to the legacy global token outside cloud mode", async () => {
    mockPrisma.scimToken.findMany.mockResolvedValue([]);
    mockPrisma.system_settings.findUnique.mockResolvedValue({
      settingValue: "org-scim-token",
      isEncrypted: false,
    } as never);
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: "org-legacy",
    } as never);
    mockOrgAccess.mockResolvedValue(access("locked_out"));

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );

    expect(res.status).toBe(403);
    expect(mockOrgAccess).toHaveBeenCalledWith("org-legacy");
  });

  it("refuses the legacy global token in cloud mode without reading the setting", async () => {
    stubCloudMode();
    mockPrisma.scimToken.findMany.mockResolvedValue([]);
    mockPrisma.system_settings.findUnique.mockResolvedValue({
      settingValue: "org-scim-token",
      isEncrypted: false,
    } as never);

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(401);
    expect(body.detail).toBe("Invalid bearer token");
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    expect(mockOrgAccess).not.toHaveBeenCalled();
  });

  it("still serves a per-organization token in cloud mode", async () => {
    stubCloudMode();
    mockPrisma.user.findMany.mockResolvedValue([mockUser] as never);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await listUsers(
      createMockRequest(usersUrl, { headers: authHeaders }),
    );

    expect(res.status).toBe(200);
    expect(mockOrgAccess).toHaveBeenCalledWith("org-uuid-001");
  });

  it("does not read the organization's access for an invalid token", async () => {
    const res = await listUsers(
      createMockRequest(usersUrl, {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    );

    expect(res.status).toBe(401);
    expect(mockOrgAccess).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/scim.test.ts src/app/api/__tests__/scim-users.test.ts`
Expected: FAIL. `authorizeScimOrg` is not exported, `authenticateScim` still reads `getOrgSuspensionStatus` (no longer mocked), and the legacy token is still accepted in cloud mode.

- [ ] **Step 3: Replace the suspension check with `authorizeScimOrg`**

In `src/lib/scim.ts`, replace:

```ts
import { ForbiddenError } from "@/lib/errors";
import { getOrgSuspensionStatus } from "@/lib/org-suspension";
import { NextResponse } from "next/server";
```

with:

```ts
import { isCloudMode } from "@/lib/deployment-mode";
import { allowsFeature } from "@/lib/entitlements-shared";
import { ForbiddenError } from "@/lib/errors";
import { getOrgAccess } from "@/lib/org-access";
import { NextResponse } from "next/server";
```

and replace:

```ts
/**
 * SCIM authenticates by token, not session, so the org-suspension rules the
 * session guards enforce are applied here instead: a locked-out org is denied
 * entirely, a read-only org may still read (GET) but not provision.
 */
async function rejectSuspendedOrg(
  organizationId: string,
  method: string,
): Promise<NextResponse | ScimAuthResult> {
  const status = await getOrgSuspensionStatus(organizationId);
  if (status === "locked_out" || (status === "read_only" && method !== "GET")) {
    return NextResponse.json(scimError("Organization suspended", 403), {
      status: 403,
      headers: scimHeaders(),
    });
  }
  return { organizationId };
}
```

with:

```ts
function scimForbidden(detail: string): NextResponse {
  return NextResponse.json(scimError(detail, 403), {
    status: 403,
    headers: scimHeaders(),
  });
}

/**
 * SCIM authenticates by token, not session, so the rules the session guards
 * enforce are applied here instead, from one read of the token's
 * organization: a locked-out org is denied entirely, a read-only org may still
 * read (GET) but not provision, and an org without the scim entitlement is
 * denied.
 */
export async function authorizeScimOrg(
  organizationId: string,
  method: string,
): Promise<NextResponse | ScimAuthResult> {
  const access = await getOrgAccess(organizationId);
  if (
    access.status === "locked_out" ||
    (access.status === "read_only" && method !== "GET")
  ) {
    return scimForbidden("Organization suspended");
  }
  if (!allowsFeature(access.entitlements, "scim")) {
    return scimForbidden("SCIM is not available for your organization");
  }
  return { organizationId };
}
```

and replace:

```ts
 * Returns the matched organization ID on success, or a NextResponse error
 * (401 for a bad token, 403 when the token's organization is suspended).
 */
```

with:

```ts
 * Returns the matched organization ID on success, or a NextResponse error
 * (401 for a bad token, 403 when the token's organization is suspended or has
 * no SCIM entitlement).
 */
```

and replace:

```ts
  if (scimTokens.length === 0) {
    // Fall back to legacy global token in system_settings
```

with:

```ts
  if (scimTokens.length === 0) {
    // The legacy global token maps to the first organization found, so a
    // multi-tenant cloud deployment never accepts it.
    if (isCloudMode()) {
      return NextResponse.json(scimError("Invalid bearer token", 401), {
        status: 401,
        headers: scimHeaders(),
      });
    }

    // Fall back to legacy global token in system_settings
```

and replace:

```ts
return rejectSuspendedOrg(firstOrg.id, req.method);
```

with:

```ts
return authorizeScimOrg(firstOrg.id, req.method);
```

and replace:

```ts
return rejectSuspendedOrg(record.organizationId, req.method);
```

with:

```ts
return authorizeScimOrg(record.organizationId, req.method);
```

- [ ] **Step 4: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/lib/__tests__/scim.test.ts src/app/api/__tests__/scim-users.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/scim.ts src/lib/__tests__/scim.test.ts src/app/api/__tests__/scim-users.test.ts`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS (DB tests skipped locally).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scim.ts src/lib/__tests__/scim.test.ts src/app/api/__tests__/scim-users.test.ts
git commit -m "feat: gate SCIM by entitlement and refuse the legacy token in cloud mode"
```
