# Technical Debt

Last updated: 2026-10-11 (v0.14.0 — Phase 0 tenant isolation; follow-ups in items 53–75)

This document tracks issues found by whole-application audits. Items marked
**FIXED** were resolved in the version noted; **DEFERRED** items are documented
with a recommended fix. The audits so far:

- **2026-07-07 (v0.9.4)** — six specialist agents (UI dead-ends, API logic, client
  React, RBAC/authz, Prisma data layer, cross-cutting consistency). ~55 fixes.
- **2026-09-02 (v0.9.5)** — seven review agents (security, API correctness,
  database, performance, frontend, DevOps/release, test quality) followed by seven
  fix agents. ~60 fixes across 122 files, net −450 lines.
- **2026-09-07 (v0.9.6)** — three read-only agents: every deferred item below was
  re-verified against the code (none had been fixed by accident), plus an
  unfinished-feature sweep and a structural-debt sweep. One live bug fixed
  (status-type cache key), four register figures corrected, items 33–52 added.
- **2026-10-06..11 (v0.14.0)** — Phase 0 tenant isolation and security fixes
  (`docs/superpowers/specs/2026-10-06-phase0-tenant-security-design.md`): a review of
  the SaaS boundary spec plus a code investigation, implemented task by task (29
  commits, 317 files) with an independent review per task. See CHANGELOG 0.14.0. What
  it deliberately left open is items 53–75.

## Summary (as of 2026-09-07; the cross-tenant row updated 2026-10-11)

| Area                               | Status                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CI (lint, typecheck, unit, build)  | green since 2026-09-07 (v0.9.5 fixed the lockfile/typings; the DB suites and the Build job first passed today) |
| Production dependency advisories   | 0 (was 1 critical, 53 high)                                                                                    |
| Cross-tenant data access           | closed for the Phase 0 scope in v0.14.0; four platform-wide leftovers remain (items 53, 57, 62, 65)            |
| MFA login enforcement              | functional since v0.10.0 (enrolment on BetterAuth twoFactor)                                                   |
| SSO (SAML/OIDC) login completion   | **NOT FUNCTIONAL** — decision required (D2)                                                                    |
| TypeScript strict mode             | off; 830 errors to clear (D3)                                                                                  |
| Paid plan feature enforcement      | **5 of 6 gated features unenforced server-side** (item 29, critical)                                           |
| Advertised but unfinished features | 9 (items 33–36, 38–42; item 37 partly closed)                                                                  |
| Unit coverage of auth/tenant layer | partial (api-auth, url-validation, org-suspension now tested)                                                  |

---

## FIXED in v0.10.0 (2026-09-08)

- **D1 resolved.** `MfaSettings.tsx` enrols through `authClient.twoFactor.enable /
verifyTotp / disable / generateBackupCodes`; the custom routes, `lib/mfa.ts`,
  `otplib` and the `mfa*` user columns are gone (migration
  `20260908_betterauth_two_factor`, which also adds the plugin's `verified`,
  `failedVerificationCount` and `lockedUntil` columns to `twoFactor`).
  `allowPasswordless: true` lets LDAP/SSO accounts enrol; backup codes are stored
  encrypted. Audit coverage moved to `lib/auth-two-factor-audit.ts`, driven from the
  BetterAuth `after` hook (enrolment, removal, regeneration, TOTP and backup-code
  logins); the credentials login audit now waits for the second factor.
  **Existing enrolments must re-enrol** — communicate before deploying.
  _Follow-up 2026-09-18 (found by the end-to-end smoke test):_ BetterAuth runs the
  app's `hooks.after` before plugin hooks, so the password step of a 2FA login was
  still audited as a completed credentials login and its soon-deleted session
  enriched. The sign-in hook now skips both when the user has `twoFactorEnabled`;
  the two-factor hook resolves the caller from the session cookie for endpoints that
  return no user, and enriches the session rotated by enable/disable. Production has
  0 users with the old flag, so no re-enrolment notice is needed for this release.
- **Compliance route was cross-tenant**: every count in `api/admin/compliance` was
  global. Now scoped to the admin's organization (403 without one). The dashboard's
  MFA check reports real `twoFactorEnabled` coverage (part of item 37).

## FIXED in v0.9.6 (2026-09-07)

- **CI Build job never ran.** The build script is the Vercel build command
  (set-schema, generate, `migrate deploy`, `next build`) and the job only had a
  placeholder `DATABASE_URL`; the first time it was reached it failed with P1001.
  It now gets the same Postgres service as the unit-test job and runs the real
  command, which also proves a fresh-database migration on every push.
- **DB-backed suites were not runnable in CI** (fake timers vs Postgres `NOW()`, key
  leakage between tests, ms-exact timestamp comparison, CI-injected env var).
  Fixed; 493 tests pass in CI.
- **Cross-tenant cache key** in `api/statusType` GET (unpaginated path): the
  org-filtered query was cached under the fixed key `status_types`, so the first
  tenant to populate the shared cache table served its status names to every
  tenant for five minutes. Key is now `status_types:<orgId|global>`; a route test
  asserts per-organization keys. The three dashboard routes that call `cached()`
  directly were already org-keyed; `data.ts` getters are safe via `strictOrgWhere()`.

## FIXED in v0.9.5 (2026-09-02)

### Release blockers

- `bun.lock` was three months behind `package.json`; `bun install --frozen-lockfile`
  failed in every CI job and the lock still pinned the vulnerable `next@16.2.4`.
  Regenerated; dependencies updated within their semver ranges.
- `better-auth` 1.6.9 → 1.6.30 (fixes OAuth auto-link account takeover and three
  other advisories). Pinned to `~1.6.x` — **1.7 requires an `account`-table schema
  migration** (issuer/accountId fields, SCIM model replacement); plan it as its own task.
