# Phase 0 Tenant Isolation and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the cross-tenant and privilege holes listed in the Phase 0 spec, so that no tenant can read, change or trigger anything in another tenant, no tenant can gain super-admin rights, suspension and lock are enforced, and denials reach clients as typed 403s.

**Architecture:** Guards in `src/lib/api-auth.ts` throw typed errors (`src/lib/errors.ts`) that one shared `apiErrorResponse()` maps to 401/403 with a machine-readable `code`. Org status is loaded with the user in one query and enforced by the guards, a `requireWritableOrg` call in every mutating handler, and a proxy redirect for pages. Workflows and custom fields get an `organizationId` and every query is scoped by it. Two route-walk tests keep the conventions from regressing.

**Tech Stack:** Next.js 16.2 (App Router, `src/proxy.ts`), Prisma 7, BetterAuth 1.6.30, zod 4, vitest 4 (+ happy-dom per file), Bun.

**Spec:** `docs/superpowers/specs/2026-10-06-phase0-tenant-security-design.md`

## Global Constraints

- Branch `feat/phase0-tenant-security` from `development`. Do not push.
- Release version `0.14.0` (bumped in Task 14 only).
- Commits: conventional (`fix:`, `feat:`, `test:`, `docs:`), English, no `Co-Authored-By`, no mention of Claude.
- TypeScript strict, no `any` in new code. Tabs are not used in this repo: keep the files' existing 2-space Prettier style (Prettier runs in the pre-commit hook).
- Never run `prisma db push`, `prisma migrate reset` or `prisma migrate dev` against any database. Local `DATABASE_URL` may point at the shared production DB. Create the migration file by hand.
- DB-backed tests use the existing gate: `const describeDb = process.env.DATABASE_URL ? describe : describe.skip;`. They run in CI against an empty Postgres after `prisma migrate deploy`. Run them locally only with an explicit throwaway `DATABASE_URL` (e.g. a local Docker Postgres).
- Self-hosted behaviour (`SELF_HOSTED=true`, one org) must stay unchanged except where the spec says otherwise (signup closed by default).
- Error responses: `{ error: string, code?: string }`. Never return stack traces or raw `error.message` from unexpected errors.
- Run after every task: `npx vitest run <the task's test files>`; before each commit also `npx tsc --noEmit -p .`.

## Review Focus

1. **Org-less users** (users with `organizationId = null`, e.g. LDAP or OIDC-created): every scoped query must return nothing for them, never rows with `organizationId IS NULL`. Owner: Tasks 11 and 12 (test: org-less admin lists zero rules and definitions).
2. **API-key callers** must get the same org status and write blocking as session callers. Owner: Task 2 (test: API-key user of a locked org gets `org_locked`).
3. **Super-admin in self-hosted single-org installs** must keep working with `SUPER_ADMIN_EMAILS` unset. Owner: Task 7 (test: unset env plus one org allows the admin).
4. **Suspended admins must still be able to pay and sign out.** Owner: Tasks 3 and 6 (tests: allow-list contains billing and session routes; portal works for a read-only org).
5. **Offline replay after sign-out or user switch** must never send another user's queued change. Owner: Task 13 (test: entries of another user are not replayed).

---

### Task 1: Typed errors and `apiErrorResponse`

**Files:**

- Modify: `src/lib/errors.ts`
- Test: `src/lib/__tests__/errors.test.ts` (create)

**Interfaces:**

- Produces:
  - `type ForbiddenCode = 'org_locked' | 'org_read_only' | 'not_admin' | 'not_super_admin' | 'insufficient_permission' | 'api_key_scope' | 'request_permission' | 'feature_not_entitled'`
  - `class UnauthorizedError extends AppError` (`statusCode 401`, `code 'unauthorized'`, default message `"Unauthorized"`)
  - `class ForbiddenError extends AppError` with `constructor(code: ForbiddenCode, message: string)`; `message` always starts with `"Forbidden: "`.
  - `function apiErrorResponse(error: unknown): NextResponse | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  ForbiddenError,
  UnauthorizedError,
  apiErrorResponse,
} from "@/lib/errors";

describe("typed auth errors", () => {
  it("ForbiddenError keeps the 'Forbidden: ' prefix and carries a code", () => {
    const err = new ForbiddenError("org_locked", "Organization suspended");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Forbidden: Organization suspended");
    expect(err.code).toBe("org_locked");
    expect(err.statusCode).toBe(403);
  });

  it("UnauthorizedError defaults to 'Unauthorized'", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });
});

describe("apiErrorResponse", () => {
  it("maps ForbiddenError to 403 with error and code", async () => {
    const res = apiErrorResponse(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: "Forbidden: Organization is in read-only mode",
      code: "org_read_only",
    });
  });

  it("maps UnauthorizedError to 401", async () => {
    const res = apiErrorResponse(new UnauthorizedError());
    expect(res?.status).toBe(401);
    await expect(res?.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "unauthorized",
    });
  });

  it("returns null for any other error so routes keep their own handling", () => {
    expect(apiErrorResponse(new Error("boom"))).toBeNull();
    expect(apiErrorResponse("string")).toBeNull();
    expect(apiErrorResponse(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: FAIL (`apiErrorResponse` is not exported; `ForbiddenError` signature differs).

- [ ] **Step 3: Implement**

Replace the `UnauthorizedError` and `ForbiddenError` classes in `src/lib/errors.ts` and add the mapper. Nothing imports these classes today, so changing the constructor is safe. Keep `AppError`, `NotFoundError`, `ValidationError` and `RateLimitError` unchanged, and update the header comment's example to use `apiErrorResponse`.

```ts
import { NextResponse } from "next/server";

export type ForbiddenCode =
  | "org_locked"
  | "org_read_only"
  | "not_admin"
  | "not_super_admin"
  | "insufficient_permission"
  | "api_key_scope"
  | "request_permission"
  | "feature_not_entitled";

/** 401: no valid session or API key */
export class UnauthorizedError extends AppError {
  readonly code = "unauthorized";

  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * 403: authenticated but not allowed. The message keeps the historic
 * "Forbidden: " prefix so existing `message.startsWith("Forbidden")`
 * catch blocks keep mapping it to 403.
 */
export class ForbiddenError extends AppError {
  readonly code: ForbiddenCode;

