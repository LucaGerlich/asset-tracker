# Security Implementation Guide

This guide documents security gaps found in the current codebase and a prioritized implementation plan to address them. It is intended to be used alongside `FEATURES.md`.

## 1) Immediate Fixes (P0)

### 1.1 Lock Down Unauthenticated API Routes

**Problem:** Several API routes allow unauthenticated read/write access to sensitive data.

**Actions:**

- Require authentication (`requireApiAuth`) on **all** API routes.
- Require admin (or RBAC permission) on create/update/delete routes.
- Remove or refactor legacy endpoints that bypass auth.

**Targets:**

- `src/app/api/asset/route.ts` (GET/POST/PUT)
- `src/app/api/user/route.ts` (GET/PUT)
- `src/app/api/user/getUser/route.ts`
- `src/app/api/asset/validate/route.ts`
- `src/app/api/user/validate/route.ts`

### 1.2 Fix Password Handling on User Updates

**Problem:** User updates accept a raw password and write it un-hashed.

**Actions:**

- Hash any password updates using `hashPassword`.
- Never return passwords in API responses.
- Prevent non-admins from updating `isadmin` or `canrequest`.

**Targets:**

- `src/app/api/user/route.ts`

### 1.3 Prevent Mass Assignment

**Problem:** Some update endpoints use `...data` without whitelisting fields.

**Actions:**

- Use Zod schemas for update payloads.
- Explicitly whitelist allowed fields.
- Reject unexpected keys (strict schema).

**Targets:**

- `src/app/api/asset/route.ts`
- `src/app/api/user/route.ts`

## 2) High Priority (P1)

### 2.1 File Upload Hardening

**Problem:** Asset attachments allow arbitrary file uploads to a public directory without validation.

**Actions:**

- Restrict allowed MIME types (e.g., images/pdf only).
- Enforce size limits (e.g., 5–10 MB).
- Sanitize filenames and strip path separators.
- Store uploads outside `public/` and serve via signed URLs.
- Verify user authorization to the asset before upload/delete.

**Targets:**

- `src/app/api/asset/attachments/route.ts`
- `src/app/api/asset/attachments/[id]/route.ts`

### 2.2 Organization Scoping

**Problem:** Multi-tenant tables exist but many queries are not scoped by `organizationId`.

**Actions:**

- Add org scoping for all queries on org-scoped entities.
- Enforce org membership on API routes.
- Add automated tests for cross-tenant access.

**Example Targets:**

- `src/app/api/organizations/route.ts`
- `src/app/api/organizations/[id]/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/stock-alerts/route.ts`

**Status (0.14.0):** the model and its rules are described in section 7. The
remaining platform-wide tables and unscoped writers are tracked in
`TECHNICAL_DEBT.md`, items 53-80.

### 2.3 User Enumeration Protection

**Problem:** Username/email validation endpoints allow unauthenticated enumeration.

**Actions:**

- Require authentication and rate-limit.
- Consider returning generic responses to reduce enumeration risk.

**Targets:**

- `src/app/api/user/validate/route.ts`
- `src/app/api/asset/validate/route.ts`

## 3) Medium Priority (P2)

### 3.1 Secrets Management

**Problem:** API keys are stored in DB without encryption.

**Actions:**

- Encrypt secrets at rest (KMS/Vault).
- Only display masked values in UI.
- Add rotation procedures.

**Targets:**

- `src/app/api/admin/settings/email/route.ts`
- `src/app/api/admin/settings/freshdesk/route.ts`

### 3.2 CSRF Protection

**Problem:** Cookie-based sessions on state-changing endpoints can be vulnerable to CSRF.

**Actions:**

- Add CSRF tokens or same-site strict validation on mutating requests.
- Enforce `Origin`/`Referer` checks for browser POST/PUT/PATCH/DELETE.

### 3.3 Security Headers

**Actions:**

- Add CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- Automate security header testing in CI.

## 4) Long-Term Hardening (P3)

- MFA/2FA and password reset flows
- Concurrent session management
- Captcha for auth endpoints
- Suspicious activity detection
- Enhanced audit logging (entity diffs)
- Data masking in logs
- Compliance reporting (SOX/HIPAA/GDPR)

## 5) Security Baseline Checklist

- [ ] All API routes protected with auth and role checks
- [ ] All mutations validated with strict Zod schemas
- [ ] No plaintext secrets in DB
- [ ] File uploads restricted and scanned
- [ ] Multi-tenant scoping enforced
- [ ] CSRF protection on mutating requests
- [ ] Security headers enforced
- [ ] Rate limiting enabled
- [ ] Audit logging enabled

## 6) Recommended Implementation Order