- `tsc --noEmit` failed on test files (Prisma mock typings) and on `src/lib/stripe.ts`
  (SDK-pinned apiVersion literal). Both fixed; CI typecheck job is green.
- Dockerfile could never build: `npm ci` with a gitignored `package-lock.json`, and
  `prisma migrate deploy` inside the image build stage with no database. Now uses
  bun + `bun.lock`, node:22, no migrate at build, `HEALTHCHECK`; migrations run via a
  one-shot `migrate` compose service the app waits on.
- Committed `schema.prisma` said `public` while 25/27 migrations said `assettool`;
  `set-schema.mjs` early-exited when names matched, so a `DB_SCHEMA=public` deploy
  would split tables across two schemas. Rewriter now normalizes every file; the
  committed state is consistently `public`.
- CI only triggered on `master`/`main` — added `development`. Removed the dead
  `demo-reset.yml` workflow (gated on a non-existent `main`, used `npm ci`).
- `validateAndLogEnvironment()` only logged; a production server with a missing or
  weak `BETTER_AUTH_SECRET` booted normally. `instrumentation.ts` now throws (skipped
  during `next build`). `STRIPE_*` required when not self-hosted.

### Cross-tenant isolation (second wave)

- **All 19 by-ID getters in `src/lib/data.ts`** (`getAssetById`, `getLicenceById`,
  `getUserById`, all category getters, …) were bare `findUnique` calls with no
  organization filter — any authenticated user could open any tenant's detail/edit
  page by UUID (17 pages). Now `findFirst` + `strictOrgWhere()`; pages 404 on miss.
- **EULA templates** were fully cross-tenant: `getEulaTemplates()` had a global cache
  key, `/api/eula` GET/POST/PUT/DELETE and `/api/eula/[id]` never scoped, POST never
  set `organizationId`. All scoped; fail closed on missing org.
- `/api/reports/advanced` read every tenant's locations and maintenance logs.
- `GET /api/organizations/[id]`: per-org `isadmin` bypassed the ownership check
  (`isadmin` is not a platform flag). Only `requireSuperAdmin` may cross orgs; 404 otherwise.
- `/api/asset/attachments/file/[filename]` failed **open** when `orgId` was null
  (LDAP/SSO-created users have none). Now 403, matching the sibling route.
- `PUT /api/dashboard/widgets` updated any widget by id; now scoped to the caller.
- `/api/user` responses leaked `mfaSecret`, `mfaBackupCodes`, `ldapDN`.
- `getEntityHistory` (audit trail on detail pages) scoped through the acting user's org.

### Auth / SSO / input hardening

- OIDC ID tokens were base64-decoded and trusted without signature verification
  (CWE-347). Now verified against the IdP JWKS with `jose`; fails closed without a
  `jwks_uri`. Callbacks link existing accounts only on `externalId` or an
  `email_verified` claim; username matching removed (OIDC and SAML).
- Email templates interpolated asset/user names raw into HTML (`renderTemplate`);
  values are HTML-escaped, subjects use `renderTextTemplate`.
- Freshdesk `domain` was interpolated unvalidated into `https://${domain}.freshdesk.com`
  (host-string injection / SSRF). Validated on write and read.
- Slack/Teams webhook URLs (bearer-equivalent secrets) stored plaintext and returned
  unmasked; now encrypted and masked like LDAP/SSO settings.
- Procurement receive: `receivedQty` had no upper bound and drove a per-unit
  `asset.create` loop in one transaction; capped and checked against the remaining
  ordered quantity. `requests`/`notifications` `limit` clamped to 1..100.
- Setup wizard `user.count()` guard made atomic (Serializable transaction, P2034 → 409).
- Attachment upload echoed `error.message` to the client; now generic.
- Removed orphaned unauthenticated `/api/auth/mfa/validate` (took a client-supplied
  user id; nothing called it).
- Sentry tunnel `/monitoring` was redirected to `/login` for anonymous visitors.
- `/api/cron/overdue-returns` existed but was never scheduled; registered in `vercel.json`.

### Client / dead code / docs

- TCO report, role removal and maintenance dropdown loads swallowed failures silently.
- Accessible names on icon-only buttons and the photo lightbox dialog.
- Deleted 14 never-imported components (472 lines), `db-resilience.ts` (never wired),
  `deleteUser()` (no callers), `tests/setup/prisma-mock.ts` (superseded).
- Docs: removed the NextAuth-era deployment guide; `DEPLOYMENT.md` used
  `NEXTAUTH_*` names the app never reads; README said `npm install` / Node 18 (Next 16
  needs ≥20.9, lockfile is bun). CHANGELOG backfilled 0.5.0–0.9.4. `.env.example` now
  documents every key the code reads.
- Enabled the four strict sub-flags that produce zero errors
  (`strictBindCallApply`, `noImplicitThis`, `alwaysStrict`, `noFallthroughCasesInSwitch`).

---

## DEFERRED — decisions required

**D1. MFA is bypassable.** _Resolved in v0.10.0 — see FIXED above._ Follow-ups left
open: org-wide "require MFA" policy and an admin "reset MFA for user" action (neither
existed before either).

**D2. SSO login never completes (high).** SAML/OIDC callbacks create/link the user,
mint a one-time token and redirect to `/login?sso_user=&sso_token=`; nothing reads
those params (`LoginForm.tsx`) and BetterAuth has no SSO-token sign-in hook, so the
user lands on the login form. SSO-created users also get `organizationId = null`,
which makes every `strictOrgWhere()` call throw for them.
_Recommended:_ replace the custom flow with BetterAuth's `@better-auth/sso` plugin
(OIDC + SAML, per-organization). Cheaper interim: establish the session server-side in
`/api/auth/sso-login` via BetterAuth's internal adapter and assign the org from the SSO
settings. Either way, decide which org SSO users belong to.

