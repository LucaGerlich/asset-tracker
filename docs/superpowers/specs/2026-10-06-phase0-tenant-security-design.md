# Phase 0: Tenant Isolation and Security Fixes: Design

- **Date:** 2026-10-06
- **Status:** Pending written-spec review
- **Programme:** prerequisite for the SaaS boundary
  (`2026-10-05-saas-boundary-design.md`)
- **Origin:** a six-lens review of the boundary spec plus a targeted code
  investigation (2026-10-06). Every item below was confirmed against the code
  on `development` at `adece20`.

## Goal

Close the cross-tenant and privilege holes that exist today, independent of
billing, so that:

- no tenant can read, change or trigger anything in another tenant,
- no tenant can gain platform (super-admin) rights,
- organisation suspension and lock are actually enforced, and
- denials reach the client as proper 403s that the offline queue does not
  silently drop.

Self-hosted single-org behaviour stays unchanged. The current mode switch
(`SELF_HOSTED`) stays as is; the boundary spec replaces it later.

## Already shipped

**P0-0 BetterAuth mass assignment (hotfix 0.13.2, commit `b1035af`).**
`POST /api/auth/update-user` accepted `isadmin`, `organizationId`, `isActive`
and other privileged custom fields from any signed-in user. These fields are
now `input: false`, with a test against BetterAuth's `parseUserInput`.

## P0-1 Workflows and custom fields per organisation

**Problem.** `automation_rules` and `custom_field_definitions` have no
`organizationId`.

- Any org admin can list, edit and delete every org's rules and definitions.
- The nightly workflow cron runs every org's rules on every org's assets,
  licences (including licence keys) and consumables.
- Rule actions can:
  - mail any address;
  - notify or create tickets as any user;
  - set the status of any asset;
  - fire `triggerWebhook` with no org, which matches every org's webhooks.
- `POST /api/custom-fields/values` accepts any `fieldId`.
- The settings page and `assets/[id]` load every org's definitions.

**Schema.** Migration `20261006_scope_automation_custom_fields`:

- Adds nullable `organizationId` (FK `ON DELETE CASCADE`, index) to both
  tables, plus back-relations on `Organization`.
- Backfill in one `DO` block:
  - **0 orgs:** nothing.
  - **1 org:** everything goes to it.
  - **Several orgs, rules:** the creator's org. Rules whose creator has no
    org stay NULL and are set `isActive = false`.
  - **Several orgs, definitions:** the org of the entities holding values.
    A definition used by several orgs is cloned per org, and values are
    repointed. Unused definitions stay NULL, which makes them invisible, and
    the count is raised as a notice.
- Style follows `20260505_scope_shared_tables`: `"public"."table"` qualified,
  no `'public'` string literals (`set-schema.mjs` rewrites the schema).

**Code.**

- Every rule and definition query uses `{ ..., organizationId }` from the
  authenticated user. A mismatch returns 404. A user with no org gets nothing
  (fail closed; never match `organizationId: null`).
- Admin routes validate bodies with the existing (unused)
  `createAutomationRuleSchema` and a new definition schema (`entityType` from
  `entity-registry`, `fieldType` enum).
- `workflow-engine`:
  - `processWorkflowTrigger(trigger, data, organizationId)` loads only that
    org's active rules.
  - Cron scans pass each entity's `organizationId`; rows without one are
    skipped.
  - Rules of `locked_out` orgs are skipped.
  - Action constraints:
    - `update_status`: the asset and the status type must belong to the
      rule's org.
    - `send_notification` and `create_ticket`: the user must belong to the
      rule's org.
    - `trigger_webhook`: passes the rule's org, and the event must be in
      `WEBHOOK_EVENTS`.
  - A violation fails that action, is logged, and does not stop other rules.
- `triggerWebhook(event, data, organizationId)`: with no org it targets only
  global (`organizationId IS NULL`) webhooks, never "all". This closes the
  Prisma `undefined` means "no filter" trap.
- `POST /api/custom-fields/values`:
  - Each `fieldId` must belong to the caller's org and match `entityType`.
  - An unknown field is a 400, not a 500.
