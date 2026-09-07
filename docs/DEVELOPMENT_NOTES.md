# Development Notes

Consolidated reference of architecture decisions, implementation history, and technical notes from the development of Asset Tracker. For the active roadmap, see [GitHub Issues](https://github.com/LucaGerlich/assettTracker/issues).

---

## Architecture Overview

### Tech Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM 7.x
- **Auth:** BetterAuth with session management, TOTP MFA, backup codes
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Monitoring:** Sentry error tracking
- **Testing:** Vitest (unit), Playwright (E2E)

### Data Model

71 Prisma models covering: assets, users, organizations, departments, roles, accessories, licences, consumables, manufacturers, suppliers, locations, models, categories, status types, audit logs, tickets, workflows, custom fields, webhooks, notifications, maintenance, reservations, transfers, approvals, billing, sessions, MFA, components, kits, EULA templates, audit campaigns, LDAP sync, dashboard widgets, item requests, report schedules, Intune sync logs, and more.

### Multi-tenancy

Shared database with `organizationId` column on all tenant-scoped tables. `scopeToOrganization()` helper enforces isolation on all API routes (13+ routes). Per-org billing via Stripe with 3-tier plans (Starter/Professional/Enterprise) and asset/user count enforcement.

### Authentication & Security

- **Auth flow:** BetterAuth credential login with optional TOTP/backup code MFA step, SSO via OAuth2 (Microsoft, Google), LDAP/SAML
- **Rate limiting:** IP-based (10 attempts/15 min) with progressive account lockout
- **Session tracking:** IP + user-agent recorded, hourly JWT revalidation
- **Encryption:** AES-256-GCM at rest for webhook secrets, API keys, SSO/LDAP creds; TOTP secrets and backup codes are encrypted by BetterAuth with `BETTER_AUTH_SECRET`
- **Security headers:** Full CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **RBAC:** 35 granular permissions via `requirePermission()` on 30+ routes

### API Surface

100+ route endpoints spanning:

- Auth (MFA, session management, password reset)
- Admin (settings for SSO/LDAP/email/Freshdesk/integrations, user/role management, workflows, custom fields, labels, GDPR, compliance, audit logs)
- Asset management (full CRUD with checkout/transfers/reservations/attachments/QR codes)
- Billing (Stripe checkout/portal/webhooks)
- Cron jobs (5 endpoints: sessions, notifications, workflows, GDPR retention)
- Integrations (Slack/Teams notifications on asset, user, maintenance, stock alert events)

---

## Implementation History

### Phase 0: Baseline (Pre-2026-02-18)

Core CRUD for all entities, asset detail with QR/labels/attachments/warranty/depreciation/maintenance/lifecycle/reservations/transfers, user management, search, reporting with CSV/PDF export, consumable workflows, ticket system (kanban + user view), admin settings, NextAuth credential auth, feature flags, Docker/Podman support.

### Phase 1: Multi-tenancy & RBAC

Organization scoping on 13+ API routes, 35 permissions with `requirePermission()` guard, department/role management UI.

### Phase 2: Integrations & Automation

Workflow execution engine (`workflow-engine.ts`) with condition evaluation, 5 action types, cron endpoints. Webhook triggers on 10+ routes with HMAC signatures and retry backoff.

### Phase 3: Security & Compliance

MFA/2FA (TOTP + backup codes), concurrent session management with device tracking/revoke UI, password reset flow with rate limiting and email template.

### Phase 4: Performance & Scale

Pagination on 18+ additional endpoints (24 total), 56 database indexes across 24 models, response compression, CSP headers.

### Phase 5: PWA & Mobile

Service worker (network-first + stale-while-revalidate), offline page, install prompt, mobile bottom nav.

### Phase 6: SaaS & Business

Marketing landing page, pricing page (3-tier), self-service registration, Stripe billing (checkout/webhooks/portal), tenant resource limits.

### Phase 7: UX Polish (2026-02-20)

Persisted user preferences with regional formatting, check-in/check-out history system, onboarding wizard (6-step), help tooltips, animations/hover polish, 5 new charts (lifecycle, cost breakdown, location distribution, maintenance trend, depreciation forecast), customizable dashboard widgets with DndKit, team invitation system.

### Phase 8: Testing Infrastructure (2026-02-24)

Vitest unit test framework, API integration tests, test utilities (createMockRequest, parseResponse), 333 tests across 20 files.

### Phase 9: GDPR & Cron (2026-02-24)

GDPR audit log retention enforcement with configurable retention periods, cron endpoint, Vercel cron scheduling for all 5 maintenance jobs.

### Phase 10: Slack/Teams Integration (2026-02-25)

Notification module with settings reader, message formatters (Slack Block Kit / Teams Adaptive Cards), dispatcher. Wired to 8 API routes: asset CRUD, user creation, maintenance, stock alerts.

### Phase 11: Analytics, Scheduled Reports & MDM (2026-04-17 — 2026-04-22)

**v0.2.0 — Analytics & Insights:**

- TCO dashboard widget + reports tab (purchase + maintenance + licence costs by category)
- Asset health score (composite 0-100: age/warranty/maintenance/depreciation), dashboard widget + asset detail section
- Duplicate detection engine (Levenshtein distance for serial/name similarity, model+location grouping)
- Depreciation export (15-column accounting-friendly CSV/XLSX)
- Version display in sidebar from package.json

**v0.3.0 — Scheduled Reports & Temporary Access:**

- ReportSchedule model with 4 report types, daily/weekly/monthly frequency, CSV/XLSX format
- Report generator producing org-scoped buffers via existing export infrastructure
- Cron at 7 AM UTC for report delivery via email queue
- Temporary access grants via accessExpiresAt on user model
- Auto-deactivation cron at 7:30 AM with 7-day/1-day warning emails
- Access expiry badge on user detail, date picker on create/edit forms
- Prisma 7.7.0 upgrade

**v0.4.0 — Microsoft Intune MDM Sync:**

- Graph API integration with client credentials flow (app-only auth)
- Paginated device fetch from /deviceManagement/managedDevices
- Asset creation with auto-created manufacturers, models, and categories
- Category mapping: iPhone, iPad, Mac, Windows Laptop/Desktop, Android, Chromebook, etc.
- Conflict resolution: match by externalId, fallback to serialNumber
- Admin settings tab with Test Connection, Sync Now, encrypted credentials
- IntuneSyncLog audit trail, webhook event, Slack/Teams notification
- Daily cron at 8 AM UTC

---

## Key Architecture Decisions

1. **Shared DB multi-tenancy over DB-per-tenant** — Simpler, cost-effective, good enough for the scale. Row-level scoping via `organizationId`.

2. **BetterAuth over NextAuth** — Migrated from NextAuth v5 to BetterAuth for tighter control over session handling, password storage (accounts table), and plugin-based extensibility (TOTP, backup codes, SSO).

3. **Prisma over raw SQL** — Type safety, migration management, relation handling. 69 models work well with Prisma's query builder.

4. **shadcn/ui over component libraries** — Full control, copy-paste ownership, no version lock-in. Migrated from HeroUI/NextUI.

5. **Vitest over Jest** — Faster, native ESM support, better Vite integration for the Next.js stack.

6. **In-memory rate limiting over Redis** — Simpler deployment. Redis optional via Upstash for production scale.

7. **Vercel cron over external schedulers** — Integrated with deployment, no additional infrastructure for 5 recurring jobs.

---

## SaaS Business Model

### Pricing Tiers

| Tier         | Monthly         | Assets    | Users     |
| ------------ | --------------- | --------- | --------- |
| Starter      | $29             | 100       | 5         |
| Professional | $79             | 1,000     | 25        |
| Enterprise   | $199            | Unlimited | Unlimited |
| Self-Hosted  | $1,499 one-time | Unlimited | Unlimited |

### Recommended Infrastructure

| Component    | Service                   |
| ------------ | ------------------------- |
| Application  | Vercel                    |
| Database     | Supabase PostgreSQL       |
| File Storage | AWS S3 / Cloudflare R2    |
| CDN          | Cloudflare                |
| Monitoring   | Sentry + Vercel Analytics |
| Email        | Resend / SendGrid         |

### Feature Gating

SSO/SAML → Enterprise only. API access → Professional+. White-label → Enterprise only. Audit log retention: Starter 30 days, Pro 90 days, Enterprise unlimited.

---

## Modernization History

The application went through a major modernization from a legacy Next.js + HeroUI/NextUI app to the current stack:

1. **UI migration:** HeroUI/NextUI → shadcn/ui (Radix primitives)
2. **Responsive layouts:** ResponsiveTable component with mobile card view, mobile bottom nav, Sheet drawer
3. **Dependencies:** Tailwind v3→v4 (CSS-first config), Prisma v5→v7, Next.js 15→16
4. **Code quality:** Prettier + Husky pre-commit, commitlint, ESLint
5. **Testing:** Playwright E2E + Vitest unit test setup

---

## File Reference

### Key Files

- `src/lib/auth-server.ts` — BetterAuth config with MFA login flow (re-exported as `@/lib/auth`)
- `src/lib/rbac.ts` — RBAC permission system (35 permissions)
- `src/lib/workflow-engine.ts` — Automated workflow execution engine
- `src/lib/integrations/slack-teams.ts` — Slack/Teams notification module
- `src/lib/gdpr-retention.ts` — GDPR retention enforcement
- `src/lib/tenant-limits.ts` — Plan-based resource limit enforcement
- `src/proxy.ts` — Rate limiting middleware
- `prisma/schema.prisma` — Full data model (69 models)
- `vercel.json` — Cron job scheduling

### Configuration

- `.env.example` — All environment variables with documentation
- `vitest.config.ts` — Unit test configuration
- `playwright.config.js` — E2E test configuration