**D3. TypeScript strict mode (user standard: strict everywhere).** 830 errors as of
2026-09-07, measured with
`tsc --noEmit -p tsconfig.json --strict --noImplicitAny --strictNullChecks --useUnknownInCatchVariables --noUnusedLocals --noUnusedParameters --noImplicitOverride`
(767 without the unused/override flags; `--strict` alone reports only 144 because
`tsconfig.json` sets `noImplicitAny`/`strictNullChecks` to `false` explicitly and
those win). 116 explicit `any`. The per-flag split recorded in v0.9.5 (noImplicitAny
≈372, strictNullChecks ≈400, useUnknownInCatchVariables 139) predates the dead-code
removal and totals 958; re-split before starting phase 1. _Phased plan:_ (1) `useUnknownInCatchVariables` — mechanical
`error instanceof Error ? error.message : String(error)` across 139 catch blocks;
(2) the 20 small-flag errors; (3) `noImplicitAny` per directory (API routes first —
the 7 category/reference routes alone account for ~80); (4) `strictNullChecks` last.

**D4. `mobile/` Expo app** is SDK 52 / RN 0.76 / React 18, has no lockfile, is
excluded from `tsconfig` and CI, and was last touched on 2026-06-01 (three commits in total). Keep-and-upgrade
(Expo 55 per the house conventions) or delete it from this repo.

## DEFERRED — security hardening

1. **Webhook DNS-rebinding TOCTOU** (`lib/webhooks.ts:140`): `validateOutboundUrl`
   resolves DNS, then `fetch` resolves again. Pin the validated IP with an undici
   `Agent({ connect: { lookup } })` dispatcher (add `undici` as a direct dep) or
   re-validate inside a custom lookup.
2. **Demo reset wipes the whole database** (`api/cron/demo-reset`): triple-gated by
   env, but unscoped `deleteMany()` on every table. Add `Organization.isDemo` and delete
   only within demo orgs.
3. **`rejectUnauthorized: false`** for cloud DB TLS (`lib/prisma.ts:14`). Add
   `DATABASE_SSL_CA` support and verify in production.
4. **CSP `'unsafe-eval'`** in `proxy.ts`. Identify the dependency that needs it and
   scope or remove.
5. **`getClientIP` trusts `x-forwarded-for` unconditionally** (`lib/rate-limit.ts`).
   On Vercel prefer the platform header; self-hosted needs a trusted-proxy setting.
6. **Sentry `beforeSend`** scrubbing absent in all three configs (relies on
   `sendDefaultPii:false` only).
7. **Vercel preview deploys ran `prisma migrate deploy`** against whatever
   `DATABASE_URL` the preview has. _Fixed in v0.10.0_: `vercel.json` now runs the
   migration only when `VERCEL_ENV=production`. This was found the hard way — the
   preview build of PR #87 applied the column-dropping MFA migration to the personal
   deployment's production database (its Preview and Production environments share
   `DATABASE_URL`) and broke sign-in on the June build until the columns were restored.
   Still open: give Preview its own database, and keep the production URL out of
   local `.env` files (the checked-out `.env` pointed at production too).
8. `.mcp.json` points at a work Sentry org from a private repo — remove before any
   open-sourcing.

## DEFERRED — data layer

