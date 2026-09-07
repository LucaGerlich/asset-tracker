# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