- `search/advanced`: field filters are restricted to the org's definitions.
- `admin/settings/page.tsx`, `assets/[id]/page.tsx` and
  `custom-fields/values` GET read only the org's definitions.

## P0-2 Platform (super-admin) boundary

**Problem.**

- `requireSuperAdmin` lets every org admin through when `SUPER_ADMIN_EMAILS`
  is unset.
- Identity is a case-insensitive email match, but users can change their own
  email without verification, and the unique index is case-sensitive. A
  tenant admin can therefore claim a listed address.
- The settings page sends every system setting, including SSO login token
  rows and the integration configuration, plus every org's status types, to
  any org admin.
- The sso, ldap, intune and integrations PUTs accept any setting key.
- Freshdesk ticket routes let any org admin use the platform's Freshdesk
  credentials.

**Rules.**

- **`isSuperAdmin(user)`** is the one implementation, used by
  `requireSuperAdmin` and `admin/settings/page.tsx`:
  1. `SUPER_ADMIN_EMAILS` set: the email matches case-insensitively **and** no
     other user has the same lower-cased email.
  2. Unset: allowed only while the database has at most one organisation
     (self-hosted single-tenant keeps working; a second org closes it).
- **Email writes**, on every path that sets `user.email` (`PUT /api/user`,
  `addUser`, import, SCIM, invite accept, LDAP):
  - lower-case and trim the address;
  - reject an address that another user already has, compared
    case-insensitively (409);
  - reject an address in `SUPER_ADMIN_EMAILS` unless the caller is a
    super-admin.
- **Settings page:**
  - Org admins get only org-scoped data: users, org-scoped status types, the
    org's custom fields.
  - Platform settings are loaded and passed only for super-admins, without
    `sso.token.*` rows, and with encrypted values masked.
  - The platform tabs (General, Email, Freshdesk, Notifications, SSO, LDAP,
    Intune, Integrations, Organizations) are hidden **and not rendered** for
    non-super-admins, including via `?tab=`.
- **Settings PUTs** accept only an allow-list of keys per route. Unknown keys
  are a 400. The masked placeholder is never stored.
- **SSO and LDAP** become operator-level: the per-org `requirePlanFeature`
  checks on their PUTs are removed. They are already super-admin only.
- **Freshdesk:** `GET /api/tickets?source=freshdesk` and `tickets/[id]` (the
  Freshdesk branch) require super-admin.

## P0-3 Public signup and invites

**Problem.**

- `POST /api/auth/register` creates a new org and admin on every instance;
  only the `/register` page is hidden on self-hosted.
- BetterAuth sign-up is blocked only by a throw in a hook.
- Invites have three holes:
  - cancelled invites can still be accepted;
  - `roleId` is not checked against the inviter's org;
  - accepting moves an existing user between orgs without resetting
    `isadmin`.

**Rules.**

- **`isPublicSignupEnabled()`** returns `ALLOW_PUBLIC_SIGNUP === 'true'`.
  - Default closed on every deployment.
  - `/api/auth/register` returns 404 when it is false, before rate limiting
    and body parsing.
  - The `/register` page redirects to `/login`.
  - The SaaS deployment sets `ALLOW_PUBLIC_SIGNUP=true` **before** deploying
    this release (rollout step).
  - `.env.example`, README and the docs say so; the incorrect "SELF_HOSTED
    disables registration" statements are fixed.
- **BetterAuth:** set `emailAndPassword.disableSignUp: true`. The hook throw
  stays as a second layer.
- **Invites:**
  - Only `pending` invites are acceptable (`cancelled` and `revoked` are
    rejected on the page and in the API).
  - `roleId` must belong to the inviter's org.
  - The user limit is re-checked on accept.
  - An existing user who accepts an invite into a different org gets
    `isadmin = false` and loses roles from the old org.

## P0-4 Organisation status enforcement

**Problem.**

- `read_only` is enforced nowhere: `requireWritableOrg` has no callers.
- `locked_out` is enforced only by two API guards. 25 raw `getSession` call
  sites, every server-rendered page, and SCIM skip it.