8a. **Production database is shared with other applications** (found 2026-09-18,
read-only inspection of the personal deployment's DB): the `postgres` database
holds six schemas (`app` 140 tables, `andl_cms`, `control`, `web_analytics`,
`burger`, `public`); our tables live in `public` next to a Django app's
(`auth_*`, `core_*`, `django_*`), and two other Prisma apps record their
migrations in the same `public._prisma_migrations` table (ten rows unknown to this
repo). `migrate deploy` copes (it only applies pending migrations from this repo,
proven 2026-09-07), but any `migrate reset`, `db push --force-reset` or a
table-name collision from any of the apps would damage the others. A database named
`asset` already exists on the same server and is empty of our tables — move this
app there (dump/restore `public` minus the Django tables, repoint `DATABASE_URL`
in Vercel Production/Preview and local `.env`), then Preview can get its own
database too (item 7).

9. **User cascade deletes** (`schema.prisma`): `AssetCheckout`, `tickets`,
   `PurchaseRequest`, `GoodsReceipt`, `AssetReservation` cascade on user delete,
   destroying audit/financial history. Latent today (no hard-delete path after
   `deleteUser()` removal) — migrate to `SetNull` before adding one.
10. **Migration `20260505_scope_shared_tables`** backfilled every shared row to
    `(SELECT id FROM organizations LIMIT 1)`. If production had more than one org at
    that time, audit shared-table ownership now (rows whose org ≠ their dependants' org).
11. **Partial unique index** `item_requests_active_unique` exists only in SQL, not in
    `schema.prisma` (documented with a comment there in v0.9.5). A future
    `migrate dev` could drop it — keep the comment and check `migrate diff` output.
12. `IntuneSyncLog.organizationId` has no index or FK.
13. **Timestamp columns without timezone** (150 fields `@db.Timestamp(6)`, no `Timestamptz` anywhere) — migrate
    to `Timestamptz`. (carried from v0.9.4)
14. **Global unique `asset.assettag` / `serialnumber`** — should be per-org.
    (carried from v0.9.4)
15. **Quota TOCTOU** in `tenant-limits.ts`, and quota checks skipped in
    `procurement/receive`, `integrations/intune.ts`, `ldap.ts`. (carried from v0.9.4)

## DEFERRED — performance

16. **Unbounded "no `page` param" fallback** returns the whole table in ~25 list
    routes, and `getAssets()` caches an org's entire asset table as one JSONB blob
    consumed by `assets/page.tsx` and `user/[id]/page.tsx`. Make pagination the
    default and update `DashboardTable` and other array-shaped consumers.
17. **N+1 loops**: `workflow-engine.ts` re-queries rules per entity; `ldap.ts` does
    2–3 queries per directory user (up to 5000); `notifications.ts` fetches
    preferences per row; `cron/overdue-returns` re-fetches admins per request;
    `integrations/intune.ts` looks up assets per device. Batch with `in` queries.
18. **Detail pages over-fetch**: `assets/[id]/page.tsx` loads all users,
    manufacturers, models, categories, suppliers and userAssets to resolve six FKs;
    `user/[id]/page.tsx` loads every org asset/accessory/licence to filter in memory.
    Use `include`/targeted lookups.
19. **Cache table**: `invalidatePattern` uses `LIKE 'prefix%'` with no
    `text_pattern_ops` index (sequential scan on every mutation); no in-memory L1
    despite Fluid Compute reusing instances.
20. **`DashboardTable.tsx` (2388 lines)**: O(n) `.find()` per row in sort/render,
    a 1-second `setInterval` re-rendering the whole table, unguarded overlapping
    `refreshData` fetches, no props interface. Split into column defs / dialogs /
    hooks; use `Map` lookups.
21. XLSX export builds the workbook in memory (`api/export`); CSV already streams.
22. `jsqr` imported eagerly on scanner pages.

## DEFERRED — product / consistency (carried from v0.9.4)

23. Global search only covers asset/user/consumable (registry advertises more).
24. i18n infrastructure unwired; language selector persists a preference nothing reads.
25. `notifyAssetAssignment` / `notifyAssetUnassignment` never called.
26. Audit-log gaps: user UPDATE, licence assign/unassign, status change.
27. Export coverage: components/kits; the Help page describes a non-existent button.
28. Webhook registry advertises six events never fired.
29. **(critical)** "Procurement" nav shown regardless of plan; `custom_fields`, `workflow_automation`,
    `advanced_reports`, `tco_dashboard`, `scim` sold as paid but enforced nowhere. Verified 2026-09-07: `requirePlanFeature` is called only for `ldap`, `sso`, `api_keys` and `procurement`; the other five have no server-side check at all, so the paid tiers are a UI label. _Update 2026-10-11:_ Phase 0 removed the `ldap` and `sso` checks (those settings are operator-level, item 59), so only `api_keys` and `procurement` are enforced now.
30. Dead code: `Footer.tsx`, three unused `DashboardTable` variants.
31. Seven near-identical simple create forms (~890 lines) → one config-driven form.
32. 37 route segments lack `loading.tsx` while a sibling has one (83 of 103 page
    directories have none at all).

## DEFERRED — advertised but unfinished (found 2026-09-07)

Each of these is visible to users or admins as a working feature and is not.
Decide per item: finish it or remove the promise.

33. **EULA at checkout never enforced.** `admin/settings/ui/EulaTab.tsx` says templates
    are "used for asset checkouts" and `assetCategoryType.eulaTemplateId` exists, but
    no checkout route or dialog reads it and the `EulaAcceptance` model has zero
    readers or writers in `src/`. The whole signature subsystem exists only in the
    schema. Effort L.
34. **SCIM cannot be configured.** `lib/scim.ts` requires a `ScimToken` row (or a
    legacy `system_settings` key); nothing in the codebase ever creates one, so every
    SCIM request returns 403 "SCIM is not configured". Needs an admin UI to
    generate/rotate a per-org token. Effort M.
35. **Custom fields only round-trip for assets.** `CustomFieldsSection` is rendered in
    the accessory/consumable/licence/component create forms, but none of their edit
    forms or detail pages read `GET /api/custom-fields/values`, so values are entered
    once and never seen again. Kits are offered as a custom-field entity
    (`entity-registry.ts` `hasCustomFields: true`) yet render no fields anywhere.
    Effort M.
36. **`white_label` is vaporware.** Listed as an Enterprise perk in
    `plan-features-shared.ts` and `docs/DEVELOPMENT_NOTES.md`; no branding feature,
    no schema, no gate. Implement or remove from the plan matrix. Effort L / S.
37. **Compliance dashboard hard-codes two checks**
    (`admin/compliance/ui/ComplianceDashboard.tsx`): encryption coverage says "not
    yet implemented", and the incident-response check ignores its input and always
    returns "Not Configured". (MFA coverage is real since v0.10.0.) Effort S (remove)
    / M (back with settings).
38. **`email_templates` table is loaded and discarded.** `admin/settings/page.tsx`
    fetches it and `AdminSettingsPage.tsx` binds it to `_emailTemplates`; there is no
    editor and no route, and all outbound mail uses the hard-coded object in
    `lib/email/templates.ts`. Build the editor or drop the table. Effort M.
39. **Write-only user preferences.** `theme` is saved but the app theme comes from
    `next-themes`/localStorage; `pageSize` is saved but no table seeds its default
    from it; `dashboardLayout` exists in schema, context and API with zero writers
    (`updatePreferences(` has no call sites). Effort S / M / L respectively.
40. **`userHistory` is never written.** Only read by the GDPR export (always `[]`)
    and wiped by demo-reset. Decide whether `audit_logs` superseded it, then delete or
    implement. Effort S / L.
41. **Docs promise plan-tiered audit retention** (30/90/unlimited days);
    `lib/gdpr-settings.ts` has one global `auditLogRetentionDays`. Fix the doc or
    implement tiering. Effort S / M.
42. **Server-side pagination plan abandoned.**
    `docs/superpowers/plans/2026-03-20-server-side-pagination.md` has 0 of 28 tasks
    done; the `usePaginatedFetch` hook it introduced has zero consumers. Same problem
    as item 16 — either resume the plan or delete the hook and the plan file.

## DEFERRED — structural (found 2026-09-07)

Patterns that will slow every future feature. Numbers are from the tree at v0.9.6.

43. **No shared API route wrapper.** 207 route files each hand-roll guard + try/catch +
    `NextResponse.json`; guards are split across `requireApiAuth` (68 files),
    `requirePermission` (58), `requireApiAdmin` (41), `requireSuperAdmin` (17). Only
    58 routes return the `{ success, ... }` envelope and only 35 import the shared
    zod module in `lib/validation.ts`. Introduce `withApiRoute(handler, { auth,
schema })` and retrofit high-traffic routes first.
44. **Org scoping is call-site discipline.** `strictOrgWhere()` — the only primitive
    that throws when org context is missing — is private to `lib/data.ts` (0
    exports). Routes hand-write `organizationId:` 210 times across 90 files, and
    enrichment queries of the form `findMany({ where: { id: { in: ids } } })` (e.g.
    `api/requests/route.ts`) carry no org filter — safe only while `ids` comes from
    an already-scoped query. Export a required org-where helper, add a
    `cacheKeyForOrg(prefix, orgId)` helper (the v0.9.6 bug was exactly this), and
    consider a lint rule. Only 4 routes call `cached()` directly outside `data.ts`.
45. **Client data fetching has no shared layer.** 118 `.tsx` files call
    `fetch('/api/...')` directly; 55 hand-roll loading state and 30 hand-roll error
    state. `public/openapi.json` is hand-maintained with no generation script and
    will drift from the zod schemas. Generate it from `lib/validation.ts`.
46. **Forms.** 27 `*Form.tsx` components, none use react-hook-form (not a
    dependency) or a shared field primitive; every form duplicates error display and
    submit state. Solve together with item 31.
47. **Prisma schema conventions.** 80 models, 0 `enum` types — 14+ `status` columns
    are free-text VarChar with the valid values in comments. Model names are split 42
    snake/lowercase vs 38 PascalCase. Freeze new models to PascalCase; convert status
    columns to enums opportunistically. `OrganizationStorageConfig.organizationId`
    also lacks an index (like item 12).
48. **Dead weight.** `react-qr-code` and `@aejkatappaja/phantom-ui` are dependencies
    with zero imports (`qrcode.react` is the one in use); `components/ResponsiveTable.tsx`
    (116 lines) has zero importers next to `components/ui/responsive-table.tsx` (15
    importers); `hooks/usePaginatedFetch.ts` has zero consumers. `maplibre-gl` is
    statically imported in `AssetMap.tsx`. Remove / dynamic-import.
49. **Large files beyond item 20.** `DashboardGrid.tsx` 1295, `ApprovalsPageClient.tsx`
    1198, `ReportsPage.tsx` 978, `AssetCreateForm.tsx` 860, `WebhooksTab.tsx` 860,
    `WorkflowsPageClient.tsx` 810 (house limit 800); 33 more files between 500 and 800.
50. **Test fixtures.** 34 test files; `@faker-js/faker` is installed but unused and
    there is no Prisma-row factory, so each new route test starts from ad-hoc literals.
    Build a factory before attempting the 195 untested routes.
51. **Config sprawl.** 44 files (113 sites) read `process.env` directly outside
    `lib/env-validation.ts`; feature toggles are scattered.
52. **Component placement.** Three coexisting conventions — `src/components` (88
    files), `src/ui/<entity>` (54 files, 16 dirs) and per-route `src/app/*/ui` (56
    dirs) — with the same entity split across two of them. Pick colocated per-route
    `ui/` and migrate `src/ui/*`.

## DEFERRED — Phase 0 follow-ups (found 2026-10-07..11)

Phase 0 (v0.14.0, spec `docs/superpowers/specs/2026-10-06-phase0-tenant-security-design.md`)
closed the cross-tenant and privilege holes it listed. Items 53–59 are the spec's
"Out of scope" list; items 60–75 surfaced while implementing and reviewing it. Items
that still cross a tenant boundary are 53, 57, 62 and 65 (and 69, a member count);
everything else is correctness, hardening or a decision. File:line references are
from the tree at the end of Phase 0.

### Named out of scope in the spec

53. **LDAP sync is not organization-aware (high)** (`lib/ldap.ts:266`, `:334`, `:351`;
    `api/cron/ldap-sync/route.ts:31`). The existing-user lookup is
    `findFirst({ OR: [{ externalId }, { username }] })` with no org filter, so a
    directory entry whose username equals a user of another org overwrites that user's
    name, email, `ldapDN` and `authProvider` and re-activates the account. New users get
    `organizationId: organizationId || null`, and the cron route calls
    `syncUsers(undefined, "cron")`, so they are org-less (invisible to every org-scoped
    query, and a 500 for `strictOrgWhere()` callers); `autoDeactivateUsers` then covers
    every org's LDAP users. _Recommended:_ LDAP is one platform directory today, so pick
    the org it feeds (an `LDAP_DEFAULT_ORGANIZATION_ID` like the
    `SSO_DEFAULT_ORGANIZATION_ID` added in v0.13.1), match only users of that org and
    refuse to sync without it. Per-tenant directories belong to item 59.
54. **OIDC and SAML callbacks create org-less users (high)**
    (`api/auth/callback/oidc/route.ts:88`, `api/auth/callback/saml/route.ts:55`). No
    `organizationId`, no `assertEmailAssignable`, and the SAML lookup matches
    `profile.email` case-sensitively without normalising it. The one-time token flow
    still never starts a session (`api/auth/sso-login/route.ts`; D2). v0.13.1 fixed only
    BetterAuth's Microsoft OAuth path. _Recommended:_ resolve D2 first; the replacement
    must set the org from the SSO settings, lower-case the email and run it through
    `assertEmailAssignable`.
55. **`/api/setup` lets the first caller become admin (high on a fresh, reachable
    instance)** (`api/setup/route.ts:67-79`; `/setup` is a public route, `proxy.ts:87`).
    While `user` is empty anyone who reaches the endpoint creates the organization and an
    admin. There is no setup secret, and `ALLOW_PUBLIC_SIGNUP` and `SUPER_ADMIN_EMAILS`
    are ignored. The Serializable transaction stops two admins, not a stranger winning
    the race against the owner. _Recommended:_ require a one-time `SETUP_TOKEN` env value
    (or drop the HTTP route and keep `scripts/create-admin.mjs`); when
    `SUPER_ADMIN_EMAILS` is set, accept only a listed address.
56. **Per-IP rate limit trusts `x-forwarded-for`; register answers reveal accounts
    (medium)** (`lib/rate-limit.ts:200`, same as item 5; `api/auth/register/route.ts:95`,
    `:115`). A caller who rotates a spoofed header gets a fresh bucket for login,
    register and every other limiter. Register answers 409 "Username/Email is already
    taken", which enumerates accounts wherever `ALLOW_PUBLIC_SIGNUP=true`. _Recommended:_
    item 5 for the header (platform header on Vercel, trusted-proxy setting
    self-hosted); one generic answer plus an email confirmation step for register.
57. **Email templates, label templates and depreciation settings are platform-wide
    (high)** (`email_templates`, `label_templates`, `depreciation_settings` in
    `prisma/schema.prisma` have no `organizationId`). Every org admin can list, edit,
    delete and default every tenant's label layouts (`api/admin/labels/route.ts:15,57,63`,
    `api/admin/labels/[id]/route.ts:37,43,82`, `api/admin/labels/[id]/default/route.ts:25,31`;
    read by `api/labels/pdf/route.ts:32`), and the settings page loads all three
    (`admin/settings/page.tsx:69,75`, `admin/settings/data.ts:48`). Depreciation settings
    feed every tenant's TCO, fleet value, health score, export and reports
    (`api/dashboard/tco/route.ts:81`, `fleet-value/route.ts:33`, `health-score/route.ts:50`,
    `api/export/route.ts:360,390`, `api/reports/advanced/route.ts:258`,
    `lib/report-generator.ts:101`). The `rate_limits` view named in the spec is fixed:
    `/api/admin/rate-limits` and its tab are super-admin only. _Recommended:_ nullable
    `organizationId` (FK cascade, index) on the three tables, a backfill in the style of
    `20260505_scope_shared_tables`, org-scoped reads and writes, and `NULL` rows kept as
    read-only platform defaults. `email_templates` is also dead data (item 38).
58. **Callers treat the offline queue's 202 as a real response (medium)**
    (`public/sw.js:166`). A queued change is answered `202 { queued: true, id }`;
    `Response.ok` is true for 202 and nothing under `src` reads `queued`, so forms toast
    success and navigate on for a change that may later be blocked (403 `org_read_only`, 409) or dropped (400/404). _Recommended:_ one fetch wrapper that returns a `pending`
    result for `202 && queued`, a "waiting to sync" state on the row, and a link to the
    queue indicator.
59. **SSO, LDAP, Intune and integrations are operator-level (decision)** (programme
    sub-project 6, per-tenant SSO). They are platform-wide `system_settings` rows that
    only a super-admin writes; Phase 0 removed the per-org `requirePlanFeature` checks
    from the SSO and LDAP PUTs because no tenant can configure them. Every tenant shares
    one IdP and one directory. _Recommended:_ per-org IdP and directory settings as
    specified in `2026-10-05-saas-boundary-design.md`; items 53 and 54 are prerequisites.

### Found while implementing Phase 0

60. **Mobile offline queue has no user binding** (`mobile/src/services/offline.ts:38-54`,
    `sync.ts:47-52`; `SettingsScreen.tsx:78` clears it only on request). The web queue
    stamps entries with the user id, refuses credential routes and clears on sign-out
    (`public/sw-queue-rules.js`, `src/lib/offline-queue.ts`); the mobile one does none of
    that. `addToSyncQueue` has no callers today, so nothing is exposed yet. _Recommended:_
    the first enqueuer must stamp the user id, skip auth and credential routes with the
    same rules as the service worker, and clear the queue on logout.
61. **No unique index on `lower(email)`**. `user.email` is unique case-sensitively, so
    `Root@x.io` can coexist with `root@x.io`. Phase 0 makes `isSuperAdmin` fail closed on
    such a duplicate (`lib/super-admin.ts:37-52`) and routes the app's email writers
    through `assertEmailAssignable`, but unguarded writers can still create a variant
    (SSO callbacks, item 54; `/api/setup`), which locks the listed super-admin out
    (availability, not privilege). _Recommended:_ list `lower(email)` duplicates on the
    shared production DB (item 8a) first, then add a unique index on `lower(email)` and
    send the remaining writers through `assertEmailAssignable`.
62. **A same-org tenant admin can edit a super-admin account (high if one lives in a
    tenant org)** (`api/user/route.ts:154-233`). PUT lets any admin edit any user of the
    same org, including email, `isadmin` and password (`setUserPassword`). A super-admin
    is identified by email only, so such an admin can reset its password and take over
    platform rights. Mitigation today: keep super-admin accounts in an operator org.
    _Recommended:_ refuse changes to a target for which `isSuperAdmin(target)` holds
    unless the caller is a super-admin too (PUT, addUser, import, SCIM, LDAP), or give
    the platform role its own flag.
63. **Legacy SCIM token authenticates as an arbitrary org** (`lib/scim.ts:64-103`). With
    no `scim_tokens` row at all, a global `system_settings` `scim.bearerToken` is
    accepted and mapped to `organization.findFirst()` (unordered). _Recommended:_ remove
    the fallback once per-org tokens can be created (item 34).
64. **Unqualified full-text queries fall back silently** (`api/asset/route.ts:87`,
    `api/accessories/route.ts:105`, `api/user/route.ts:109`, `api/components/route.ts:68`,
    `api/licence/route.ts:77`). `SELECT ... FROM "asset"` has no schema, so it relies on
    `search_path`. On any deployment whose `DB_SCHEMA` is not `public` the relation is
    not found and `.catch(() => null)` falls back to `ILIKE`, so the
    `websearch_to_tsquery` search is dead there and nothing shows it (the `search_vector`
    columns come from `20260310_pg_infrastructure` and `20260310_extend_fts`).
    _Recommended:_ qualify with the `"${S}"."table"` pattern from
    `lib/user-email-query.ts` and cover it with a DB-gated test.
65. **Slack/Teams notifications are platform-level (medium)**
    (`lib/integrations/slack-teams.ts:258`; 26 call sites in 21 files, e.g.
    `api/asset/route.ts:224,306`, `api/asset/updateStatus/route.ts:153`,
    `api/asset/checkout/route.ts:197`). `notifyIntegrations` reads the one global
    integration setting, so on a multi-tenant deployment every tenant's asset events
    (names, tags, assignees) go to the operator's channel. Ruled in Phase 0: integrations
    are operator-level like SSO and LDAP. _Recommended:_ per-org integration settings and
    an `organizationId` argument (as `triggerWebhook` has); until then leave the
    integration disabled on shared deployments.
66. **Invite acceptance is not atomic and compares email case-sensitively**
    (`api/team/invite/[token]/route.ts:127`, `:137`, `:151`, `:221`, `:263`). Two
    concurrent accepts of one token both pass the `pending` check and the user-limit
    check before the status update; the existing-user lookup and the session comparison
    are case-sensitive, so a mixed-case invite for an existing user answers 401. The
    invite page still shows the accept form for an invite whose role belongs to a
    foreign org (the API answers 410). _Recommended:_ claim the invite with
    `updateMany({ where: { id, status: "pending" } })` inside the transaction and check
    the count; compare lower-cased emails; apply the role check on the page too.
67. **The workflow engine cannot run rules created in the UI** (`lib/workflow-engine.ts:338-341`).
    The engine parses `rule.conditions` as an array and actions as `{ type, config }`
    with `trigger_webhook`; the UI stores conditions as an object and actions such as
    `{ type: "webhook", recipients, messageTemplate, webhookUrl }`, so UI-created rules
    land in the per-rule error list (pinned by a test in `workflow-engine.test.ts`).
    Also: `asset_status_change` has no emitter, and org-less legacy assets on a
    self-hosted install no longer trigger rules (one warning). Pre-existing; Phase 0
    scoped the engine but did not repair its input format. _Recommended:_ one zod rule
    schema (`createAutomationRuleSchema`) shared by the UI, the API and the engine; add
    the emitter; backfill `organizationId` on legacy assets. See also item 29.
68. **Custom field leftovers** (`lib/organization-context.ts:174-180`,
    `lib/validation.ts` custom field schema, `api/custom-fields/values/route.ts:152`).
    `verifyEntityOrgOwnership` maps `component` to the delegate `"Component"` and has no
    `kit`, so values for components and kits answer 404 (fail closed; see item 35).
    Existing definitions with a `fieldType` outside the six UI types, or
    `entityType: "license"`, now fail a full PUT. Value upserts are not transactional and
    the value is not validated against `fieldType`. `admin/settings/ui/CustomFieldsTab.tsx`
    is unused legacy code. There are no page-level tests for the scoped definitions.
    _Recommended:_ check production data for the odd types, fix the map, validate values
    by type inside one transaction, delete the legacy tab.
69. **Org-less users are handled inconsistently** (`lib/data.ts:133-160`,
    `lib/organization-context.ts:118` `scopeToOrganization`, `api/roles/route.ts:44`).
    Reads fail closed, but differently: the picker helpers (`getUserOptions`,
    `getAssetOptions`, `getLocationOptions`) throw through `strictOrgWhere()` and answer
    500 where routes answer empty or 404. `scopeToOrganization` maps "no org" to
    `organizationId: null`, so an org-less admin still reads and edits org-less rows
    (departments, user PUT). A global role's `_count.userRoles` counts members across
    tenants (count only). Since 0.14.0 global roles are editable by super-admins only;
    an org admin who relied on editing a legacy global custom role must copy it into the
    org. _Recommended:_ finish items 53 and 54 so every user has an org, backfill, make
    `user.organizationId` NOT NULL and delete the `null` branch.
70. **Billing and suspension edge cases** (`app/suspended/page.tsx:47`,
    `api/billing/portal/route.ts:28`, `proxy.ts:185`, `lib/org-lock-redirect.ts:55`,
    `api/organizations/route.ts`). `/suspended` offers the billing portal only, never
    checkout, so a cancelled org cannot resubscribe from it; the portal form POST shows
    raw JSON on failure (for example no `stripeCustomerId`) instead of hiding the button
    or returning to `/suspended?billing=error`; `SignOutButton.tsx` has no failure toast.
    The lock redirect runs a session lookup plus a user/org query on every signed-in
    page navigation including RSC prefetches (cache it per session for ~30 s). A
    super-admin whose own org is read-only cannot create organizations
    (`requireWritableOrg` stays on that POST). Migration `20261007b` cannot tell a billing
    lock from an operator lock: an org that was both is reopened as read-only (re-lock
    it through `isActive`). _Recommended:_ add a checkout button and the failure states;
    cache the lock lookup.
71. **Settings storage details** (`api/admin/settings/sso/route.ts:99-120`, same pattern
    in `intune/route.ts`). Saving an empty secret stores an encrypted empty string rather
    than clearing the row; the upsert's `update` branch never sets `isEncrypted`, so a key
    first stored in plain text stays flagged plain after an update that now encrypts it.
    `emailTemplates` on the settings page is dead data (item 38). The Location Tracking
    tab (`admin/settings/ui/LocationTrackingTab.tsx`) is local React state with no API,
    so it holds nothing to leak, but it is an unfinished feature (see items 33–42).
    _Recommended:_ treat `""` as delete, set `isEncrypted` in both branches, drop the dead
    props.
72. **Library error text still reaches super-admins** (`api/admin/settings/email/test/route.ts:41`,
    `ldap/test/route.ts`, `intune/test/route.ts`). The 400 bodies return the
    provider's or library's message (SMTP errors, hostnames, bind DNs). Super-admin only,
    so low. _Recommended:_ map to fixed reasons inside the libs and log the original.
73. **Web offline queue leftovers** (`public/sw-queue-rules.js:49-55`, `public/sw.js`,
    `src/lib/offline-queue.ts`). A tab holding an old session can replay entries under
    another tab's newer session (a server-side author check would close it). The
    suffix-based secret rule refuses to queue, for example, a custom field named
    "Token" (fail-safe). A request refused by path surfaces as a raw network error, not
    the 503 JSON. Legacy credential entries outside `/api/auth` that have no owner are
    kept for manual discard. Dropped 400/404 entries are reported as an info toast, not
    an error. _Recommended:_ send the author id with replayed requests and check it
    server-side; return 503 JSON for refused paths; raise the drop toast to an error.
74. **The regression nets for the sweeps are heuristic** (`src/app/api/__tests__/route-conventions.test.ts`,
    `src/lib/__tests__/webhook-callers.test.ts`, `src/app/__tests__/server-pages-static-scope.test.ts`).
    The route-conventions test checks presence and count per file, not that
    `requireWritableOrg` sits in each mutating handler; the webhook-callers scan checks
    arity only (an `undefined` or body-supplied org passes, and generics, optional calls
    and aliases are missed); the page scope test treats any `where` token as scoped and
    looks at `findMany` only. There is no runtime read-only test per handler.
    _Recommended:_ AST-based per-handler checks, or the `withApiRoute` wrapper from item
    43 so the guard is structural.
75. **The destructive DB tests trust the URL host** (`src/lib/__tests__/scope-automation-migration.test.ts`,
    `user-email-query.db.test.ts`). They run when `DATABASE_URL` points at `localhost`,
    `127.0.0.1` or `[::1]`, or when `ALLOW_DESTRUCTIVE_DB_TESTS=1`. An SSH tunnel to the
    production database on localhost, or a `?host=` override, passes the gate, and the
    migration test runs `DELETE FROM organizations` (rolled back, but it takes locks and
    cascades). Item 7's note that `.env` points at production makes this realistic.
    _Recommended:_ always require the explicit opt-in, or check the database name
    (`*_test`) as well.

## Repository loose ends (2026-09-07)

- **GitHub issue #86** (quick start fails with P1014 on the baseline migration):
  root cause was migrations carrying `SET search_path TO "assettool"` while the README
  URL uses `schema=public`. Fixed by the v0.9.5 normalization; verified on
  2026-09-07 with a fresh Postgres locally (28 migrations applied) and in CI. Reply
  posted the same day; close once the fix reaches `master`.
- Stash `stash@{0}` on `master` is an April dependency bump superseded by v0.9.5 — drop.
- Branch `feat/landing-page-redesign` (3 commits, May 2026, "Trackly" rebrand) was
  never merged and conflicts with the v0.7.1 landing page — merge, rework or delete.
- Draft PRs #84 (five launch-strategy docs, never landed), #23 (Freshdesk — since
  re-implemented on `development`), #17 (empty) — close or salvage.