  constructor(code: ForbiddenCode, message: string) {
    super(`Forbidden: ${message}`, 403);
    this.code = code;
  }
}

/**
 * Map guard errors to a JSON response. Returns null for anything else, so the
 * caller keeps its own 404/409/500 handling:
 *
 *   } catch (error) {
 *     const denied = apiErrorResponse(error);
 *     if (denied) return denied;
 *     ...
 */
export function apiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/__tests__/errors.test.ts
git commit -m "feat: add coded auth errors and a shared API error mapper"
```

---

### Task 2: Org status loaded with the user and enforced by the guards

**Files:**

- Modify: `src/lib/org-suspension.ts`, `src/lib/api-auth.ts`, `src/lib/api-keys.ts` (user select), `src/lib/__mocks__/api-auth.ts`
- Test: `src/lib/__tests__/org-suspension.test.ts`, `src/lib/__tests__/api-auth.test.ts` (update)

**Interfaces:**

- Consumes: `ForbiddenError`, `UnauthorizedError` (Task 1).
- Produces:
  - `org-suspension.ts`: `type OrgStatus = 'active' | 'read_only' | 'locked_out'`; `getOrgStatus(org: { isActive: boolean; suspendedAt: Date | null }): OrgStatus`; `resolveOrgStatus(org: { isActive: boolean; suspendedAt: Date | null } | null): OrgStatus` (returns `'active'` when self-hosted or `org` is null); `getOrgSuspensionStatus(organizationId: string | null | undefined): Promise<OrgStatus>` (kept, used by proxy and SCIM). `requireActiveOrg` and `requireWriteAccess` are deleted.
  - `api-auth.ts`: `AuthUser.orgStatus: OrgStatus` (always set by `getAuthUser`); `assertOrgNotLocked(user: AuthUser): void`; `requireWritableOrg(user: AuthUser): Promise<void>` (no DB query); all guards throw `ForbiddenError` / `UnauthorizedError`.

- [ ] **Step 1: Update `org-suspension.test.ts` (failing first)**

Replace the `requireActiveOrg` and `requireWriteAccess` describe blocks with these, and add the precedence cases to `getOrgStatus`:

```ts
it("is locked_out when isActive is false, even inside the grace period", () => {
  const status = getOrgStatus({
    isActive: false,
    suspendedAt: new Date(NOW.getTime() - 2 * DAY_MS),
  });
  expect(status).toBe("locked_out");
});

it("is read_only when suspended within 14 days and still active", () => {
  const status = getOrgStatus({
    isActive: true,
    suspendedAt: new Date(NOW.getTime() - 2 * DAY_MS),
  });
  expect(status).toBe("read_only");
});

describe("resolveOrgStatus", () => {
  it("is active for a missing org", () => {
    expect(resolveOrgStatus(null)).toBe("active");
  });

  it("is active in self-hosted mode regardless of the row", () => {
    mockIsSelfHosted.mockReturnValue(true);
    expect(resolveOrgStatus({ isActive: false, suspendedAt: null })).toBe(
      "active",
    );
  });

  it("derives the status otherwise", () => {
    expect(resolveOrgStatus({ isActive: false, suspendedAt: null })).toBe(
      "locked_out",
    );
  });
});
```

Run: `npx vitest run src/lib/__tests__/org-suspension.test.ts`
Expected: FAIL (`resolveOrgStatus` missing; `isActive:false` with recent `suspendedAt` returns `read_only` today).

- [ ] **Step 2: Implement `org-suspension.ts`**

```ts
import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";

export type OrgStatus = "active" | "read_only" | "locked_out";

const GRACE_PERIOD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OrgSuspensionFields {
  isActive: boolean;
  suspendedAt: Date | null;
}

/**
 * Precedence: an inactive org is locked out first; a suspension is read-only
 * for 14 days and locked out afterwards.
 */
export function getOrgStatus(org: OrgSuspensionFields): OrgStatus {
  if (!org.isActive) return "locked_out";
  if (!org.suspendedAt) return "active";
  const days = (Date.now() - org.suspendedAt.getTime()) / DAY_MS;
  return days <= GRACE_PERIOD_DAYS ? "read_only" : "locked_out";
}

/** Status for an org row that may be missing; self-hosted is always active. */
export function resolveOrgStatus(org: OrgSuspensionFields | null): OrgStatus {
  if (isSelfHosted() || !org) return "active";
  return getOrgStatus(org);
}

/** One-query lookup for callers without a loaded user (proxy, SCIM). */
export async function getOrgSuspensionStatus(
  organizationId: string | null | undefined,
): Promise<OrgStatus> {
  if (isSelfHosted() || !organizationId) return "active";
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, suspendedAt: true },
  });
  return resolveOrgStatus(org);
}
```

Run the org-suspension test: PASS.

- [ ] **Step 3: Update `api-auth.test.ts` (failing first)**

Change the `@/lib/org-suspension` mock to `{ resolveOrgStatus: vi.fn().mockReturnValue("active") }` and give `activeDbUser` an `organization: { isActive: true, suspendedAt: null }`. Replace every `mockGetOrgSuspensionStatus`/`mockRequireActiveOrg` use with `mockResolveOrgStatus`. Add:

```ts
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { requireWritableOrg } from "@/lib/api-auth";

it("requireApiAuth throws ForbiddenError org_locked for a locked org", async () => {
  mockResolveOrgStatus.mockReturnValue("locked_out");
  await expect(requireApiAuth()).rejects.toMatchObject({
    code: "org_locked",
  });
  await expect(requireApiAuth()).rejects.toBeInstanceOf(ForbiddenError);
});

it("requireApiAuth does not issue a second org query", async () => {
  await requireApiAuth();
  expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
});

it("getAuthUser throws UnauthorizedError without a session", async () => {
  mockAuth.api.getSession.mockResolvedValue(null as any);
  await expect(requireApiAuth()).rejects.toBeInstanceOf(UnauthorizedError);
});

it("requireWritableOrg rejects read_only and locked_out, allows active", async () => {
  const base = { id: "user-1", organizationId: "org-1" };
  await expect(
    requireWritableOrg({ ...base, orgStatus: "active" }),
  ).resolves.toBeUndefined();
  await expect(
    requireWritableOrg({ ...base, orgStatus: "read_only" }),
  ).rejects.toMatchObject({ code: "org_read_only" });
  await expect(
    requireWritableOrg({ ...base, orgStatus: "locked_out" }),
  ).rejects.toMatchObject({ code: "org_locked" });
});

it("requirePermission blocks an API-key user of a locked org", async () => {
  // API-key path: validateApiKey returns a user whose org is locked.
  vi.mocked(validateApiKey).mockResolvedValue({
    id: "key-1",
    scopes: ["asset:view"],
    user: {
      ...activeDbUser,
      organization: { isActive: false, suspendedAt: null },
    },
  } as any);
  vi.mocked(headers).mockResolvedValue(
    new Headers({ authorization: "Bearer at_test_key" }),
  );
  mockResolveOrgStatus.mockReturnValue("locked_out");
  await expect(requirePermission("asset:view")).rejects.toMatchObject({
    code: "org_locked",
  });
});
```

(Add `vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }))` and import `validateApiKey` and `headers` for the last test; reset `headers` to `new Headers()` in `beforeEach`.) Keep the existing super-admin tests; they must still pass after Task 7.

Run: `npx vitest run src/lib/__tests__/api-auth.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `api-auth.ts`**

- Add to the user `select` in `getAuthUser` and in `validateApiKey` (`src/lib/api-keys.ts`, the `user.select`): `organization: { select: { isActive: true, suspendedAt: true } }`.
- Add `orgStatus: OrgStatus` to `AuthUser` and set `orgStatus: resolveOrgStatus(dbUser.organization ?? null)` in both return objects.
- Replace every `throw new Error("Unauthorized")` with `throw new UnauthorizedError()`.
- Replace the guards' bodies:

```ts
/** Block every access for a locked-out org (past grace, or deactivated). */
export function assertOrgNotLocked(user: AuthUser): void {
  if (user.orgStatus === "locked_out") {
    throw new ForbiddenError("org_locked", "Organization suspended");
  }
}

export async function requireApiAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  assertOrgNotLocked(user);
  return user;
}

/**
 * Block writes while the org is read-only (grace period) or locked out.
 * Call in every mutating handler, next to requireNotDemoMode().
 */
export async function requireWritableOrg(user: AuthUser): Promise<void> {
  assertOrgNotLocked(user);
  if (user.orgStatus === "read_only") {
    throw new ForbiddenError(
      "org_read_only",
      "Organization is in read-only mode",
    );
  }
}
```