- `isActive = false` with a recent `suspendedAt` yields `read_only` instead of
  `locked_out`.
- Org admins can set their own org's `isActive`, and every org PUT silently
  sets `isActive = true` (a zod `default(true)` that survives `.partial()`).
- `/suspended` is unreachable and links to a GET on a POST-only route.

**Rules.**

- **`getOrgStatus` precedence:** `isActive = false` → `locked_out` first; then
  `suspendedAt` within 14 days → `read_only`; older → `locked_out`.
- **One query.** `getAuthUser` selects the org's `isActive` and `suspendedAt`
  with the user (session and API-key paths), so guards no longer issue a
  second query.
- **Writes.** `requireWritableOrg(user)` is called in every mutating handler,
  next to the existing `requireNotDemoMode()` call (same per-route pattern,
  185 sites).
  - Exempt, as a named allow-list: sign-out and session revocation,
    change-password, own preferences, billing portal and checkout,
    read-as-POST routes (`asset/qrcode/bulk`, `labels/pdf`, the `*/test`
    connectivity checks), and auth flows.
  - A unit test walks `src/app/api/**/route.ts` and fails if a mutating
    handler neither calls `requireWritableOrg` nor is on the allow-list.
- **Locked out.**
  - The 12 route files using raw `auth.api.getSession` move to the api-auth
    guards (`organizations/[id]`, `roles`, `roles/[id]`, `stock-alerts`,
    `stock-alerts/[id]`, `webhooks/[id]`, `notifications`,
    `notifications/[id]`, `tickets/[id]`, the `tickets` Freshdesk helper,
    `auth/change-password`, `team/invite/[token]`).
  - `authenticateScim` checks the token org's status.
- **Pages.** `proxy.ts` (Node runtime) redirects page requests (not `/api`,
  not public routes, not `/suspended`) of signed-in users whose org is
  `locked_out` to `/suspended`.
  - It reads the session (cookie cache), then one `organization` select by
    the user's org ID.
  - If the proxy approach turns out infeasible during planning, the fallback
    is the same check in `getOrganizationContext` and `strictOrgWhere` plus
    the raw-session pages.
- **Org update.**
  - `updateOrganizationSchema` drops `isActive` and the `default(true)`.
  - Changing `isActive` is super-admin only, via the same route (super-admins
    may update any org).
- **`/suspended`:**
  - listed as public in `AppShell` (no app chrome);
  - shows a sign-out button;
  - for admins, shows "Manage subscription" as a POST form to
    `/api/billing/portal` when Stripe is configured, otherwise a contact
    message.
- **Billing routes.** `billing/portal` and `billing/checkout` authenticate with
  `getAuthUser` plus an admin check, and skip the status block, so a
  suspended admin can pay.
- **Self-hosted.** `getOrgSuspensionStatus` keeps returning `active` when
  `SELF_HOSTED=true`, so self-hosters with stale data are not locked out.

## P0-5 Typed denials

**Problem.** Guards throw `Error("Forbidden: …")`. 111 guard calls in 81
route files map that to a 500 or a bare "Forbidden", so clients cannot tell a
denial from an outage. `src/lib/errors.ts` exists but is unused.

**Rules.**

- Guards throw `ForbiddenError` or `UnauthorizedError` from `src/lib/errors.ts`,
  extended with a machine-readable `code`:
  - `org_locked`, `org_read_only`, `not_admin`, `not_super_admin`,
    `insufficient_permission`, `api_key_scope`, `feature_not_entitled`.
  - Messages keep the `Forbidden: …` / `Unauthorized` prefixes, so the 165
    correctly mapped sites keep working unchanged.
- New `apiErrorResponse(error)` in `src/lib/errors.ts`:
  - returns 401 or 403 with `{ error, code }` for these classes;
  - returns `null` otherwise, so routes keep their own 404/409/500 handling.
- The 81 route files in classes (b), (c1) and (c2) of the inventory call it
  first in their `catch`. A test asserts that every guarded route file
  references `apiErrorResponse` or the established `Forbidden` mapping.

## P0-6 Offline queue