1. Lock down unauthenticated routes and hash passwords on update.
2. Add strict input validation + deny-by-default field updates.
3. Harden file uploads (type/size/authorization/storage).
4. Enforce organization scoping.
5. Add CSRF and security headers.
6. Encrypt secrets + rotation.

## 7) Tenant Isolation Model (implemented in 0.14.0)

This is how isolation works today. New code must follow it. Open gaps are listed in
`TECHNICAL_DEBT.md` ("Phase 0 follow-ups", items 53-80).

### 7.1 Organization status

`src/lib/org-suspension.ts` derives one of three states from the organization row:

| Status       | When                                                       | Effect                                                       |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `active`     | `isActive` and no `suspendedAt` (self-hosted: always)      | normal                                                       |
| `read_only`  | `suspendedAt` set within the last 14 days, `isActive` true | reads work; writes answer 403 `org_read_only`                |
| `locked_out` | `isActive = false`, or `suspendedAt` older than 14 days    | API answers 403 `org_locked`; pages redirect to `/suspended` |

`isActive = false` wins over any suspension. `isActive` is the operator's lock and only
a super-admin can change it; `suspendedAt` is the billing lock written by the Stripe
webhook (a cancellation sets it, reactivation and a completed checkout clear it).

Where it is enforced:

- **API reads:** `getAuthUser` (`src/lib/api-auth.ts`) loads `isActive` and `suspendedAt`
  together with the user, on the session and the API-key path, and sets `orgStatus`
  without a second query. `requireApiAuth`, `requireApiAdmin`, `requireSuperAdmin`,
  `requireApiCanRequest` and `requirePermission` reject a locked-out organization.
  Do not authorize a route with `auth.api.getSession` directly; use these guards. The
  public invite-accept route and the session check in change-password (after
  `getAuthUser`) are the deliberate exceptions.
- **API writes:** every mutating handler calls `requireWritableOrg(user)` next to
  `requireNotDemoMode()`. `src/app/api/__tests__/route-conventions.test.ts` compares,
  per route file, the number of `requireWritableOrg(` calls with the number of mutating
  exports and fails on a shortfall, unless the route is on the named allow-list (auth
  flows, sign-out and session revocation, change-password, own preferences, the billing
  portal, checkout and webhook, `/api/setup`, SCIM, the SAML callback, invite accept,
  read-style POSTs such as label PDFs and connectivity tests). The check is per file,
  not per handler (`TECHNICAL_DEBT.md`, item 74).
- **Pages:** `src/proxy.ts` (through `src/lib/org-lock-redirect.ts`) redirects signed-in
  members of a locked-out organization to `/suspended`. Public pages, `/api`, static
  assets and `/suspended` itself are never redirected.
- **SCIM:** `authenticateScim` (`src/lib/scim.ts`) checks the token organization's
  status. It answers a SCIM-format 403 (`scimError`, no `code`) for a locked-out
  organization and for any non-GET request while the organization is read-only.
- **Billing:** `/api/billing/portal` and `/api/billing/checkout` skip the status block
  on purpose, so a suspended admin can pay.

### 7.2 Typed denials

Guards throw `ForbiddenError(code, message)` or `UnauthorizedError` from
`src/lib/errors.ts`. A route's `catch` calls `apiErrorResponse(error)` first; it returns
a 401 or 403 with `{ error, code }` for these classes and `null` for everything else, so
routes keep their own 404, 409 and 500 handling. Codes: `org_locked`, `org_read_only`,
`not_admin`, `not_super_admin`, `insufficient_permission`, `api_key_scope`,
`request_permission`, `feature_not_entitled`, and `unauthorized` (the 401 from
`UnauthorizedError`). Clients (including the offline queue) key off `code`; do not return a 500 or a bare "Forbidden" for a denial.

### 7.3 Platform (super-admin) boundary

`isSuperAdmin(user)` in `src/lib/super-admin.ts` is the only implementation; it is used
by `requireSuperAdmin` and by the settings page. It fails closed:

- `SUPER_ADMIN_EMAILS` set: the user's stored email must be listed (case-insensitive)
  **and** held by exactly one user (exact `lower(email)` comparison, no pattern match).
- `SUPER_ADMIN_EMAILS` unset: allowed only while the database has at most one
  organization. On a multi-organization deployment nobody is a super-admin until the
  variable is set.

Keep super-admin accounts in the operator organization: a same-organization admin can
still edit them (`TECHNICAL_DEBT.md`, item 62).

`assertEmailAssignable` (`src/lib/email-ownership.ts`) lower-cases and trims an address,
rejects one another user holds (409) and rejects one listed in `SUPER_ADMIN_EMAILS`
unless the caller is a super-admin. These writers use it: `PUT /api/user`,
`POST /api/user/addUser`, `POST /api/auth/register`, the CSV import, SCIM create and
update, LDAP sync and invite accept (new users). These writers do **not**: the OIDC and
SAML callbacks (`api/auth/callback/oidc`, `api/auth/callback/saml`; item 54),
`/api/setup` (item 55) and BetterAuth's own OAuth sign-up hook in `auth-server.ts`
(item 61). Anything new that writes `user.email` must call it, and the unguarded ones
should be moved over.

