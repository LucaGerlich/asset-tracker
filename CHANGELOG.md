# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security

- Write routes check every referenced id in the request body against the caller's
  organization before storing it (debt item 82, found by the 0.15.1 reviews). Until now
  a tenant holding another tenant's id could attach records to that tenant's rows, read
  them back through the response, and, for component categories (`onDelete: Cascade`),
  lose its components when the other tenant deleted the category. A foreign id now
  answers 400 `"<Thing> not found in your organization"`. Covered:
  - accessories, assets (`/api/asset`, `/api/asset/addAsset`), asset templates,
    components (`/api/components`, `/api/components/[id]`), consumables and licences:
    manufacturer, supplier, location, model, status, category and licensed user;
  - locations: parent location (a location can no longer be its own parent);
  - consumable checkouts and licence seats: the target user (the seat response and its
    webhook carried the foreign user's email);
  - audit campaigns: auditors; audit scans: asset and location;
  - `PUT /api/user`: department; purchase requests: department and item suppliers
    (`generate-po` copied those suppliers onto the order);
  - CSV import of accessories, consumables and licences: reference columns (the
    defaults were already scoped).
- New helper `findForeignReference()` in `src/lib/org-references.ts`: one `findMany`
  per referenced model, scoped like `scopeToOrganization` (an org-less caller matches
  only org-less rows).

**Upgrade notes**

- No migration. A record that still points at a legacy reference row without an
  organization (for example a component category created through the API before
  0.15.1) answers 400 when an edit re-sends that id. Count such rows read-only before
  deploying if in doubt.

## [0.15.0] - 2026-10-12

Phase 1a of the SaaS boundary (`docs/superpowers/specs/2026-10-05-saas-boundary-design.md`):
the database gains the columns the control plane will drive, and the legacy billing code
starts recording entitlements. Nothing reads them yet, so enforcement is unchanged, apart
from the API change under Security.

### Added

- `organizations.entitlements` (JSONB) and `organizations.lockedAt` (timestamp), both
  nullable, migration `20261012_org_entitlements_locked_at`.
- The Stripe webhook, the trial cron and the register trial record `entitlements`
  alongside `plan`, `maxAssets` and `maxUsers` while Stripe is configured.
- `scripts/backfill-entitlements.ts` maps every organization's legacy plan to
  entitlements (dry run by default).

### Security

- The organization routes (`GET /api/organizations`, `POST /api/organizations`,
  `GET /api/organizations/[id]` and `PUT /api/organizations/[id]`) return an allow-list
  of fields. They no longer send `plan`, the Stripe customer and subscription ids,
  `trialEndsAt`, `maxAssets`, `maxUsers` or `suspendedAt` to org admins, and never the
  new columns.

**Upgrade notes**

Before deploying:

- Mind the order. The migration only adds two nullable columns, and it reaches the shared
  database only when the production (master) build runs `prisma migrate deploy`. Until
  then, any 0.15.0 code against that database fails on organization reads (register,
  setup, pages using `getOrganizationContext`, billing checkout). That covers a Preview
  deployment of `development` or of this branch, and `next dev` with a `.env` that
  points at the database. So release to production promptly after merging to
  `development`, or apply the additive migration to the shared database first
  (`prisma migrate deploy` from a trusted shell).

After deploying (SaaS database only, never a self-hosted one):

- Dry run, with the deployment's real `SELF_HOSTED` value:

  ```bash
  bun scripts/backfill-entitlements.ts --schema <schema> --deployment-self-hosted <true|false>
  ```

  It prints one JSON line per organization (`currentAccess`, `proposed`, `losesFeatures`,
  usage, `overLimit`, `storedValid`) and a summary. `losesFeatures` lists what the
  organization loses when phase 1b switches enforcement on; through 0.15.0 only API keys
  and procurement were enforced per plan. The summary counts `unset` organizations
  (what `--apply` fills) and `invalid` ones (a stored value that fails the entitlements
  schema; it is reported and never overwritten). The script requires `DATABASE_URL` to be
  a `postgres://` or `postgresql://` URL that names host, port and database explicitly,
  with none of the `host`, `hostaddr`, `port`, `dbname` or `service` query parameters,
  and refuses to run otherwise, so the printed target always matches the database it
  connects to.

- Decide per organization. An organization that needs different entitlements than its
  legacy plan maps to gets them by SQL before `--apply`, in the SaaS schema, in the shape
  of `proposed` (another shape shows up as `invalid`):
  `UPDATE "<schema>"."organizations" SET "entitlements" = '<json>' WHERE "id" = '<uuid>'`.
  The script never touches a row that already holds entitlements. Then apply with the
  printed target:

  ```bash
  bun scripts/backfill-entitlements.ts --schema <schema> --deployment-self-hosted <true|false> --apply --confirm "<target>"
  ```

  Without `--apply` the script is a dry run (`--dry-run` says so explicitly), `--apply`
  needs `--confirm` with the printed target, and `--confirm` without `--apply` is
  rejected. Re-running is safe; a row whose plan changed after planning is skipped.

- Gate to phase 1b (all of it, on the SaaS database):
  - Record the production and Preview values of `SELF_HOSTED` and `STRIPE_*`.
  - If production ran with `SELF_HOSTED=true`, its organizations were effectively
    unrestricted: decide per organization in the dry-run output before applying.
  - Re-run the apply right before the switch, then a dry run: its summary must show
    `"unset":0` and `"invalid":0`.
  - Preview has its own database or the full cloud environment.
  - `SUPER_ADMIN_EMAILS` is set.

## [0.14.0] - 2026-10-11

Phase 0 of the SaaS boundary work
(`docs/superpowers/specs/2026-10-06-phase0-tenant-security-design.md`): closes the
cross-tenant and privilege holes that exist independent of billing. The BetterAuth
`update-user` mass-assignment fix shipped separately as 0.13.2. Self-hosted
single-organization behaviour is unchanged. **Read the upgrade notes below before
deploying a multi-organization instance.**

### Security

- **Workflows and custom fields belong to one organization.** Automation rules and
  custom field definitions had no owner: any org admin could list, edit and delete
  every organization's rules and definitions, and the nightly workflow run executed
  every rule against every organization's assets, licences (including keys) and
  consumables. Both tables now carry `organizationId` (migration
  `20261007_scope_automation_custom_fields`). Routes, the settings page, asset
  details, advanced search and `POST /api/custom-fields/values` see only the caller's
  organization (404 across organizations; a user with no organization sees nothing).
  The workflow engine runs an organization's own rules on its own data, skips
  locked-out organizations, and constrains rule actions to the rule's organization
  (status changes, notifications, tickets, webhooks). `triggerWebhook` without an
  organization now reaches only global webhooks instead of every tenant's; every call
  site passes the acting organization.
- **Super-admin fails closed, and the address cannot be claimed.**
  `requireSuperAdmin` let every org admin through when `SUPER_ADMIN_EMAILS` was unset.
  Now, with the variable set, the address must match case-insensitively and be held by
  exactly one user; unset, it works only while the database has at most one
  organization. Emails are trimmed, lower-cased and checked for duplicates and
  reserved addresses on the profile, add-user, register, CSV import, SCIM, LDAP sync
  and invite-accept write paths. The OIDC and SAML callbacks, `/api/setup` and
  BetterAuth's own OAuth sign-up are still open (`TECHNICAL_DEBT.md` items 54, 55, 61). Org admins receive only org-scoped settings data; the
  platform tabs (General, Email, Freshdesk, Notifications, SSO, LDAP, Intune,
  Integrations, Organizations, Rate Limits) are not rendered for them, including via
  `?tab=`. Setting PUTs accept an allow-list of keys and never store the masked
  placeholder. Freshdesk ticket routes, global webhooks, edits of global roles and
  the rate-limit admin view are super-admin only; SSO and LDAP settings are
  operator-level and no longer depend on a plan feature.
- **Public sign-up is closed by default and invites are hardened.**
  `POST /api/auth/register` created an organization and admin on every instance. It
  now answers 404 (and `/register` redirects to `/login`) unless
  `ALLOW_PUBLIC_SIGNUP=true`; BetterAuth's own sign-up is disabled as a second layer.
  Invites can be accepted only while `pending`, the role must belong to the inviter's
  organization or be a global role, the user limit is re-checked on accept, and an
  existing user who accepts into another organization loses the admin flag, all of
  their roles (global ones included) and their department.
- **Suspension and lock are enforced.** An inactive organization is `locked_out`
  first; a suspension is `read_only` for 14 days and `locked_out` afterwards.
  `getAuthUser` loads the status with the user, so guards need no second query. Every
  mutating route calls `requireWritableOrg` (403 `org_read_only`); a test compares, per
  route file, the number of calls with the number of mutating exports and fails on a
  shortfall unless the file is on the named allow-list (auth flows, sign-out,
  change-password, own preferences, billing portal, checkout and webhook, setup, SCIM,
  the SAML callback, invite accept, read-style POSTs such as label PDFs and connectivity
  tests). Locked-out organizations get 403 `org_locked` from the API guards and from
  the former raw-session routes. SCIM answers a SCIM-format 403 (no `code`) for a
  locked-out organization and also blocks its non-GET requests while it is read-only.
  Members are
  redirected to `/suspended` on every page (sign-out, plus "Manage subscription" for
  admins; the CSP allows the Stripe portal as a form target). Tenants can no longer
  change their own `isActive`, and an organization update no longer silently sets it
  to true. Billing: a cancellation sets only `suspendedAt` (`isActive` stays the
  operator's lock), reactivation and a completed checkout clear it, and the billing
  portal and checkout stay reachable for a suspended admin. Self-hosted instances are
  always `active`.
- **Denials are typed.** Guards throw `ForbiddenError` or `UnauthorizedError` with a
  machine-readable `code` (`org_locked`, `org_read_only`, `not_admin`,
  `not_super_admin`, `insufficient_permission`, `api_key_scope`, `request_permission`,
  `feature_not_entitled`, and `unauthorized` on a 401). Routes answer 401 or 403 with `{ error, code }` instead of
  a 500 or a bare "Forbidden", so clients can tell a denial from an outage.
- **The offline queue keeps secrets out and no longer loses refused changes.** The
  service worker never queues `/api/auth/*`, HEAD or OPTIONS, multipart bodies, the
  credential-bearing routes (add user, setup, admin settings, SCIM, team invite) or
  bodies with secret-looking fields, and stores only allow-listed headers. Queued
  changes are stamped with the signed-in user, replay only for that user, and the
  queue is cleared on sign-out. Replay no longer loops back through the service
  worker. 2xx counts as synced; 400 and 404 are dropped and reported; 429 and 5xx are retried
  (three attempts in total), stopping at the first 429; any other status (401, 403, 409
  and 422, but also an unexpected 3xx or 405) is kept as blocked, listed in the
  indicator with the server's code and message, and discardable. The toast reports synced, blocked and failed counts separately, and
  the mobile sync service uses the same classification.
- **More cross-tenant holes closed**, found while implementing the above: stock
  alerts, roles (including `organizationId` mass assignment on role edits and
  members of global roles), webhooks, tickets (assignee must belong to the
  organization), departments (a body-supplied organization is ignored), users,
  audit campaign completion and the asset-checkout and licence-seat record checks
  are scoped to the caller's organization. Ten server-rendered pages loaded other
  organizations' data (reports, admin tickets and users, consumable and component
  details and pickers, user edit and settings, reservations, depreciation settings);
  they are scoped now, and user lookups no longer send password, LDAP or SCIM fields
  to the client. Organization-less admins fail closed.
- **Raw error text is gone from responses.** Database, upstream (Freshdesk, storage,
  Intune) and CSV-import row errors no longer reach the client; details go to the
  server log and the client gets a fixed message.
- **Case-insensitive email checks are exact.** They compare `lower(email)` as a bound
  parameter instead of a pattern match, so `_` and `%` in an address are never
  wildcards.
- **The status workflow is per organization.** `status_transitions` has no owner of its
  own, so the workflow admin routes, `GET /api/status-transitions` and the status
  update read and wrote every tenant's transitions; one tenant defining a single
  transition made `PUT /api/asset/updateStatus` answer 400 "not allowed" for every
  other tenant, and a status could be set from another tenant's status type. Transitions
  are now matched through the organization of both statuses, creating one requires both
  statuses to be yours (400), deleting someone else's answers 404, the "is a workflow
  defined" check counts only your own, and the target status (by ID or by name) must
  belong to your organization.
- **More ID-addressed writes are scoped.** Completing a maintenance schedule,
  activating an audit campaign, commenting on a ticket (which emailed the ticket's
  creator in another tenant) and re-pointing a user asset accepted any ID of any
  tenant. They resolve the target through the caller's organization and answer 404
  before writing or emailing. A maintenance assignee must belong to the organization,
  and completing a schedule never emails an assignee of another one.
  The request, approval, return and self-return flows set the Pending, Active and
  Available status from the asset's organization instead of any tenant's.
- **Callers without an organization get nothing.** The audit log list and revert, asset
  attachment delete and patch, maintenance schedules, user asset and accessory lists,
  requests and the user validation endpoint applied their organization filter only
  when the caller had an organization, so an org-less user (LDAP, OIDC and SAML users
  today) could read, revert, delete or edit every tenant's rows. They answer 404 or an
  empty result without querying.
- **GDPR retention is super-admin only.** The retention settings are one file for the
  whole deployment and the cron applies them to every tenant's audit logs, yet any
  org admin could write them (set 1 day and the next run erases every audit trail).
  Org admins now see the values read-only.
- **A CSV user import cannot create admins unless the importer is one.** A role with
  `import:execute` could fill the `isadmin` column; the column is ignored for importers
  who are not admins.
- **The depreciation forecast no longer adds up other tenants' assets.**
  `/api/reports/advanced` scopes the categories and the assets it includes.
- **The stored webhook secret is never returned.** Webhook responses carry `hasSecret`
  instead of the encrypted value (global webhooks are listed to every tenant). Editing a
  webhook keeps its secret unless a new one is entered.

### Changed

- The destructive database tests (`scope-automation-migration`, `user-email-query.db`)
  run only with `ALLOW_DESTRUCTIVE_DB_TESTS=1`, no longer on any localhost
  `DATABASE_URL`; CI sets it for its throwaway Postgres.
- Org admins can no longer edit global roles (those with no organization); only
  super-admins can, and only super-admins can create global webhooks and roles.
- Guarded routes answer 403 with `{ error, code }` where some used to answer a bare
  "Forbidden" (for example the team invite route), so UI code that matches the old
  body text needs a look.
- An advanced-search filter on a custom field outside the organization's definitions
  matches nothing instead of being ignored.
- Custom field definitions accept the six field types the UI offers (`text`, `number`,
  `date`, `checkbox`, `select`, `textarea`) and the entity types `asset`, `accessory`,
  `consumable`, `licence`, `component` and `kit` (British spelling; `license` is
  rejected). A full update that resends another type or entity type is rejected.
- A change queued offline is still answered with HTTP 202, as before; callers treat
  that as success (see `TECHNICAL_DEBT.md`, item 58).

### Fixed

- Editing a select custom field no longer blanks its options.
- Automation rule names are capped at 200 characters (the column size) instead of
  failing with a 500.

**Upgrade notes**

Before deploying:

- Set `ALLOW_PUBLIC_SIGNUP=true` on every deployment that should keep public sign-up
  (the hosted SaaS: "Start free" and the pricing buttons point at `/register`).
  Without it `/register` redirects to `/login` and the register API answers 404.
  Self-hosted installs need nothing.
- Set `SUPER_ADMIN_EMAILS` on every multi-organization deployment. With the variable
  unset and more than one organization nobody is a super-admin, and the platform
  settings (SSO, LDAP, Freshdesk, integrations, organizations, rate limits) become
  unreachable. Keep super-admin accounts in the operator organization, and make sure
  no second account has the same address in a different case.
- List the organizations migration `20261007b_reopen_billing_suspended_orgs` will
  reopen, and confirm each was a billing lock:
  `SELECT id, name FROM organizations WHERE "isActive" = false AND "suspendedAt" IS NOT NULL`.
  The old Stripe webhook locked cancelled organizations that way; they follow the
  14-day read-only rule afterwards (and are locked out again once it has passed).
  Re-lock any organization an operator had switched off on purpose through
  `isActive`.
- Migration `20261007_scope_automation_custom_fields` backfills the new columns. With
  one organization everything is assigned to it. With several, rules go to their
  creator's organization, and **rules whose creator has no organization are
  deactivated**. A custom field definition used by several organizations is cloned
  per organization and its values repointed; **definitions that hold no values stay
  unscoped and become invisible**. Their count is raised as a database notice
  ("Custom field definitions left unscoped"); the Prisma CLI may not show server
  notices, so also run the queries under "After deploying".
- Check the custom field definitions against the accepted sets; a full update of any
  definition outside them is rejected (400) until an admin fixes it:
  `SELECT id, name, "entityType", "fieldType" FROM custom_field_definitions WHERE "fieldType" NOT IN ('text','number','date','checkbox','select','textarea') OR "entityType" NOT IN ('asset','accessory','consumable','licence','component','kit')`.
- The status workflow is per organization now. Transitions between two statuses of one
  organization keep working for that organization only; a transition whose statuses
  belong to different organizations, or to none, is no longer enforced for anyone. List
  them and delete or recreate them: `SELECT t.id, f."statustypename" AS "from", f."organizationId" AS "fromOrganization", g."statustypename" AS "to", g."organizationId" AS "toOrganization" FROM status_transitions t JOIN "statusType" f ON f."statustypeid" = t."fromStatusId" JOIN "statusType" g ON g."statustypeid" = t."toStatusId" WHERE f."organizationId" IS NULL OR g."organizationId" IS NULL OR f."organizationId" <> g."organizationId"`.
  An organization with no transitions of its own is unrestricted, also when another
  organization had defined some.
- GDPR retention settings can only be changed by a super-admin. If an org admin changed
  `data/gdpr-settings.json`, review it before the next retention cron run.
- Rehearse `prisma migrate deploy` on a restored copy of production first. The
  production database is shared with other applications: run `migrate deploy` only,
  never `migrate reset` or `db push`. Preview deployments must not use the production
  database.

After deploying:

- Check what the scoping migration left unowned and decide what to do with it:
  `SELECT id, name, "entityType" FROM custom_field_definitions WHERE "organizationId" IS NULL`
  (invisible to every organization) and
  `SELECT id, name FROM automation_rules WHERE "organizationId" IS NULL` (deactivated;
  they cannot run until reassigned).
- Open `/suspended` with a locked test organization and check the sign-out and
  billing portal buttons.
- Queue entries written by an older service worker have no owner: they are kept as
  blocked ("unknown owner") and each user discards them once; old entries for
  `/api/auth/*` are removed automatically.
- Workflow rules created in the UI are still not executable by the engine (a
  pre-existing format mismatch, `TECHNICAL_DEBT.md`, item 67).

## [0.13.2] - 2026-10-06

### Security

- **Users can no longer change their own admin flag, organization or account
  status.** BetterAuth's `POST /api/auth/update-user` accepted the app's custom
  user fields (`isadmin`, `canrequest`, `organizationId`, `departmentId`,
  `authProvider`, `isActive`, `password`) from any signed-in user, so a user
  could make themselves an admin or move into another organization. These
  fields are now marked `input: false` and are written only by the app's own
  routes and sign-in hooks. Users can still update their own username and last
  name.

## [0.13.1] - 2026-10-05

### Fixed

- **Microsoft sign-in users now appear in the app.** Users created by an OAuth
  sign-in had no organization, so every org-scoped page hid them. They are now
  assigned to `SSO_DEFAULT_ORGANIZATION_ID`, but only when `MICROSOFT_TENANT_ID`
  is pinned to a single tenant and the org has free user seats. Otherwise the
  sign-up is refused. Run `sql/upgrade/2026-10-05-sso-users-org-backfill.sql`
  once to fix users created before this release.

## [0.13.0] - 2026-10-04

### Changed

- **License changed from MIT to the Functional Source License 1.1, MIT Future
  License (FSL-1.1-MIT).** Self-hosting for your own organisation stays free
  with every feature. Offering Asset Tracker to others as a competing
  commercial product or hosted service is no longer permitted. Each release
  becomes MIT two years after it is published. v0.12.0 and earlier remain
  available under MIT. Marketing, docs, SEO and OpenAPI metadata now say
  "source-available" instead of "open source".

## [0.12.0] - 2026-10-01

### Added

- **Optional marketing/app domain split.** Set `NEXT_PUBLIC_MARKETING_URL` to
  serve the marketing site on its own host while the app stays on
  `BETTER_AUTH_URL`, from the same deployment. Cross-host requests are
  307-redirected, the app host root goes to login and is excluded from indexing,
  and canonicals, sitemap and OG metadata use the marketing origin. Session
  cookies stay on the app host. An invalid split config fails at startup. Unset
  (the default) changes nothing.

### Fixed

- `robots.txt` and `sitemap.xml` are served without authentication; crawlers
  were previously redirected to the login page.

## [0.11.0] - 2026-09-30

### Changed

- **Marketing site redesign.** Landing, pricing, terms and privacy use a new
  technical design (hairline grid, mono type, lime accent) in light and dark.
  Product visuals are coded mocks with consistent sample data; schematic feature
  cells and an ASCII illustration replace the icon cards. The invented usage
  statistics are removed, and every feature claim is backed by the codebase.
- Marketing pages live in a `(marketing)` route group with scoped `.mkt` theme
  tokens; the app's theme is unaffected. URLs are unchanged.
- The OG image matches the new look.
- README and docs link to the canonical repository `LucaGerlich/asset-tracker`.

### Fixed

- The theme no longer flashes on load: next-themes' pre-hydration script now
  receives the CSP nonce instead of being blocked.
- The OG image is served without authentication, so link previews work.
- The theme toggle button has an accessible name.
- Landing FAQ states the real Starter limits (100 assets, 3 users).
- Self-host commands on the marketing site select the `with-db` compose profile
  and run inside the cloned directory.
- Marketing pages: the skip link works, the sample table is keyboard-scrollable
  on narrow screens, and copied commands exclude the `$` prompt.

## [0.10.0] - 2026-09-08

### Changed

- **MFA enrolment now runs on BetterAuth's `twoFactor` plugin end to end.** The
  settings page enables, verifies, disables and regenerates backup codes through the
  plugin client, so the flag the login gate checks is finally the one enrolment
  writes. **Users who had MFA enabled must enrol again** (the previous flag was never
  enforced at login). LDAP/SSO accounts can enrol without a local password; backup
  codes are stored encrypted. Enrolment, removal, regeneration and TOTP/backup-code
  logins are written to the audit log; the credentials login audit no longer fires
  before the second factor is verified.
- Compliance dashboard: the "User Authentication Controls" check reports real
  two-factor coverage instead of "not yet implemented".

### Security

- Compliance dashboard counts (users, assets, audit logs) are scoped to the caller's
  organization; they were computed across all tenants.
- Vercel builds run `prisma migrate deploy` only when `VERCEL_ENV=production`.
  Preview builds used to migrate whatever database the Preview environment pointed
  at, which on the personal deployment was production.

### Removed

- Custom `/api/auth/mfa/{setup,verify,disable}` routes, `lib/mfa.ts`, the
  `otplib` dependency, the `user.mfaEnabled/mfaSecret/mfaBackupCodes` columns
  (migration `20260908_betterauth_two_factor`) and the unused `encryptArray` helpers.

## [0.9.6] - 2026-09-07

### Security

- Scope the unpaginated `GET /api/statusType` cache key by organization (one
  tenant's status names were served to every tenant for up to five minutes)

### Fixed

- DB-backed cache and lockout suites now pass in CI: keys are cleared before every
  test, TTL tests use a real 1-second TTL instead of fake timers (expiry is decided by
  Postgres `NOW()`), the lockout doubling check tolerates statement drift, and the
  env-validation test removes the CI-injected `DATABASE_URL` explicitly
- Fresh-database `prisma migrate deploy` verified locally and in CI (issue #86)

### Docs

- TECHNICAL_DEBT.md: every deferred item re-verified against the code; strict-mode,
  timestamp and loading.tsx figures corrected; item 29 raised to critical; items
  33–52 added (advertised-but-unfinished features, structural debt) plus a list of
  repository loose ends (issue #86 root cause, stale stash/branches/draft PRs)

## [0.9.5] - 2026-09-02

Release-readiness audit: seven review agents, seven fix agents, ~60 fixes.

### Security

- Organization-scope all 19 by-ID getters in the data layer (17 detail/edit pages
  were readable cross-tenant by UUID) and the EULA template getters/routes
- Close IDOR gaps: organizations/[id] GET (per-org isadmin bypass), asset attachment
  file route (failed open without org), dashboard widget PUT, advanced reports
- Verify OIDC ID token signatures against the IdP JWKS (jose); link accounts only on
  externalId or IdP-verified email
- HTML-escape email template variables; validate Freshdesk domain; encrypt and mask
  Slack/Teams webhook URLs; strip mfaSecret/mfaBackupCodes/ldapDN from user responses
- Cap procurement receivedQty and list limits; make setup guard atomic
- Refuse to boot production with missing or weak required env vars
- Update better-auth to 1.6.30 and all dependencies within their semver ranges
  (0 production advisories, was 1 critical / 53 high)
- Remove orphaned unauthenticated /api/auth/mfa/validate route

### Fixed

- Regenerate stale bun.lock (frozen install and every CI job were failing)
- Docker build: bun + bun.lock, node 22, no migrate in build stage, HEALTHCHECK,
  one-shot migrate compose service
- set-schema.mjs normalizes the schema name per file; committed migrations consistent
- Sentry tunnel /monitoring no longer redirected to /login; overdue-returns cron registered
- CI runs on the development branch; dead demo-reset workflow removed
- Type-check clean including test files; DB-gated suites run in CI with Postgres
- Client: TCO report / role removal / maintenance loads surface errors; accessible
  names on icon-only buttons and the photo lightbox

### Removed

- 14 never-imported components, db-resilience.ts, deleteUser(), tests/setup/prisma-mock.ts,
  the NextAuth-era deployment guide

### Docs

- Deployment guides corrected to BETTER_AUTH_* and the bun toolchain; CHANGELOG
  backfilled 0.5.0–0.9.4; .env.example documents every key the code reads;
  TECHNICAL_DEBT.md rewritten with open decisions (MFA, SSO, strict mode)

## [0.9.4] - 2026-07-07

### Fixed

- **Authentication & cron authorization** — harden auth guards and cron secret enforcement
- **Org scoping** — enforce multi-tenant scoping across all API routes and data layer
- **UI dead-ends** — repair client-side error handling and broken navigation flows
- **Cache invalidation** — fix list, count, and reference cache invalidation on mutations
- **Concurrency & data integrity** — resolve races in checkout and state transitions
- **Plan gating** — close security bypasses in feature gate validation

## [0.9.3] - 2026-06-11

### Added

- **Clickable entity names** — make asset/accessory/consumable/licence names clickable to detail pages

## [0.9.2] - 2026-06-11

### Changed

- **Hero + grouped redesign** — apply detail page hierarchy redesign to accessory and component pages

## [0.9.1] - 2026-06-11

### Added

- **Lazy image loading** — add skeleton placeholders for entity images
- **Detail page redesign** — reorganize asset detail page for clearer visual hierarchy

### Changed

- **Component form** — replace inline selects with reusable SelectWithQuickCreate component

### Fixed

- **S3 bundling** — statically import S3 provider for serverless builds

## [0.9.0] - 2026-06-10

### Added

- **Per-org S3 storage** — route entity attachments through organization-scoped S3 buckets
- **Entity image uploads** — add image support for accessories, consumables, and components
- **Storage config tab** — admin settings to configure per-org storage providers and credentials
- **Entity attachment model** — track attachments with MIME validation and per-org scoping

### Fixed

- **MIME type handling** — harden asset attachments against content-type confusion attacks
- **Storage error messages** — surface real encryption key errors instead of generic messages
- **IDOR protection** — restrict attachment routes to org membership verification

## [0.8.0] - 2026-06-01

### Added

- **Aislop quality gate** — integrate code quality linter configuration

### Changed

- **BetterAuth trustedOrigins** — support all Vercel URL variants (preview, staging, production)

### Fixed

- **React Compiler errors** — resolve compilation errors in mobile-specific hooks
- **Code quality** — 30+ improvements across pages, components, API routes, and libraries
- **Type safety** — improve error handling and type annotations throughout codebase
- **Dependencies** — update Prisma, Next.js, and patch 15 security vulnerabilities

## [0.7.1] - 2026-05-19

### Added

- **SEO infrastructure** — sitemap, robots.txt, JSON-LD schema, OG meta tags
- **Landing page optimization** — keyword-focused content and FAQ section

## [0.7.0] - 2026-05-08

### Added

- **Procurement workflow** — full lifecycle from request to delivery with approval gates
- **Trial flow** — time-limited trial periods for SaaS orgs
- **TCO dashboard** — total cost of ownership tracking by asset category
- **Billing management tab** — usage bars, plan comparison, and limit visualization
- **Plan feature gating** — PlanGate component to restrict features by subscription tier

### Fixed

- **Build command** — read admin settings tab from URL for deep linking
- **Admin nav flash** — prevent non-admin navigation flicker on page load
- **Schema detection** — use actual detected schema instead of hardcoded source

## [0.6.0] - 2026-05-05

### Added

- **Organization suspension** — disable orgs with configurable grace period
- **Quota enforcement** — enforce per-org limits on users, assets, and data
- **Organization defaults** — seed default categories, locations, and settings per org
- **Shared table scoping** — scope 10+ shared tables to organization context

### Changed

- **Admin settings UX** — make sidebar fixed with independent scroll

### Fixed

- **Org access** — gate global settings behind superadmin check
- **Org-scoped endpoints** — fix cross-tenant IDOR on org CRUD, GDPR, Freshdesk routes
- **Sign-up blocking** — restrict user registration on self-hosted instances

## [0.5.3] - 2026-05-05

### Fixed

- **Org scoping** — ensure shared table references use canonical schema qualification (`"assettool"."cache"`)

## [0.5.2] - 2026-04-30

### Security

- **Org security** — prevent cross-tenant updates/deletes and GDPR access bypasses
- **Admin endpoints** — enforce org scoping on all admin write operations

### Fixed

- **Type system** — cast Prisma models to unknown for dynamic model access
- **Response types** — widen withHeaders to accept Response and NextResponse

## [0.5.1] - 2026-04-28

### Security

- **OIDC/SCIM/CSV injection** — close authentication and import security gaps
- **Attachment IDOR** — harden routes against cross-tenant access

### Fixed

- **Silent error catches** — replace with logged handlers in async operations
- **API timeouts** — add configurable timeouts to prevent hanging requests
- **UI quality** — improve accessibility and error handling in components

## [0.5.0] - 2026-04-22

### Added

- **Microsoft Intune device sync** — auto-import managed devices from Graph API with conflict resolution
- **Intune admin settings** — tenant ID, client credentials, test connection, sync controls
- **IntuneSyncLog audit trail** — track status, device counts, errors, duration per sync
- **Asset external tracking** — externalId and externalSource fields for MDM-synced devices
- **Intune cron job** — daily sync at 8 AM UTC via `/api/cron/intune-sync`
- **Help/FAQ page** — user-facing help documentation
- **Intune webhook** — publish `intune.sync_completed` events to Slack/Teams

## [0.4.0] - 2026-04-22

### Added

- **Microsoft Intune device sync** — auto-import managed devices from Intune via Graph API. App-only auth (client credentials), paginated device fetch, conflict resolution by externalId/serialNumber. Auto-creates manufacturers, models, and categories by OS/device type (iPhone, iPad, Mac, Windows Laptop/Desktop, Android, Chromebook, etc.)
- **Intune admin settings tab** — Tenant ID, Client ID, Client Secret (encrypted), Test Connection, Sync Now buttons, auto-sync toggle
- **IntuneSyncLog audit trail** — tracks status, device counts, errors, duration for every sync
- **Asset external tracking** — `externalId` + `externalSource` fields on asset model for MDM-synced devices
- **Intune cron** — daily sync at 8 AM UTC via `/api/cron/intune-sync`
- **Intune webhook + Slack/Teams** — `intune.sync_completed` event with device count notifications

## [0.3.0] - 2026-04-21

### Added

- **Scheduled reports via email** — `ReportSchedule` model with per-user subscriptions for 4 report types (summary, depreciation, warranty, TCO). Daily/weekly/monthly frequency, CSV/XLSX format. Cron at 7 AM UTC generates and emails reports with download links
- **Report subscriptions UI** — manage subscriptions in user settings with add/toggle/delete controls
- **Temporary access grants** — `accessExpiresAt` field on users. Cron at 7:30 AM auto-deactivates expired users with email notifications (7-day warning, 1-day warning, expiry notice to user + org admins)
- **Access expiry badge** — color-coded badge on user detail page (green >30d, yellow 7-30d, red <7d, gray expired)
- **Access expiry date picker** — admin-only field on user create/edit forms with clear button

### Changed

- **Prisma** — updated from 7.6.0 to 7.7.0 (client, CLI, adapter-pg)
- **Export utilities** — `generateCSV()` and `generateXLSX()` now exported for reuse by report generator

## [0.2.1] - 2026-04-21

### Added

- **Auto-release GitHub Action** — creates GitHub Release with categorized release notes from conventional commits whenever package.json version changes

## [0.2.0] - 2026-04-17

### Added

- **TCO (Total Cost of Ownership) dashboard** — aggregates purchase + maintenance + licence costs by category. Dashboard widget + Reports tab with stacked bar chart and breakdown table
- **Asset health score** — composite 0-100 score from age, warranty, maintenance, and depreciation (4x25 points). Dashboard widget with distribution bar + bottom-5 list, per-asset API, health score section on asset detail page
- **Duplicate detection** — flags potential duplicates by same model+location (high confidence), similar serial numbers via Levenshtein distance (medium), similar names (low). Dashboard widget with confidence badges
- **Depreciation export** — 15-column accounting-friendly CSV/XLSX via `/api/export?entity=depreciation` with method, useful life, salvage %, current value, accumulated depreciation
- **Version display** — sidebar shows app version below user profile, auto-read from package.json

### Fixed

- **Migration ordering** — renamed `20260414_item_requests` and `20260414_item_request_returned` to `20260414a_`/`20260414b_` to fix alphabetical ordering in `prisma migrate deploy`

## [Unreleased]

### Added

- **Show/hide password toggle on login** — eye-icon button reveals or hides the typed password on the sign-in form, matching the toggle already used on the user-edit form. Toggle is keyboard-skipped (`tabIndex={-1}`) and labelled for screen readers
- **Role-based dashboard** — non-admin users see "My Dashboard" with their assigned assets, pending requests, and open tickets
- **Reservation notifications** — admins receive email when users request assets; requesters receive email on approval/rejection
- **Ticket notifications** — email notifications on ticket assignment, comments, and status changes
- **Dashboard widgets** — Expiring Licences (color-coded by urgency) and Cost Overview (total value, average) widgets now functional
- **Checkout history on user profile** — shows last 20 checkout/checkin events with status badges
- **Bulk CSV import** for accessories, consumables, licences, and users (previously only assets and locations)
- **QR scanner action panel** — scanning shows asset details card with View Details, Check Out, and Scan Another buttons
- **Report charts** — Cost by Category and Asset Age Distribution added to the Breakdown tab
- **Maintenance completion notification** — emails assigned user with next due date after task completion
- **Accessory and licence detail pages** — `/accessories/[id]` and `/licences/[id]` with breadcrumbs and status badges
- **Not-found pages** for accessory, licence, and consumable detail/edit routes
- **Typed error classes** — `AppError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `RateLimitError`
- **`getBaseUrl()` helper** — centralized URL resolution that throws in production if no URL env var is set
- **Database migration** — new indexes for audit_logs, maintenance_schedules, custom_field_definitions, notification_queue
- **Audit scan workflow** — live QR scan page for active audit campaigns with progress bar, continuous scanning, manual tag entry fallback, and found/missing reconciliation
- **Item templates** — `AssetTemplate` model with CRUD API; "From Template" dropdown on asset create form pre-fills category, manufacturer, model, status, location, supplier, specs, notes
- **Parametric search** — advanced search page at `/search` with entity type selector, dynamic filter rows (field + operator + value), custom field support, and paginated results
- **Booking calendar** — month-view grid calendar showing reservations as colored bars (green=approved, yellow=pending, red=rejected) at `/reservations`
- **Self-service user role** — non-admin users see only their assigned assets/accessories/licences on list pages; Maintenance, Audits, Import hidden from non-admin nav
- **Programmable label templates** — `{{placeholder}}` syntax with `{{#if field}}...{{/if}}` conditionals, live preview in admin settings, backward compatible with old field-array templates
- **Serial number auto-detect** — identifies Apple/Dell/Lenovo from serial patterns, auto-selects manufacturer and category on asset create form
- **Event log with revert** — `createAuditLogWithSnapshot` stores before/after JSON diffs; revert API restores previous state; revert button in audit log viewer for UPDATE actions
- **Sub-locations** — hierarchical parent-child locations with expandable tree table, parent dropdown in create/edit forms
- **Supplier website** — URL field on supplier model, clickable link in table
- **Smart auto-tags** — generates tags from `CATEGORY-MANUFACTURER-MODEL-0001`
- **Asset location map** — MapLibre GL map with auto-geocoding (OpenStreetMap Nominatim), emerald markers sized by asset count, stats overlay, dark/light theme
- **Recently Modified dashboard widget** — shows last 5 edited assets with relative timestamps
- **Quick Create dropdown** — sidebar button to create assets, accessories, consumables, licences, users, locations
- **Cross-browser QR scanning** — jsQR library replaces BarcodeDetector API for Safari/Firefox support
- **Umami analytics** — self-hosted tracking via `next/script` with `afterInteractive` strategy

### Changed

- **Notification dropdown — instant UI via `useOptimistic`** — mark-as-read, delete, mark-all-read, and delete-all now apply to the UI in the same frame the user clicks, instead of waiting for the server round-trip. Failed mutations auto-revert with a toast (rollback is automatic via React 19's `useOptimistic` when the surrounding transition ends without committing). Internally collapses the prior `notifications` + `unreadCount` `useState` pair into one source-of-truth `NotifState` driven by a typed reducer with four action variants, eliminating a class of dual-write desync bugs. "Mark all read" now fires one optimistic update + a single `Promise.allSettled` fan-out instead of N independent state updates that flickered the list. `unreadCount` is adjusted (not derived) because it represents the true server total, which can exceed the displayed limit of 10
- **Performance** — parallelized data fetching with `Promise.all()` on assets, asset detail, and user settings pages
- **Performance** — added 2-minute PostgreSQL cache to 10+ data functions (assets, accessories, consumables, licences, users, categories)
- **Performance** — reduced Sentry trace sampling from 100% to 10% in production
- **Performance** — optimized `pg.Pool` for serverless (max=3 connections, 10s idle timeout, 5s connection timeout, 30s statement timeout)
- **Performance** — deduplicated `orgWhere()` and `ensureCacheTable()` calls on cold starts
- **Performance** — dashboard `StatsWidget` now uses server-fetched counts instead of 3 full API calls
- **Database** — converted `rate_limits` table to UNLOGGED for reduced write overhead
- **Database** — schema-qualified all raw SQL table references (`"assettool"."cache"`, `"assettool"."rate_limits"`)
- **Database** — self-healing table creation if cache/rate_limits tables are missing
- **Accessories filter UI** — compact single-row layout replacing the multi-row filter design
- **Admin settings** — sidebar is now sticky with independent scroll
- **Compliance dashboard** — stub items show "Not Yet Available" instead of misleading "Needs Review"
- **CRON_SECRET** — now required in production (was optional)
- **Validation schemas** — consolidated `validation.ts` and `validations.ts` into single file with stricter schemas
- **API handler types** — added `NextRequest` type annotations to 64 handler functions across 31 files

### Fixed

- **Search injection** — replaced `to_tsquery` with `websearch_to_tsquery` in all 6 search routes
- **QR codes** — replaced hardcoded `192.168.0.81` with `NEXT_PUBLIC_APP_URL`
- **Date serialization** — cached dates (strings from JSONB) no longer crash `.toISOString()` calls
- **Referential integrity** — deleting a manufacturer/location/supplier/status/model referenced by assets returns 409 with count
- **Admin session staleness** — 3 admin settings routes now use `requireApiAdmin()` instead of cached cookie check
- **SCIM privilege escalation** — PATCH handler whitelist prevents setting `isadmin` via SCIM Operations
- **Import security** — CSV user import now generates random bcrypt password hash (was null)
- **Localhost fallbacks** — removed all `|| "http://localhost:3000"` patterns from SSO, invite, and magic link URLs
- **Dead code** — removed `/sentry-example-page`, unused `postData()` export, and `testData` import

### Security

- **Organization scoping** — added `scopeToOrganization` to all write endpoints (POST/PUT/PATCH) for assets, accessories, consumables
- **Ownership verification** — update/delete operations verify the record belongs to the caller's organization
- **Cross-tenant data leaks** — fixed advanced reports, stock alerts, checkout history, kits, components, licence seats, and organizations endpoints
- **Query limits** — added `take: 1000` to unbounded `findMany` in `getAsset` and `getUser` routes
- **DB_SCHEMA validation** — environment variable validated against `[a-zA-Z0-9_]` to prevent SQL injection
- **Webhook OPTIONS** — added authentication to previously unauthenticated endpoint