- `requirePlanFeature`: `throw new ForbiddenError("feature_not_entitled", \`This feature requires the ${required} plan. Please upgrade.\`)` (message unchanged; the boundary spec rewrites it later).
- `requireApiAdmin`: `throw new ForbiddenError("not_admin", "Admin access required")`.
- `requireSuperAdmin`: `throw new ForbiddenError("not_super_admin", "Super-admin access required")` (logic changes in Task 7).
- `requireApiCanRequest`: call `assertOrgNotLocked(user)` after `getAuthUser()`; throw `new ForbiddenError("request_permission", "Request permission required")`.
- `requirePermission`: replace the org query with `assertOrgNotLocked(user)`; `"API key lacks required scope"` uses `api_key_scope`; `"Insufficient permissions"` uses `insufficient_permission`; the `!user.id` case throws `UnauthorizedError`.
- Remove the now-unused imports `getOrgSuspensionStatus`, `requireActiveOrg` and `requireWriteAccess`.

Update `src/lib/__mocks__/api-auth.ts`: add `orgStatus: "active"` to `defaultAuthUser`, and add `export const assertOrgNotLocked = vi.fn();`.

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/lib/__tests__/api-auth.test.ts src/lib/__tests__/org-suspension.test.ts src/app/api/__tests__`
Expected: PASS. Route tests that assert `toThrow("Forbidden: …")` keep passing because messages are unchanged. Then run `npx tsc --noEmit -p .` and fix any caller that read the deleted exports (grep `requireActiveOrg\|requireWriteAccess` must return no hits outside tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/org-suspension.ts src/lib/api-auth.ts src/lib/api-keys.ts src/lib/__mocks__/api-auth.ts src/lib/__tests__/org-suspension.test.ts src/lib/__tests__/api-auth.test.ts
git commit -m "fix: load org status with the user and enforce lock in every guard"
```

---

### Task 3: Route sweep, error mapping and read-only write guard

**Files:**

- Modify: route files under `src/app/api/**/route.ts` (lists below)
- Create: `src/app/api/__tests__/route-conventions.test.ts`

**Interfaces:**

- Consumes: `apiErrorResponse` (Task 1), `requireWritableOrg`, `AuthUser` (Task 2).

This task is one mechanical pass so each route file is edited once. It is done in batches (one commit per batch of about 25 files, alphabetical by path).

- [ ] **Step 1: Write the convention test (fails until the sweep is done)**

```ts
// src/app/api/__tests__/route-conventions.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "..");
const THROWING_GUARDS =
  /\b(requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requirePlanFeature|requireApiCanRequest|getAuthUser)\s*\(/;
const MUTATING_EXPORT =
  /export\s+(?:async\s+)?(?:function\s+|const\s+)(POST|PUT|PATCH|DELETE)\b/g;

/**
 * Mutating handlers that must stay usable while an org is read-only or
 * locked, or that do not act on org data. Paths relative to src/app/api.
 */
const WRITE_GUARD_EXEMPT = new Set([
  "auth/[...all]/route.ts",
  "auth/register/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
  "auth/set-password/route.ts",
  "auth/change-password/route.ts",
  "auth/sessions/[id]/route.ts",
  "auth/sessions/revoke-all/route.ts",
  "auth/callback/saml/route.ts",
  "setup/route.ts",
  "billing/webhook/route.ts",
  "billing/portal/route.ts",
  "billing/checkout/route.ts",
  "user/preferences/route.ts",
  "user/notification-preferences/route.ts",
  "asset/qrcode/bulk/route.ts",
  "labels/pdf/route.ts",
  "route.ts",
  "admin/settings/email/test/route.ts",
  "admin/settings/freshdesk/test/route.ts",
  "admin/settings/ldap/test/route.ts",
  "admin/settings/integrations/test/route.ts",
  "admin/settings/intune/test/route.ts",
  "admin/settings/storage/test/route.ts",
  "scim/v2/Users/route.ts",
  "scim/v2/Users/[id]/route.ts",
  "team/invite/[token]/route.ts",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

const files = routeFiles(API_DIR).map((full) => ({
  rel: path.relative(API_DIR, full),
  src: readFileSync(full, "utf8"),
}));

describe("API route conventions", () => {
  it("maps guard errors through apiErrorResponse", () => {
    const offenders = files
      .filter((f) => THROWING_GUARDS.test(f.src))
      .filter((f) => !f.src.includes("apiErrorResponse("))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("calls requireWritableOrg in every mutating handler", () => {
    const offenders = files
      .filter((f) => !WRITE_GUARD_EXEMPT.has(f.rel))
      .filter((f) => [...f.src.matchAll(MUTATING_EXPORT)].length > 0)
      .filter(
        (f) =>
          (f.src.match(/requireWritableOrg\(/g)?.length ?? 0) <
          [...f.src.matchAll(MUTATING_EXPORT)].length,
      )
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("keeps the exemption list honest (every entry exists)", () => {
    const rels = new Set(files.map((f) => f.rel));
    expect([...WRITE_GUARD_EXEMPT].filter((r) => !rels.has(r))).toEqual([]);
  });
});
```

Run: `npx vitest run src/app/api/__tests__/route-conventions.test.ts`
Expected: FAIL, listing the offenders. That list is the work list for this task. Exempt entries that do not exist yet must be corrected to the real paths before continuing (third test).

- [ ] **Step 2: Apply the two edits to each offending file**

**Edit A, error mapping:** in every `catch (error)` of a handler that calls a throwing guard, make the first statements:

```ts
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    // ...existing handling unchanged (logging, 404/409, final 500)
```

Import: `import { apiErrorResponse } from "@/lib/errors";`. Remove the now-redundant `"Unauthorized"`/`"Forbidden"` string checks in the same catch block. Keep any non-auth branches (Zod 400, P2025 404, P2002 409, concurrency 409). If a catch block names its variable differently (`e`, `err`), use that name. Routes that respond with `new Response(JSON.stringify(...))` still `return denied` (a `NextResponse` is a `Response`).

**Edit B, write guard:** in every exported `POST`/`PUT`/`PATCH`/`DELETE` handler of a non-exempt file, immediately after the guard call that returns the user, add `await requireWritableOrg(user);`. If the guard result is not captured (`await requireApiAdmin();`), capture it (`const user = await requireApiAdmin();`; use the existing variable name if one exists, e.g. `authUser`). Place it after `requireNotDemoMode()` handling and before any DB write. Import `requireWritableOrg` from `@/lib/api-auth`.

Handlers in non-exempt files that authenticate with raw `auth.api.getSession` (`organizations/[id]`, `roles`, `roles/[id]`, `stock-alerts`, `stock-alerts/[id]`, `webhooks/[id]`, `notifications`, `notifications/[id]`, `tickets/[id]`) are converted in Task 4. Skip them here and leave them in the offender list until Task 4.

- [ ] **Step 3: Run tests per batch**

Run: `npx vitest run src/app/api/__tests__ src/lib/__tests__` and `npx tsc --noEmit -p .`
Expected: PASS except the convention test entries for the Task 4 files.

- [ ] **Step 4: Commit per batch**

```bash
git add src/app/api src/app/api/__tests__/route-conventions.test.ts
git commit -m "fix: map guard denials to 401/403 and block writes for read-only orgs (batch N)"
```

---

### Task 4: Raw-session routes moved onto the guards; organization updates

**Files:**

