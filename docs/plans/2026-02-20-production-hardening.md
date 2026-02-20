# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical and high-severity security issues to make the Asset Tracker production-ready.

**Architecture:** Add rate limiting to all auth endpoints, enforce MFA completion before API access, make cron secrets mandatory (fail-closed), fix org-scoping gaps in import and admin routes, and wire up environment validation at startup.

**Tech Stack:** Next.js 16, NextAuth v5, Prisma, in-memory rate limiter (existing `src/lib/rate-limit.ts`)

---

## Task 1: Rate-limit registration endpoint

**Files:**

- Modify: `src/app/api/auth/register/route.ts`

**Step 1: Add rate limiting to register**

At top of file, add imports:

```ts
import {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
} from "@/lib/rate-limit";
```

At the start of the `POST` function body (before `const body = await req.json()`), add:

```ts
const ip = getClientIP(req);
const rl = checkRateLimit(`register:${ip}`, {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 5 registrations per hour per IP
  message: "Too many registration attempts. Please try again later.",
});
if (!rl.success) {
  return createRateLimitResponse(
    rl,
    "Too many registration attempts. Please try again later.",
  );
}
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "fix(security): add rate limiting to registration endpoint"
```

---

## Task 2: Rate-limit MFA validation endpoint

**Files:**

- Modify: `src/app/api/auth/mfa/validate/route.ts`

**Step 1: Add rate limiting to MFA validate**

Add imports at top:

```ts
import {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
} from "@/lib/rate-limit";
```

At start of `POST` function body (before `const { token, ... }` destructuring), add:

```ts
const ip = getClientIP(req);
const rl = checkRateLimit(`mfa:${ip}`, {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 5 attempts per 15 min per IP
  message: "Too many MFA attempts. Please try again later.",
});
if (!rl.success) {
  return createRateLimitResponse(
    rl,
    "Too many MFA attempts. Please try again later.",
  );
}
```

Also add per-user rate limiting after `pendingUserId` is validated:

```ts
const userRl = checkRateLimit(`mfa:user:${pendingUserId}`, {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});
if (!userRl.success) {
  return createRateLimitResponse(
    userRl,
    "Too many MFA attempts for this account. Please try again later.",
  );
}
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/auth/mfa/validate/route.ts
git commit -m "fix(security): add rate limiting to MFA validation endpoint"
```

---

## Task 3: Make cron endpoints fail-closed when CRON_SECRET is unset

**Files:**

- Modify: `src/app/api/cron/notifications/route.ts`
- Modify: `src/app/api/cron/sessions/route.ts`
- Modify: `src/app/api/cron/workflows/route.ts`

**Step 1: Fix all three cron routes**

In each file, replace:

```ts
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

With:

```ts
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

This ensures: if `CRON_SECRET` is not configured, the endpoint returns 401 (fail-closed) instead of allowing all requests (fail-open).

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/cron/notifications/route.ts src/app/api/cron/sessions/route.ts src/app/api/cron/workflows/route.ts
git commit -m "fix(security): make cron endpoints fail-closed when CRON_SECRET unset"
```

---

## Task 4: Block MFA-pending sessions from calling non-auth API routes

**Files:**

- Modify: `src/lib/api-auth.ts`

**Step 1: Add mfaPending check to getAuthUser**

The session type includes `mfaPending` on the user object. Update `getAuthUser` to reject MFA-pending sessions:

Replace the `getAuthUser` function:

```ts
export async function getAuthUser(): Promise<AuthUser> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  // Block access if MFA verification is still pending
  const user = session.user as AuthUser & { mfaPending?: boolean };
  if (user.mfaPending) {
    throw new Error("Unauthorized: MFA verification required");
  }

  return user as AuthUser;
}
```

This blocks MFA-pending users from every API route that calls `requireApiAuth()`, `requireApiAdmin()`, or `requirePermission()`. The MFA validate endpoint at `/api/auth/mfa/validate` doesn't use these helpers (it's intentionally unauthenticated), so it's unaffected.

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/lib/api-auth.ts
git commit -m "fix(security): block MFA-pending sessions from API access"
```

---

## Task 5: Fix CSV import missing organizationId

**Files:**

- Modify: `src/app/api/import/route.ts`

**Step 1: Pass organizationId to createEntity**

In the `POST` handler, after `const authUser = await requirePermission('import:execute');`, fetch the user's org:

```ts
const importUser = await prisma.user.findUnique({
  where: { userid: authUser.id! },
  select: { organizationId: true },
});
const importOrgId = importUser?.organizationId || null;
```

Update the `createEntity` call inside the loop (line ~110):

```ts
await createEntity(
  validatedInput.entityType,
  rowData,
  authUser.id!,
  importOrgId,
);
```

Update the `createEntity` function signature:

```ts
async function createEntity(entityType: string, data: Record<string, string>, userId: string, organizationId: string | null): Promise<void> {
```

Add `organizationId` to the `asset` create data:

```ts
case 'asset':
  await prisma.asset.create({
    data: {
      assetname: data.assetname,
      assettag: data.assettag,
      serialnumber: data.serialnumber,
      specs: data.specs || null,
      notes: data.notes || null,
      purchaseprice: data.purchaseprice ? parseFloat(data.purchaseprice) : null,
      purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
      mobile: data.mobile ? data.mobile.toLowerCase() === 'true' : null,
      requestable: data.requestable ? data.requestable.toLowerCase() === 'true' : null,
      creation_date: now,
      organizationId,
    }
  });
  break;
```

Add `organizationId` to the `location` create data similarly.

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/import/route.ts
git commit -m "fix(security): add organizationId to CSV import entities"
```

---

## Task 6: Make ENCRYPTION_KEY required in production

**Files:**

- Modify: `src/lib/env-validation.ts`

**Step 1: Make ENCRYPTION_KEY required when NODE_ENV=production**

In the `ENV_CONFIG` array, find the `ENCRYPTION_KEY` entry and change:

```ts
{
  name: "ENCRYPTION_KEY",
  required: false,
```

to:

```ts
{
  name: "ENCRYPTION_KEY",
  required: process.env.NODE_ENV === "production",
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/lib/env-validation.ts
git commit -m "fix(security): require ENCRYPTION_KEY in production"
```

---

## Task 7: Wire up environment validation at startup

**Files:**

- Modify: `src/instrumentation.ts`

**Step 1: Call validateAndLogEnvironment in register()**

Update the file to call env validation on Node.js runtime startup:

```ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Validate environment variables at startup
    const { validateAndLogEnvironment } = await import("@/lib/env-validation");
    validateAndLogEnvironment();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat: wire up environment validation at startup"
```

---

## Task 8: Reduce JWT maxAge and add session version for invalidation

**Files:**

- Modify: `src/auth.config.ts`
- Modify: `src/auth.ts`

**Step 1: Reduce JWT lifetime from 30 days to 7 days**

In `src/auth.config.ts`, change:

```ts
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
},
```

to:

```ts
session: {
  strategy: "jwt",
  maxAge: 7 * 24 * 60 * 60, // 7 days
},
```

**Step 2: Add session version to JWT for future invalidation**

In `src/auth.ts`, in the `jwt` callback where the token is populated after credentials login, add:

```ts
token.sessionVersion = Date.now();
```

In the `jwt` callback, add a periodic re-validation check (every hour) that verifies the user still exists and is active:

```ts
// Re-validate user periodically (every hour)
if (token.sessionVersion && typeof token.sessionVersion === "number") {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (token.sessionVersion < hourAgo) {
    // Check user still exists and is not disabled
    const { default: prisma } = await import("@/lib/prisma");
    const dbUser = await prisma.user.findUnique({
      where: { userid: token.id as string },
      select: { userid: true },
    });
    if (!dbUser) {
      // User deleted — invalidate session
      return null;
    }
    token.sessionVersion = Date.now();
  }
}
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/auth.config.ts src/auth.ts
git commit -m "fix(security): reduce JWT lifetime to 7 days, add periodic user validation"
```

---

## Task 9: Add rate limiting to login endpoint

**Files:**

- Modify: `src/auth.ts`

**Step 1: Add rate limiting to the authorize callback**

The `authorize` function in `src/auth.ts` is the login handler. At the start of the `authorize` function, add IP-based rate limiting:

```ts
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
```

Inside `authorize`, before schema validation:

```ts
// Rate limit login attempts by IP
const headersList = await headers();
const ip =
  headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  headersList.get("x-real-ip") ||
  "127.0.0.1";
const rl = checkRateLimit(`login:${ip}`, {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 10 attempts per 15 min
});
if (!rl.success) {
  throw new Error("Too many login attempts. Please try again later.");
}
```

Note: `headers()` is already imported in the file.

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "fix(security): add rate limiting to login endpoint"
```

---

## Task 10: Verify all changes together

**Step 1: Full build verification**

Run: `npx next build`
Expected: Zero errors, all routes compile

**Step 2: Verify rate limiters**

Check that rate limiting imports resolve correctly across all modified files.

**Step 3: Final commit (if any fixups needed)**

---

## Summary

| Task | Severity | Fix                                |
| ---- | -------- | ---------------------------------- |
| 1    | CRITICAL | Rate-limit registration            |
| 2    | CRITICAL | Rate-limit MFA validation          |
| 3    | HIGH     | Cron endpoints fail-closed         |
| 4    | HIGH     | Block MFA-pending API access       |
| 5    | MEDIUM   | Import org-scoping                 |
| 6    | MEDIUM   | Require ENCRYPTION_KEY in prod     |
| 7    | HIGH     | Wire up env validation             |
| 8    | HIGH     | Reduce JWT lifetime + revalidation |
| 9    | HIGH     | Rate-limit login                   |
| 10   | —        | Full verification                  |