**Problem.** The service worker queues every failed non-GET `/api/*` request:

- It includes sign-in bodies with passwords, in plain IndexedDB.
- Replay treats every status below 500 as success and deletes the change.
- Replay goes through the service worker again, so an offline replay is
  re-queued and reported as synced.
- The `HEAD /api/health` probe is queued and reports online while offline.
- The queue survives sign-out and replays under the next user's session.

**Rules.**

- **Service worker:**
  - never queues `/api/auth/*` or non-mutating methods (HEAD, OPTIONS);
  - passes through requests carrying `X-Offline-Replay: 1`;
  - stores only allow-listed headers (`content-type`, `accept`, and the
    app's concurrency header);
  - skips multipart bodies (they cannot be stored faithfully).
- **Identity:** entries store the signed-in user's ID. Replay only runs
  entries of the current user. Sign-out clears the queue.
- **`replayQueue`:**
  - 2xx: success.
  - 401, 403, 409, 422: kept as `blocked` with status, `code` and message.
    The indicator lists them and lets the user discard them.
  - 400, 404: dropped and reported as failed.
  - 429 and 5xx: retried (max 3), with replay stopping at the first 429.
- **UI:** the toast reports synced, blocked and failed counts separately.
- **Mobile:** the same classification change in `mobile/src/services/sync.ts`
  (it has no enqueuers today).

## Rollout

- One release, `0.14.0`, after the `0.13.2` hotfix.
- **Before deploy:**
  1. Set `ALLOW_PUBLIC_SIGNUP=true` on the SaaS deployment.
  2. Set `SUPER_ADMIN_EMAILS` on every multi-org deployment.
  3. Rehearse the migration on a restored copy of production. The production
     database is shared with other apps: `migrate deploy` only
     (`TECHNICAL_DEBT.md` item 8a).
- **After deploy:**
  - Check the migration notice for unscoped definitions.
  - Review deactivated rules.
  - Check that `/suspended` is reachable for a locked test org.

## Testing

TDD. New or changed unit tests:

- **Migration:** backfill SQL against an ephemeral Postgres (existing DB test
  setup), covering 0, 1 and 3 orgs, shared definitions, and orphan rules.
- **Scoping:** rule and definition CRUD is org-scoped (404 cross-org); the
  workflow engine runs only the org's rules; each action constraint;
  `triggerWebhook` without an org reaches only global hooks; the values POST
  rejects a foreign field.
- **`isSuperAdmin`:** env set or unset, one org or several, a case-variant
  duplicate. Email writes: normalisation, duplicate rejection and the
  super-admin address check.
- **Settings page:** an org admin receives no platform settings, and
  `?tab=sso` renders nothing. Setting PUTs reject unknown keys.
- **Signup:** register returns 404 by default; `/sign-up/email` is refused;
  invites (cancelled rejected, foreign role rejected, `isadmin` reset on
  move).
- **Status:** precedence order; a read-only org's write returns 403
  `org_read_only`; a locked org's API call returns 403 `org_locked`; the
  route-walk test; proxy redirect; tenant PUT cannot change `isActive`;
  billing portal reachable when suspended.
- **Typed errors:** `apiErrorResponse` mapping; the route-walk test.
- **Offline queue** (happy-dom, `idb-keyval` mocked): the classification
  table; user binding; clear on sign-out. The service-worker rules are
  extracted into a pure function and tested.
- **Existing tests updated:** `api-auth.test.ts`, `org-suspension.test.ts`,
  `auth-register.test.ts` and the five route tests that match on
  `Forbidden:` strings.

## Out of scope (recorded in `TECHNICAL_DEBT.md`)

- LDAP sync overwriting users across orgs and creating users with no org.
- OIDC and SAML callbacks creating users with no org; the custom SSO token
  flow that never creates a session.
- `/api/setup` letting the first caller on an empty database become admin.
- `x-forwarded-for` spoofing of the per-IP rate limit; account enumeration in
  register.
- Global email and label templates, depreciation settings and the
  `rate_limits` admin view.
- Callers treating the offline queue's 202 as a real response.
- Per-tenant SSO (programme sub-project 6).