- Nine `origin/copilot/*` branches from Jan–Mar 2026 are unmerged and stale — delete.
- `docs/plans/*` (BetterAuth migration, onboarding) are completed plans kept as
  history; `docs/superpowers/plans/2026-03-20-server-side-pagination.md` is not (item 42).

## Test harness

State after v0.9.5: **460+ tests, 0 failing; `tsc --noEmit` clean including tests**;
DB-gated `cache` and `account-lockout` suites run in CI against a Postgres service
container (their first real run on 2026-09-07 exposed fake-timer and key-isolation
bugs, fixed the same day; a fresh-database `migrate deploy` is part of that job) (the lockout suite previously lacked every `await` and would have failed
the first time it ran).

Remaining test debt:

- Coverage threshold is 25% lines (house standard 80%). 12 of 207 route files have a
  test. Untested security surface: `scim.ts` (`authenticateScim`), `webhooks.ts`
  (HMAC + SSRF call site), `organization-context.ts`, `storage/*`, `plan-features.ts`,
  `secrets.ts`, `auth-server.ts` hooks, Stripe webhook, forgot-password, api-keys.
- SCIM per-user tests never assert `organizationId` in the Prisma `where`.
- The MFA login flow (enrol → redirect → TOTP / backup code → regenerate → disable,
  plus the audit trail and the fatal env gate) is covered only by an ad-hoc smoke
  script run against `next start` on an embedded Postgres (2026-09-18, 27 checks).
  Promote it to `tests/e2e` once the E2E job has a database; until then rerun it
  before any auth release.
- `proxy.ts` limits `/api/auth/sign-in*` to 5 requests per 15 minutes per IP
  (`RATE_LIMITS.login`). Offices behind one NAT address will hit this with a handful
  of users; consider 20/15 min per IP plus the existing per-account lockout.
- E2E job is `if: false`; needs `TEST_USERNAME`/`TEST_PASSWORD` secrets (now in
  `.env.example`) and a seeded test database.
- Coverage report omits files that are `vi.mock`ed elsewhere by alias (e.g. `rbac.ts`);
  don't read "missing row" as 0%.