- Modify: `src/app/api/organizations/[id]/route.ts`, `src/lib/validation-organization.ts`, `src/app/api/roles/route.ts`, `src/app/api/roles/[id]/route.ts`, `src/app/api/stock-alerts/route.ts`, `src/app/api/stock-alerts/[id]/route.ts`, `src/app/api/webhooks/[id]/route.ts`, `src/app/api/notifications/route.ts`, `src/app/api/notifications/[id]/route.ts`, `src/app/api/tickets/[id]/route.ts`, `src/app/api/tickets/route.ts` (Freshdesk helper), `src/app/api/auth/change-password/route.ts`
- Test: `src/app/api/__tests__/organizations-id.test.ts` (create)

**Interfaces:**

- Consumes: `requireApiAuth`, `requireApiAdmin`, `requireSuperAdmin`, `requireWritableOrg`, `apiErrorResponse`.
- Produces: `updateOrganizationSchema` without `isActive`; `organizationAdminUpdateSchema = updateOrganizationSchema.extend({ isActive: z.boolean().optional() })` in `validation-organization.ts`.

Mapping (session check → guard): `session.user.isadmin` checks become `requireApiAdmin()`. Plain session checks become `requireApiAuth()`. `auth/change-password` uses `getAuthUser()`, because a locked user may still change their password. Each mutating handler then calls `requireWritableOrg(user)` (except change-password, which is exempt in Task 3). Every catch uses `apiErrorResponse`.

- [ ] **Step 1: Write the failing test for the organization route**

```ts
// src/app/api/__tests__/organizations-id.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE", DELETE: "DELETE" },
  AUDIT_ENTITIES: { ORGANIZATION: "organization" },
}));

import { PUT } from "@/app/api/organizations/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireSuperAdmin } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);
const params = { params: Promise.resolve({ id: "org-uuid-001" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: "org-uuid-001",
    slug: "acme",
  } as any);
  mockPrisma.organization.update.mockImplementation(async ({ data }: any) => ({
    id: "org-uuid-001",
    ...data,
  }));
  vi.mocked(requireSuperAdmin).mockRejectedValue(
    new ForbiddenError("not_super_admin", "Super-admin access required"),
  );
});

describe("PUT /api/organizations/[id]", () => {
  it("does not let an org admin change isActive", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme", isActive: true },
    });
    await PUT(req, params);
    const data = mockPrisma.organization.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("isActive");
  });

  it("does not silently set isActive when the body omits it", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    await PUT(req, params);
    expect(
      mockPrisma.organization.update.mock.calls[0][0].data,
    ).not.toHaveProperty("isActive");
  });

  it("lets a super-admin change isActive of another org", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({
      id: "sa",
      isAdmin: true,
      organizationId: "other",
      orgStatus: "active",
    } as any);
    vi.mocked(requireApiAdmin).mockResolvedValue({
      id: "sa",
      isAdmin: true,
      organizationId: "other",
      orgStatus: "active",
    } as any);
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { isActive: false },
    });
    const res = await PUT(req, params);
    expect((await parseResponse(res)).status).toBe(200);
    expect(mockPrisma.organization.update.mock.calls[0][0].data).toMatchObject({
      isActive: false,
    });
  });

  it("rejects an org admin editing another org with 404", async () => {
    const req = createMockRequest("/api/organizations/other-org", {
      method: "PUT",
      body: { name: "X" },
    });
    const res = await PUT(req, {
      params: Promise.resolve({ id: "other-org" }),
    });
    expect((await parseResponse(res)).status).toBe(404);
  });
});
```

Run: `npx vitest run src/app/api/__tests__/organizations-id.test.ts`. Expected: FAIL. Adjust the route's export signature in the test if the handler reads `params` differently: read the file first.

- [ ] **Step 2: Implement the organization changes**

In `validation-organization.ts`:

- Remove `isActive` from `organizationSchema`, so `.partial()` can no longer inject `default(true)`.
- Export `organizationAdminUpdateSchema` as described above.

In `organizations/[id]/route.ts`:

- Every method uses `requireApiAdmin()`.
- A caller may act on another org only if `requireSuperAdmin()` passes. Probe it with `try/catch` and answer 404 otherwise, as GET already does.
- PUT parses with `organizationAdminUpdateSchema` when the caller is a super-admin, otherwise with `updateOrganizationSchema`.
- PUT and DELETE call `requireWritableOrg(user)` only when the caller acts on their own org; a super-admin may re-activate a locked org.
- The audit entry stores the parsed object.

In `OrganizationsTab.tsx`, the active-badge toggle stays; it only works for super-admins now (the tab is super-admin only, see Task 8).

- [ ] **Step 3: Convert the other raw-session files**

