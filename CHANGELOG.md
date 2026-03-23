# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

### Changed

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