Platform settings (general, email, Freshdesk, notifications, SSO, LDAP, Intune,
integrations, organizations, rate limits), global webhooks, global roles and the
Freshdesk ticket routes are super-admin only, and so is the GDPR retention PUT (one
file for the whole deployment, applied by the cron to every tenant). Settings PUTs
accept an allow-list of keys, and the masked placeholder is never stored.

### 7.4 Sign-up and invites

- Public sign-up is closed unless `ALLOW_PUBLIC_SIGNUP=true`
  (`isPublicSignupEnabled()` in `src/lib/signup.ts`). `POST /api/auth/register` answers
  404 and `/register` redirects to `/login` otherwise; BetterAuth's own sign-up is
  disabled (`disableSignUp: true`) as a second layer. Self-hosted installs create their
  first admin through `/setup` or `scripts/create-admin.mjs`.
- An invite is acceptable only while `pending`. Its role must belong to the inviter's
  organization or be a global role. The user limit is re-checked on accept. An existing
  user who accepts into another organization gets `isadmin = false`, loses all of their
  roles (global roles included) and their department, then receives the invited role.

### 7.5 Scoping rules for new code

- Scope every query on an organization-owned table with the caller's `organizationId`.
  A record of another organization answers 404, the same as a missing one. A user
  without an organization gets nothing: return 404 or an empty result **before** the
  query (`const orgId = user.organizationId; if (!orgId) ...`, as `admin/workflows`
  does), and never write `...(orgId ? { organizationId: orgId } : {})`, which drops the
  filter for exactly the caller who must get nothing. `strictOrgWhere()` in
  `src/lib/data.ts` is the primitive that follows this rule for pages and helpers: it
  throws when the organization is missing. Beware `scopeToOrganization`
  (`src/lib/organization-context.ts`): it maps a missing organization to
  `organizationId: null`, so an org-less caller still matches org-less rows. Do not use
  it where such a caller must get nothing (`TECHNICAL_DEBT.md`, item 69).
- A table without its own `organizationId` is scoped through its parent: audit logs via
  `user`, maintenance schedules and user assets via `asset`, tickets via their creator,
  and status transitions via both status types (`transitionsOfOrganization` in
  `src/lib/status-transitions.ts`). Resolve an ID-addressed target through that
  relation, never by ID alone, and check every body-supplied ID the same way (a status
  type, an assignee, a target user).
- Never return a stored secret, even encrypted: webhook responses carry `hasSecret`
  (`src/lib/webhook-response.ts`).
- Never trust an `organizationId` from a request body; compare it with the caller's or
  ignore it.
- Server-rendered pages follow the same rule as routes. `src/app/__tests__/` has the
  scope tests for the pages.
- Pass the acting organization to `triggerWebhook`, `processWorkflowTrigger` and any
  other fan-out. Called without one, `triggerWebhook` reaches only global webhooks. A
  scan in `webhook-callers.test.ts` checks the argument count.
- Never put `error.message` of a database, upstream or library error into a response.
  Log it and return a fixed message.
- Platform-wide tables still exist (email and label templates, depreciation settings,
  Slack and Teams integration settings). Do not add to them; see `TECHNICAL_DEBT.md`,
  items 57 and 65.

### 7.6 Offline queue

The service worker (`public/sw.js`, rules in `public/sw-queue-rules.js`) keeps a failed
mutation for replay only if it is safe to do so:

- It never queues `/api/auth/*`, HEAD or OPTIONS, multipart bodies, the credential-bearing
  routes (add user, setup, admin settings, SCIM, team invite) or bodies with
  secret-looking fields, and stores only allow-listed headers.
- Each entry carries the signed-in user's id. Replay runs only for the current user, and
  sign-out clears the queue. Entries with no known owner are kept as blocked and never
  replayed.
- Replay sends `X-Offline-Replay: 1`, which the worker passes through, so a failed replay
  is not queued a second time. Results (`src/lib/offline-queue.ts`,
  `classifyReplayStatus`): 2xx is synced; 401, 403, 409 and 422 are kept as `blocked`
  with the server's `code` and message and can be discarded in the indicator; 400 and
  404 are dropped and reported; 429 and 5xx are retried (at most three times), and a
  429 stops the pass.
- A queued request is answered with HTTP 202; callers cannot tell it from a saved
  change yet (`TECHNICAL_DEBT.md`, item 58). The mobile sync service
  (`mobile/src/services/sync.ts`) uses the same classification but has no user binding
  (item 60).