Mapping as above. Keep each handler's existing ownership checks (own notifications by `userId`; roles, stock alerts and webhooks by `organizationId`). Replace `session.user.id` with `user.id` and `session.user.organizationId` with `user.organizationId`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/api/__tests__ src/lib/__tests__` and `npx tsc --noEmit -p .`
Expected: PASS, and the convention test from Task 3 is now fully green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/lib/validation-organization.ts src/app/admin/settings/ui/OrganizationsTab.tsx
git commit -m "fix: move raw-session routes onto guards and stop tenants changing org status"
```

---

### Task 5: SCIM checks the token org's status

**Files:**

- Modify: `src/lib/scim.ts` (`authenticateScim`)
- Test: `src/app/api/__tests__/scim-users.test.ts` (extend)

**Interfaces:**

- Consumes: `getOrgSuspensionStatus` (Task 2).
- Produces: `authenticateScim` returns the existing failure shape when the token's org is `locked_out` (all methods) or `read_only` (non-GET).

- [ ] **Step 1: Failing tests** in `scim-users.test.ts`:
  - mock `@/lib/org-suspension` `getOrgSuspensionStatus`;
  - POST with a `read_only` org returns 403 (SCIM error body via `scimError`);
  - GET with a `locked_out` org returns 403;
  - GET with a `read_only` org returns 200.
- [ ] **Step 2: Implement.** After the token resolves to `organizationId`:

```ts
const status = await getOrgSuspensionStatus(organizationId);
if (status === "locked_out" || (status === "read_only" && method !== "GET")) {
  return {
    ok: false as const,
    response: scimError(403, "Organization suspended"),
  };
}
```

Pass the request method into `authenticateScim(request)`; read it from `request.method`. Match the function's existing return shape; read `scim.ts` first.

- [ ] **Step 3:** Run `npx vitest run src/app/api/__tests__/scim-users.test.ts`. PASS.
- [ ] **Step 4: Commit** `fix: enforce org suspension on SCIM requests`.

---

### Task 6: Locked orgs redirected to `/suspended`; billing reachable when suspended

**Files:**

- Create: `src/lib/org-lock-redirect.ts`, `src/lib/__tests__/org-lock-redirect.test.ts`
- Modify: `src/proxy.ts`, `src/app/suspended/page.tsx`, `src/components/AppShell.tsx`, `src/app/api/billing/portal/route.ts`, `src/app/api/billing/checkout/route.ts`
- Test: `src/app/api/__tests__/billing-portal.test.ts` (create)

**Interfaces:**

- Produces:
  - `shouldCheckOrgLock(pathname: string, isPublicRoute: boolean): boolean`: true for page requests only (not `/api`, `/_next`, `/monitoring`, `/suspended`, public routes, static files).
  - `getLockedRedirect(req: NextRequest): Promise<URL | null>`: resolves the session via `auth.api.getSession({ headers: req.headers })` (cookie cache), reads the user's org with one `prisma.user.findUnique({ where: { userid }, select: { organization: { select: { isActive: true, suspendedAt: true } } } })`, and returns `new URL("/suspended", req.url)` when `resolveOrgStatus(...) === "locked_out"`, else `null`. Any error returns `null` and is logged (fail open for pages; API guards still block).

- [ ] **Step 1: Failing tests** for `shouldCheckOrgLock`:
  - `/assets` gives true;
  - `/api/assets`, `/suspended`, `/login`, `/_next/x` and `/monitoring` give false.

  For `getLockedRedirect`, with `@/lib/auth` and `@/lib/prisma` mocked:
  - no session gives null;
  - an active org gives null;
  - a locked org gives a URL ending in `/suspended`;
  - `getSession` throwing gives null.

- [ ] **Step 2: Implement** `src/lib/org-lock-redirect.ts` as specified.
- [ ] **Step 3: Wire into `src/proxy.ts`.** After the logged-out redirect block and before the final `return nextWithNonce()`:

```ts
if (isLoggedIn && shouldCheckOrgLock(pathname, isPublicRoute)) {
  const lockedUrl = await getLockedRedirect(req);
  if (lockedUrl) return withHeaders(NextResponse.redirect(lockedUrl));
}
```

`proxy.ts` runs on the Node.js runtime (Next 16 default). If `next build` reports that `@/lib/auth` or Prisma cannot be bundled into the proxy, stop and use the spec's fallback instead:

- `getOrganizationContext()` returns `orgStatus`;
- `strictOrgWhere()` in `src/lib/data.ts` calls `redirect("/suspended")` for `locked_out`;
- the 24 raw-session pages call a new `await redirectIfOrgLocked()` helper.

- [ ] **Step 4: `/suspended` page.**
  - Add `/suspended` to `PUBLIC_ROUTES` in `AppShell.tsx`, so it renders without app chrome.
  - The page (server component) reads the session.
  - For a signed-in admin, show a `<form method="post" action="/api/billing/portal">` "Manage subscription" button when `process.env.STRIPE_SECRET_KEY` is set, otherwise the text "Contact your administrator or support to reactivate this organization."
  - Always show a sign-out button: a small client component calling `signOut()` from `@/lib/auth-client`, then `router.push("/login")`.
  - Remove the broken `<Link href="/api/billing/portal">` and the "Back to Login" link.
- [ ] **Step 5: Billing routes.** In `billing/portal` and `billing/checkout`, replace `requireApiAuth()` with `getAuthUser()` plus `if (!user.isAdmin) throw new ForbiddenError("not_admin", "Admin access required")`.
  - This lets a read-only or locked admin pay.
  - Use `apiErrorResponse` in the catch.
  - The portal accepts a form POST: when the request's `content-type` is `application/x-www-form-urlencoded`, answer `NextResponse.redirect(session.url, 303)` instead of JSON.
  - Test in `billing-portal.test.ts`, with `@/lib/stripe` mocked:
    - a locked-org admin gets a 303 redirect (form) or 200 JSON;
    - a non-admin gets 403 `not_admin`.
- [ ] **Step 6:** Run `npx vitest run src/lib/__tests__/org-lock-redirect.test.ts src/app/api/__tests__/billing-portal.test.ts`, then `npx next build` (proxy bundling check). PASS.
- [ ] **Step 7: Commit** `fix: redirect locked orgs to /suspended and keep billing reachable`.

---

### Task 7: Super-admin fails closed and cannot be claimed by email

**Files:**

- Create: `src/lib/super-admin.ts`, `src/lib/email-ownership.ts`, `src/lib/__tests__/super-admin.test.ts`, `src/lib/__tests__/email-ownership.test.ts`
- Modify: `src/lib/api-auth.ts` (`requireSuperAdmin`), `src/app/admin/settings/page.tsx` (super-admin flag), and the email writers `src/app/api/user/route.ts` (PUT), `src/app/api/user/addUser/route.ts`, `src/app/api/import/route.ts` (user rows), `src/app/api/scim/v2/Users/route.ts`, `src/app/api/scim/v2/Users/[id]/route.ts`, `src/app/api/team/invite/[token]/route.ts`, `src/lib/ldap.ts`

**Interfaces:**

- Produces:
  - `super-admin.ts`: `getSuperAdminEmails(): string[]` (lower-cased, trimmed, empty entries dropped); `isSuperAdmin(user: { id?: string; email?: string | null }): Promise<boolean>`.
  - `email-ownership.ts`: `normalizeEmail(email: string): string` (trim + lower-case); `assertEmailAssignable(email: string, opts: { excludeUserId?: string; callerIsSuperAdmin: boolean }): Promise<string>`. It returns the normalised email or throws `EmailConflictError` (`class EmailConflictError extends AppError`, status 409, message `"Email is already in use"`) or `ForbiddenError("not_super_admin", "This email address is reserved")`.

`isSuperAdmin` rules:

1. `getSuperAdminEmails()` is non-empty:
   - the email must be listed; then
   - `prisma.user.count({ where: { email: { equals: user.email, mode: "insensitive" } } }) === 1`.
2. The list is empty: true only when `prisma.organization.count() <= 1`.

- [ ] **Step 1: Failing tests (`super-admin.test.ts`, prisma mocked)**
  - env set, listed, unique: true;
  - env set, listed but a case-variant duplicate exists (count 2): false;
  - env set, not listed: false;
  - env unset, 1 org: true;
  - env unset, 2 orgs: false;
  - env with blanks (`" , a@x.io ,"`): `getSuperAdminEmails()` equals `["a@x.io"]`.
- [ ] **Step 2: Failing tests (`email-ownership.test.ts`)**
  - `normalizeEmail(" A@B.io ")` gives `"a@b.io"`;
  - an existing other user with `A@b.io` (`findFirst` with `mode: "insensitive"` returns a row) throws a 409;
  - the same user (`excludeUserId`) passes;
  - a listed super-admin address with `callerIsSuperAdmin: false` throws `not_super_admin`;
  - with `true` it passes.
- [ ] **Step 3: Implement both modules.** `requireSuperAdmin()` becomes:

```ts
export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireApiAdmin();
  if (!(await isSuperAdmin(user))) {
    throw new ForbiddenError("not_super_admin", "Super-admin access required");
  }
  return user;
}
```

`admin/settings/page.tsx` replaces its inline check with `await isSuperAdmin({ id: session.user.id, email: dbUser.email })`, where the email comes from the DB, not the session.

- [ ] **Step 4: Wire `assertEmailAssignable` into every email writer** listed under Files. Call it before the write with `callerIsSuperAdmin: await isSuperAdmin(caller)`; SCIM, LDAP and invite-accept pass `false`. Map `EmailConflictError` to 409 `{ error }` in those routes (SCIM uses `scimError(409, ...)`). LDAP sync logs and skips the user instead of failing the run.
- [ ] **Step 5: Update `api-auth.test.ts` super-admin tests** to mock `@/lib/super-admin` (`isSuperAdmin`) and assert a denial carries `code: "not_super_admin"`.
- [ ] **Step 6:** Run `npx vitest run src/lib/__tests__/super-admin.test.ts src/lib/__tests__/email-ownership.test.ts src/lib/__tests__/api-auth.test.ts src/app/api/__tests__/user-crud.test.ts src/app/api/__tests__/scim-users.test.ts` and `npx tsc --noEmit -p .`. PASS.
- [ ] **Step 7: Commit** `fix: make super-admin fail closed and protect email ownership`.

---

### Task 8: Platform settings visible and writable only by super-admins

**Files:**

- Create: `src/lib/settings-keys.ts`, `src/lib/__tests__/settings-keys.test.ts`
- Modify: `src/app/admin/settings/page.tsx`, `src/app/admin/settings/ui/AdminSettingsPage.tsx`, `src/app/api/admin/settings/{sso,ldap,intune,integrations}/route.ts`, `src/app/api/tickets/route.ts`, `src/app/api/tickets/[id]/route.ts`

**Interfaces:**

- Produces: `ALLOWED_SETTING_KEYS: Record<'sso' | 'ldap' | 'intune' | 'integrations', ReadonlySet<string>>`; `partitionSettingKeys(group, keys: string[]): { allowed: string[]; rejected: string[] }`; `MASKED_VALUE = "********"`.

- [ ] **Step 1: Build the allow-lists from the code.** For each group, collect the keys the matching settings tab sends (`grep` the tab components for `key:` / setting keys) and the keys the library reads (`src/lib/sso.ts`, `ldap.ts`, `integrations/intune.ts`, `integrations/slack-teams.ts`). The allow-list is their union. `sso.token.*` is never allowed.
- [ ] **Step 2: Failing tests (`settings-keys.test.ts`)**
  - known keys are allowed;
  - `deployment.mode`, `sso.token.abc` and `scim.bearerToken` are rejected for every group;
  - the masked value is recognised.
- [ ] **Step 3: Routes.** Each PUT validates its body with zod (`z.object({ settings: z.array(z.object({ key: z.string(), value: z.string().nullable() })) })`, or the route's current shape) and calls `partitionSettingKeys`.
  - Any rejected key returns 400 `{ error: "Unknown setting keys", keys }`.
  - A value equal to `MASKED_VALUE` is skipped, never stored.
  - Remove `requirePlanFeature(user, "sso")` and `requirePlanFeature(user, "ldap")` (operator-level now).
  - The GET in `sso` filters out `sso.token.` rows.
- [ ] **Step 4: Settings page.** In `page.tsx`, compute `isSuperAdmin` (Task 7).
  - `getSystemSettings()` is called only when true; otherwise pass `settings={}`.
  - Exclude `settingKey` starting with `sso.token.`.
  - Load status types with `where: { organizationId: <caller's org> }`.
  - Custom field definitions are scoped in Task 11.
  - In `AdminSettingsPage.tsx`, the platform tabs (General, Email, Freshdesk, Notifications, SSO, LDAP, Intune, Integrations, Organizations) are in a `SUPER_ADMIN_ONLY_TABS` set:
    - filtered from the nav;
    - not rendered when `!isSuperAdmin`, even when `?tab=` selects them (fall back to the first allowed tab).
- [ ] **Step 5: Freshdesk.** In `tickets/route.ts`, the `source=freshdesk` branch and the Freshdesk helper call `requireSuperAdmin()`. Same in the Freshdesk branch of `tickets/[id]` GET.
- [ ] **Step 6:** Run `npx vitest run src/lib/__tests__/settings-keys.test.ts` and `npx tsc --noEmit -p .`. Then add one route test (`src/app/api/__tests__/settings-sso.test.ts`) that a PUT with `deployment.mode` returns 400 and nothing is upserted. PASS.
- [ ] **Step 7: Commit** `fix: restrict platform settings to super-admins and allow-list setting keys`.

---

### Task 9: Signup closed by default; invites hardened

**Files:**

- Create: `src/lib/signup.ts`
- Modify: `src/app/api/auth/register/route.ts`, `src/app/register/page.tsx`, `src/lib/auth-server.ts` (`emailAndPassword.disableSignUp: true`), `src/app/api/team/invite/route.ts`, `src/app/api/team/invite/[token]/route.ts`, `src/app/invite/[token]/page.tsx`, `.env.example`, `README.md`, `docs/DEPLOYMENT.md`, `docs/HOSTING_GUIDE.md`, `docs/index.html`
- Test: `src/app/api/__tests__/auth-register.test.ts` (extend), `src/app/api/__tests__/team-invite-accept.test.ts` (create)

**Interfaces:**

- Produces: `isPublicSignupEnabled(): boolean` (returns `process.env.ALLOW_PUBLIC_SIGNUP === "true"`).

- [ ] **Step 1: Failing tests (register).**
  - In `beforeEach` set `process.env.ALLOW_PUBLIC_SIGNUP = "true"`, and delete it in `afterEach`.
  - New test: with the variable unset, POST returns 404 and `checkRateLimit` is not called.
- [ ] **Step 2: Implement.**
  - `register/route.ts`: first line of `POST` is `if (!isPublicSignupEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });`.
  - `register/page.tsx`: `if (!isPublicSignupEnabled()) redirect("/login");`.
  - `auth-server.ts`: add `disableSignUp: true` to `emailAndPassword` and keep the hook throw.
- [ ] **Step 3: Failing tests (invite accept, `team-invite-accept.test.ts`).**
  - A `cancelled` invite returns 410/400 (match the route's existing rejected-invite status).
  - An existing user from org A accepting into org B is updated with `isadmin: false`.
  - Their `userRole` rows for roles not in org B are deleted.
  - Accept when `checkUserLimit()` is not allowed returns 403.
- [ ] **Step 4: Implement invites.**
  - `findAndValidateInvitation` and the page accept only `status === "pending"`.
  - `team/invite` POST: `roleId` must satisfy `prisma.role.findFirst({ where: { id: roleId, organizationId: user.organizationId } })`, else 400.
  - Accept, existing-user branch, when `user.organizationId !== invitation.organizationId`, in one transaction:
    - set `organizationId` and `isadmin: false`;
    - `deleteMany` user roles whose role is in another org.
  - Both accept branches call `checkUserLimit()`. Read `tenant-limits.ts`: it resolves the org from the session, so pass the invite's org by adding an optional `organizationId?: string` parameter to `checkUserLimit` and `checkAssetLimit` that wins over the session context.
- [ ] **Step 5: Docs and env.**
  - `.env.example`: `# ALLOW_PUBLIC_SIGNUP=true  # open /register (SaaS). Default: closed`.
  - Fix the "SELF_HOSTED disables registration" statements in `README.md:269`, `docs/index.html:784,1038` and `docs/DEPLOYMENT.md` / `HOSTING_GUIDE.md` to describe `ALLOW_PUBLIC_SIGNUP`.
- [ ] **Step 6:** Run `npx vitest run src/app/api/__tests__/auth-register.test.ts src/app/api/__tests__/team-invite-accept.test.ts src/lib/__tests__/tenant-limits.test.ts`. PASS.
- [ ] **Step 7: Commit** `fix: close public signup by default and harden invite acceptance`.

---

### Task 10: Migration, workflows and custom fields per organization

**Files:**

- Create: `prisma/migrations/20261007_scope_automation_custom_fields/migration.sql`, `src/lib/__tests__/scope-automation-migration.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**

- Produces: `AutomationRule.organizationId String? @db.Uuid` with relation `organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)` and `@@index([organizationId])`; the same on `custom_field_definitions`; back-relations `automationRules AutomationRule[]` and `customFieldDefinitions custom_field_definitions[]` on `Organization`.

- [ ] **Step 1: Schema.** Add the fields above. Run `npx prisma validate` and `npx prisma generate` (no DB access).
- [ ] **Step 2: Migration SQL.** Write `migration.sql`:
  - `ALTER TABLE "public"."automation_rules" ADD COLUMN "organizationId" UUID;` and the same for `custom_field_definitions`;
  - then the backfill between the exact marker lines `-- BACKFILL START` and `-- BACKFILL END`;
  - then the two FKs (`ON DELETE CASCADE ON UPDATE CASCADE`) and two indexes (`automation_rules_organizationId_idx`, `custom_field_definitions_organizationId_idx`).

  Use the `DO $$` backfill from the research note (one block):
  - 0 orgs: return.
  - 1 org: assign everything.
  - Several orgs:
    - rules get the creator's org; creator without org means the rule stays NULL with `isActive = false`;
    - definitions come from the entities holding their values (asset, accessories, consumable, licence, components, kits), with a clone per additional org and values repointed;
    - `RAISE NOTICE` the unscoped definition count.

  Use only `"public"."..."` qualified names, no `'public'` literals (`set-schema.mjs` rewrites the schema).

- [ ] **Step 3: Failing DB test (`scope-automation-migration.test.ts`, `describeDb`).** It reads `migration.sql` and extracts the text between the markers. Inside `prisma.$transaction(async (tx) => { ...; throw ROLLBACK })` it:
  - inserts 2 orgs, users per org, 1 org-less user, 2 rules (one per org creator), 1 rule by the org-less user;
  - inserts definition D used by assets of both orgs, and definition U unused;
  - nulls `organizationId` on those rows;
  - runs the block with `tx.$executeRawUnsafe(block)`;
  - asserts:
    - each rule has its creator's org;
    - the org-less rule is NULL and inactive;
    - D now exists twice (one per org) with each org's values pointing at its own copy;
    - U is NULL.

  A second test covers a single org: everything assigned. Roll back by throwing a sentinel error and catching it.

- [ ] **Step 4:** If a local throwaway Postgres is available, run `DATABASE_URL=<throwaway> DB_SCHEMA=public npx prisma migrate deploy` and then the test. Otherwise CI runs it. Never point this at the configured `.env` database.
- [ ] **Step 5: Commit** `feat: scope automation rules and custom field definitions to organizations`.

---

### Task 11: Custom fields and workflow routes and pages scoped

**Files:**

- Modify: `src/app/api/admin/workflows/route.ts`, `src/app/api/admin/workflows/[id]/route.ts`, `src/app/api/admin/custom-fields/route.ts`, `src/app/api/admin/custom-fields/[id]/route.ts`, `src/app/api/custom-fields/values/route.ts`, `src/app/api/search/advanced/route.ts`, `src/app/assets/[id]/page.tsx`, `src/app/admin/settings/page.tsx`, `src/lib/validation.ts`
- Test: `src/app/api/__tests__/workflows-scope.test.ts`, `src/app/api/__tests__/custom-fields-scope.test.ts` (create)

**Interfaces:**

- Consumes: schema from Task 10; `createAutomationRuleSchema` (existing, `validation.ts:307`).
- Produces: `createCustomFieldDefinitionSchema` in `validation.ts` with `entityType` restricted to the keys of `entity-registry` and `fieldType` restricted to the values the admin UI offers (read `CustomFieldsAdminTab.tsx`).

Rules:

- Scope: `const orgId = user.organizationId;`. When `!orgId`, list routes return `[]` and id routes return 404.
- List: `findMany({ where: { organizationId: orgId } })`.
- By id: `findFirst({ where: { id, organizationId: orgId } })`, then 404 if null; update and delete use `{ id }` only after that check.
- Create sets `organizationId: orgId` and validates with the schemas.
- Values GET: definitions `{ entityType, isActive: true, organizationId: orgId }`.
- Values POST:

```ts
const fieldIds = values.map((v) => v.fieldId);
const fields = await prisma.custom_field_definitions.findMany({
  where: {
    id: { in: fieldIds },
    organizationId: orgId,
    entityType,
    isActive: true,
  },
  select: { id: true },
});
const allowed = new Set(fields.map((f) => f.id));
const foreign = fieldIds.filter((id) => !allowed.has(id));
if (foreign.length > 0) {
  return NextResponse.json(
    { error: "Unknown custom fields", fieldIds: foreign },
    { status: 400 },
  );
}
```

- `search/advanced`: before the values lookup, intersect the requested field IDs with the org's definition IDs and ignore the rest.
- Pages: `assets/[id]/page.tsx` and `admin/settings/page.tsx` add `organizationId: <org>` to the definition queries. An org-less viewer gets none.

- [ ] **Step 1: Failing tests** (prisma and api-auth mocked):
  - **workflows:**
    - GET returns only `where.organizationId === "org-uuid-001"` results (assert the `findMany` args);
    - GET `[id]` of another org returns 404;
    - POST stores `organizationId`;
    - an org-less admin (`organizationId: undefined`) gets `[]`.
  - **custom fields:** the same four cases, plus values POST with a foreign `fieldId` returns 400 and `upsert` is not called.
- [ ] **Step 2: Implement** per the rules.
- [ ] **Step 3:** Run both new tests, the convention test and `npx tsc --noEmit -p .`. PASS.
- [ ] **Step 4: Commit** `fix: scope workflow and custom field routes to the caller's organization`.

---

### Task 12: Workflow engine runs per organization

**Files:**

- Modify: `src/lib/workflow-engine.ts`, `src/lib/webhooks.ts` (`triggerWebhook`), `src/app/api/cron/workflows/route.ts` (only if the signature change requires it)
- Test: `src/lib/__tests__/workflow-engine.test.ts` (create), `src/lib/__tests__/webhooks-trigger.test.ts` (create)

**Interfaces:**

- Produces: `processWorkflowTrigger(trigger: WorkflowTrigger, data: Record<string, unknown>, organizationId: string): Promise<{ executed: number; errors: string[] }>`; `triggerWebhook(event, data, organizationId?)` where a missing org means global webhooks only.

Rules:

- Rules query: `{ trigger, isActive: true, organizationId }`.
- Skip when `await getOrgSuspensionStatus(organizationId) === "locked_out"`, memoised per run in a `Map`.
- Cron scans:
  - `asset`, `licence` and `consumable` select `organizationId`; `maintenance_schedules` uses `asset.organizationId`;
  - rows with a null org are skipped;
  - each call passes the org.
- Action constraints (a violation throws `Error("Action not allowed for this organization")`, which the per-rule catch records in `errors`):
  - `update_status`: `prisma.asset.findFirst({ where: { assetid, organizationId } })` and `prisma.statusType.findFirst({ where: { statustypeid: config.statusId, organizationId } })` must both exist; the update uses `updateMany({ where: { assetid, organizationId } })`.
  - `send_notification`: `prisma.user.findFirst({ where: { userid: config.userId, organizationId } })`.
  - `create_ticket`: the creator user must be in the org (same check).
  - `trigger_webhook`: `config.event` must be in `WEBHOOK_EVENTS`; call `triggerWebhook(event, data, organizationId)`.
- `send_email`: `config.to` must be a valid email (zod `z.string().email()`). Data is the org's own, so no further check.
- `triggerWebhook` org filter:

```ts
where: {
  isActive: true,
  events: { has: event },
  ...(organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : { organizationId: null }),
},
```

- [ ] **Step 1: Failing tests (`webhooks-trigger.test.ts`).**
  - Without an org, `findMany` is called with `where.organizationId === null` and no `OR`.
  - With an org, the `OR` contains the org and `null`.
- [ ] **Step 2: Failing tests (`workflow-engine.test.ts`, prisma mocked).**
  - The rules query includes `organizationId`.
  - A locked org runs no rules.
  - `update_status` on another org's asset records an error and does not update.
  - `trigger_webhook` with an unknown event records an error.
  - `runScheduledWorkflows` skips rows with a null `organizationId` and passes each row's org.
- [ ] **Step 3: Implement.** Also fix the per-rule `runCount` increment to `{ increment: 1 }`.
- [ ] **Step 4:** Run both tests and `npx tsc --noEmit -p .`. PASS.
- [ ] **Step 5: Commit** `fix: run workflow rules per organization and constrain their actions`.

---

### Task 13: Offline queue keeps denied changes and never crosses users

**Files:**

- Create: `public/sw-queue-rules.js` (pure function, loaded by `sw.js` with `importScripts`), `src/lib/__tests__/sw-queue-rules.test.ts`, `src/lib/__tests__/offline-queue.test.ts`
- Modify: `public/sw.js`, `src/lib/offline-queue.ts`, `src/hooks/useOfflineQueue.ts`, `src/components/OfflineSyncIndicator.tsx`, `src/components/Sidebar.tsx` and `src/components/MobileNav.tsx` (sign-out), `mobile/src/services/sync.ts`

**Interfaces:**

- Produces:
  - `sw-queue-rules.js`: `self.shouldQueue = function (method, pathname, headers)`. It returns `true` only for `POST|PUT|PATCH|DELETE` on `/api/` paths that are not `/api/auth/` and are not multipart, and only when the request has no `x-offline-replay` header. Also `self.pickHeaders = function (headers)`, which keeps `content-type`, `accept` and `x-expected-version`.
  - `offline-queue.ts`:
    - `QueuedMutation` gains `userId: string | null`, `status?: 'pending' | 'blocked'`, `lastStatus?: number`, `lastCode?: string`, `lastError?: string`.
    - `type ReplayOutcome = 'succeeded' | 'blocked' | 'dropped' | 'retry'`.
    - `classifyReplayStatus(status: number): ReplayOutcome`: 2xx gives succeeded; 401, 403, 409 and 422 give blocked; 400 and 404 give dropped; 429 and 5xx give retry.
    - `replayQueue(currentUserId: string): Promise<{ succeeded: number; blocked: number; dropped: number; failed: number }>`.
    - `clearOfflineQueue(): Promise<void>`.
    - `discardMutation(id: string): Promise<void>`.

The service worker cannot know the user. The page passes it: `useOfflineQueue` posts `{ type: 'SET_USER', userId }` to the SW controller on mount and on session change, the SW keeps it in a module variable, and it stamps it on new entries.

- [ ] **Step 1: Failing tests (`sw-queue-rules.test.ts`).** Load the file with `vm.runInNewContext(readFileSync('public/sw-queue-rules.js','utf8'), { self: ctx })`. Cases:
  - a POST to `/api/assets` is queued;
  - GET, HEAD and OPTIONS are not;
  - `/api/auth/sign-in/email` is not;
  - `multipart/form-data` is not;
  - a request carrying `x-offline-replay` is not;
  - `pickHeaders` drops `cookie` and `authorization`.
- [ ] **Step 2: Failing tests (`offline-queue.test.ts`, `// @vitest-environment happy-dom`, `vi.mock("idb-keyval")` with an in-memory `Map`).**
  - Table-driven `classifyReplayStatus` over 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503.
  - `replayQueue("u1")`:
    - skips entries with `userId "u2"` (no fetch);
    - a 403 keeps the entry with `status: "blocked"`, `lastCode` from the JSON body and `lastStatus: 403`;
    - a 200 removes it;
    - a 404 removes it and counts it `dropped`;
    - a 503 increments `retryCount`, and at 3 the entry is removed and counted `failed`;
    - a 429 stops the loop.
    - Every replay fetch sends header `x-offline-replay: 1`.
  - `clearOfflineQueue()` empties the store.
- [ ] **Step 3: Implement.**
  - `sw.js`: `importScripts('/sw-queue-rules.js')`; use `self.shouldQueue(...)` and `self.pickHeaders(...)`; store `userId: currentUserId`; handle `message` events of type `SET_USER` and `CLEAR_QUEUE`.
  - Bump the SW cache name constant so clients pick up the new worker.
  - `offline-queue.ts` per the interfaces; `blocked` entries are not re-sent by `replayQueue`.
  - `useOfflineQueue`:
    - get the current user ID from `useSession()` (`@/lib/auth-client`) and post `SET_USER`;
    - toast `Synced N`, `N changes were rejected (review them)` and `N failed` separately;
    - expose `blockedItems` and `discard(id)`.
  - `OfflineSyncIndicator`: when blocked items exist, show a warning-styled button `N need review` that opens a popover listing method, path, status and message, with a Discard action per item.
  - Sign-out (`Sidebar.tsx`, `MobileNav.tsx`): `await clearOfflineQueue()` and post `CLEAR_QUEUE` before `signOut()`.
- [ ] **Step 4: Mobile.** In `mobile/src/services/sync.ts`, treat 401, 403, 409 and 422 as kept (not removed) with a `blocked` flag, and 400 and 404 as removed. Mirror the web table in a comment. No mobile tests exist; keep the change minimal and typed.
- [ ] **Step 5:** Run both new tests and `npx tsc --noEmit -p .`. Build check: `npx next build`. PASS.
- [ ] **Step 6: Commit** `fix: keep denied offline changes, bind the queue to the user and skip auth requests`.

---

### Task 14: Debt register, changelog, version, full verification

**Files:**

- Modify: `TECHNICAL_DEBT.md`, `CHANGELOG.md`, `package.json`

- [ ] **Step 1: `TECHNICAL_DEBT.md`.** Add one numbered item per "Out of scope" bullet of the spec. Follow the file's existing format, and include the evidence file:line from the spec's research.
- [ ] **Step 2: `CHANGELOG.md`.** Add a `## [0.14.0] - <date>` entry under `### Security`, one bullet per spec part P0-1 to P0-6. Add an **Upgrade notes** block:
  - set `ALLOW_PUBLIC_SIGNUP=true` for public signup;
  - set `SUPER_ADMIN_EMAILS` on multi-org deployments;
  - the migration notice lists unscoped custom fields;
  - rules without an org are deactivated.
- [ ] **Step 3:** Bump `package.json` `version` to `0.14.0`.
- [ ] **Step 4: Full verification.**
  - `npx tsc --noEmit -p .`
  - `npx eslint src`
  - `npx vitest run`
  - `npx next build`

  All must pass. Fix failures in the task that owns the code.

- [ ] **Step 5: Commit** `docs: record Phase 0 security release 0.14.0`.

---

## Self-review notes

- **Spec coverage:**
  - P0-1 is covered by Tasks 10, 11 and 12.
  - P0-2 by Tasks 7 and 8.
  - P0-3 by Task 9.
  - P0-4 by Tasks 2, 3, 4, 5 and 6.
  - P0-5 by Tasks 1 and 3.
  - P0-6 by Task 13.
  - The spec's out-of-scope items are recorded in Task 14.
  - The spec's "settings page sends status types of every org" is in Task 8 step 4.
- **Interface consistency:**
  - `AuthUser.orgStatus` is set in Task 2 and read in Tasks 3, 4 and 6.
  - `checkUserLimit(organizationId?)` gains its parameter in Task 9, and Task 9 is its only new caller in this plan.
  - `getOrgSuspensionStatus` is kept for Tasks 5, 6 and 12.
