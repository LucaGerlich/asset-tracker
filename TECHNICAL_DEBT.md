# Technical Debt

Last updated: 2026-09-07 (v0.9.6 — register re-verification and debt sweep)

This document tracks issues found by whole-application audits. Items marked
**FIXED** were resolved in the version noted; **DEFERRED** items are documented
with a recommended fix. Two audits have run so far:

- **2026-07-07 (v0.9.4)** — six specialist agents (UI dead-ends, API logic, client
  React, RBAC/authz, Prisma data layer, cross-cutting consistency). ~55 fixes.
- **2026-09-02 (v0.9.5)** — seven review agents (security, API correctness,
  database, performance, frontend, DevOps/release, test quality) followed by seven
  fix agents. ~60 fixes across 122 files, net −450 lines.
- **2026-09-07 (v0.9.6)** — three read-only agents: every deferred item below was
  re-verified against the code (none had been fixed by accident), plus an
  unfinished-feature sweep and a structural-debt sweep. One live bug fixed
  (status-type cache key), four register figures corrected, items 33–52 added.

## Summary (as of 2026-09-07)

| Area                               | Status                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| CI (lint, typecheck, unit, build)  | green after v0.9.5 (was red: stale lockfile, test typings)            |
| Production dependency advisories   | 0 (was 1 critical, 53 high)                                           |
| Cross-tenant data access           | no known open read/write path (status-type cache key fixed in v0.9.6) |
| MFA login enforcement              | **NOT FUNCTIONAL** — decision required (D1)                           |
| SSO (SAML/OIDC) login completion   | **NOT FUNCTIONAL** — decision required (D2)                           |
| TypeScript strict mode             | off; 830 errors to clear (D3)                                         |
| Paid plan feature enforcement      | **5 of 6 gated features unenforced server-side** (item 29, critical)  |
| Advertised but unfinished features | 10 (items 33–42)                                                      |
| Unit coverage of auth/tenant layer | partial (api-auth, url-validation, org-suspension now tested)         |

---

## FIXED in v0.9.6 (2026-09-07)

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

**D1. MFA is bypassable (critical).** Two disconnected implementations: the settings UI
(`user/[id]/settings/ui/MfaSettings.tsx`) calls custom `/api/auth/mfa/{setup,verify,
disable}` which set `user.mfaEnabled`/`mfaSecret`; the login gate is BetterAuth's
`twoFactor` plugin, which only fires on its own `user.twoFactorEnabled` column and
`twoFactor` table — set nowhere. Enabling MFA has no effect at login.
_Recommended:_ rewrite `MfaSettings.tsx` against `authClient.twoFactor.enable /
verifyTotp / disable` (the login side already uses `verifyTotp`), delete the custom
routes, `lib/mfa.ts`, and the `mfaSecret`/`mfaBackupCodes` columns. Existing
enrolments must re-enrol. Alternative: have the custom verify route also write
BetterAuth's columns (couples to library internals; not recommended).

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
7. **Vercel preview deploys run `prisma migrate deploy`** against whatever
   `DATABASE_URL` the preview has. Documented in `DEPLOYMENT.md`; consider gating on
   `VERCEL_ENV === "production"` in the build command.
8. `.mcp.json` points at a work Sentry org from a private repo — remove before any
   open-sourcing.

## DEFERRED — data layer

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
    `advanced_reports`, `tco_dashboard`, `scim` sold as paid but enforced nowhere. Verified 2026-09-07: `requirePlanFeature` is called only for `ldap`, `sso`, `api_keys` and `procurement`; the other five have no server-side check at all, so the paid tiers are a UI label.
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
37. **Compliance dashboard hard-codes three checks**
    (`admin/compliance/ui/ComplianceDashboard.tsx`): MFA and encryption coverage say
    "not yet implemented", and the incident-response check ignores its input and
    always returns "Not Configured". Effort S (remove) / M (back with settings).
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

## Repository loose ends (2026-09-07)

- **GitHub issue #86** (quick start fails with P1014 on the baseline migration, open
  since 2026-07-21, unanswered): caused by migrations carrying
  `SET search_path TO "assettool"` while the README URL uses `schema=public`. The
  v0.9.5 normalization to `public` should fix it; verify `prisma migrate deploy` on a
  fresh database, then reply and close.
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
- E2E job is `if: false`; needs `TEST_USERNAME`/`TEST_PASSWORD` secrets (now in
  `.env.example`) and a seeded test database.
- Coverage report omits files that are `vi.mock`ed elsewhere by alias (e.g. `rbac.ts`);
  don't read "missing row" as 0%.
