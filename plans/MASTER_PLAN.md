# Asset Tracker Master Plan (Consolidated)

**Last Updated:** 2026-02-18 (Phase 6 complete)

## Purpose
This document consolidates all planning, roadmap, and implementation notes into a single source of truth aligned with the current codebase. It supersedes legacy plans scattered across the repository.

## Sources Merged
- FEATURES.md
- IMPLEMENTATION_PLAN.md
- IMPLEMENTATION.md
- ideas.md
- plans/IMPLEMENTATION_PLAN.md
- plans/FEATURE_IMPLEMENTATION_PLAN.md
- plans/SECURITY_AUTH_PLAN.md
- plans/PROGRESS.md
- plans/newplan.md
- docs/plans/2026-01-29-future-enhancements.md
- plans/SAAS_BUSINESS_GUIDE.md
- TICKET_SYSTEM.md
- TICKET_ARCHITECTURE.md
- IMPLEMENTATION_SUMMARY.md
- plans/IMPLEMENTATION_SUMMARY.md

## Current State Summary (Codebase Observations)

### Implemented Capabilities
- Core CRUD for assets, accessories, licences, consumables, models, categories, manufacturers, suppliers, locations, and status types.
- Asset detail experience with QR generation, label printing, attachments, warranty tracking, depreciation summary, maintenance schedule list, lifecycle timeline, reservations, and transfers.
- User detail experience with history timeline and assignment management (assets, accessories, licences).
- Search and reporting: global search, per-entity filters, saved filters, reports dashboard, CSV/PDF export, and API docs UI.
- Inventory workflows: consumable min quantities, stock alerts, and check-out/usage tracking UI.
- Approvals workflow UI and API.
- Ticket system for admins and users, including kanban-style management.
- Admin settings UI for email providers, notifications, labels, custom fields, depreciation settings, orgs/departments/roles, webhooks, integrations, SSO/LDAP settings, and location tracking.
- Security baseline: NextAuth credential auth, JWT sessions, password hashing, rate limiting, account lockout, session timeout, audit logging, security headers, environment validation, feature flags, error pages, and health checks.
- Integrations baseline: webhook API + UI, Slack/Teams webhook settings, Freshdesk settings UI.
- QR scanner page with camera scanning and search fallback.

### Recently Completed (2026-02-18)
- Maintenance schedule management page (full CRUD, status badges, complete/delete actions).
- Warranty expiration dashboard in reports (summary cards, bar chart, sortable table).
- Custom fields admin UI in admin settings (full CRUD for field definitions).
- Consumable restock functionality (PATCH endpoint + Restock dialog on consumable detail).
- Password reset flow (forgot-password API with rate limiting, reset-password API, email template, UI pages, login link).
- Sidebar update with Maintenance link (Wrench icon in Tools section).
- Collapsible sidebar sections and scrollable nav.
- OfflineBanner SSR hydration fix.
- Next.js 16 middleware-to-proxy migration (`src/proxy.ts`).
- Merge conflict resolution (pagination + org-context + security features).
- **Phase 2**: Organization scoping enforced across 13+ API routes (search, tickets, approvals, maintenance, departments, user CRUD, asset CRUD). RBAC extended with `requirePermission()` guard on 30+ routes using 35 granular permissions.
- **Phase 3**: Workflow execution engine (`src/lib/workflow-engine.ts`) with condition evaluation, 5 action types, and scheduled checks. Cron endpoints for workflows and notifications (`/api/cron/workflows`, `/api/cron/notifications`). Webhook triggers added to 10+ API routes (asset, user, licence, consumable, maintenance CRUD).
- **Phase 4**: MFA/2FA support with TOTP (otplib), QR setup, backup codes, login flow integration, and MFA verify page. Concurrent session management with device tracking, IP logging, session list UI, revoke actions, and cron cleanup.
- **Phase 5**: Pagination standardized across 18 additional list endpoints (maintenance, reservations, tickets, approvals, suppliers, locations, manufacturers, models, webhooks, notifications, categories, orgs, departments, roles).
- **Phase 6**: PWA manifest, service worker (network-first + stale-while-revalidate), offline page, install prompt, and service worker registration.

### Partially Implemented or Needs Completion
- SSO/LDAP/Freshdesk integrations (settings exist; auth/data flows not wired).
- Bulk import UI (API exists).
- Slack/Teams notification wiring to events.

## Roadmap

### Phase 1: Alignment and Stabilization (Now–2 weeks)
- ~~Finish maintenance schedule management UI and hook into `/api/maintenance`.~~ Done (2026-02-18)
- ~~Add warranty section to reports.~~ Done (2026-02-18)
- ~~Add depreciation section to reports.~~ Done (2026-02-18)
- ~~Migrate Assets DashboardTable to ResponsiveTable (mobile card view).~~ Done (2026-02-18)
- Validate this master plan against current UI flows and API endpoints.
- Update documentation references to use `plans/MASTER_PLAN.md`.
- ~~Fix `bun run lint` (was broken on Next.js 16; now uses eslint directly, 0 errors / 7 pre-existing warnings).~~ Done (2026-02-18)
- Run Playwright E2E tests (install browsers, fix failures).
- Verify labels, attachments, reservations, transfers, and saved filters via a manual test script.

### Phase 2: Multi-tenancy and RBAC (2–6 weeks) -- DONE (2026-02-18)
- ~~Enforce organization scoping in all data access paths (API routes and server helpers).~~ Done
- ~~Extend role permissions beyond admin/requester and enforce in UI and APIs.~~ Done (35 permissions, `requirePermission()` on 30+ routes)
- Add org/department assignment workflows and default org behavior.
- Add org-aware audit log views and exports.

### Phase 3: Integrations and Automation (6–10 weeks) -- DONE (2026-02-18)
- ~~Implement workflow execution service (cron/queue) for triggers and actions.~~ Done (`workflow-engine.ts`, cron endpoints)
- ~~Expand webhook event coverage and retries/backoff.~~ Done (10+ routes with `triggerWebhook`)
- Wire Slack/Teams notifications to events and workflows.
- Implement Freshdesk integration (ticket sync and settings validation).
- Implement SSO/SAML and LDAP authentication flows.

### Phase 4: Security, Compliance, and Governance (10–14 weeks) -- DONE (2026-02-18)
- ~~Add MFA/2FA and password reset flows.~~ Done (TOTP with otplib, QR setup, backup codes, `/mfa-verify` page)
- ~~Harden session management (concurrent sessions, device list).~~ Done (session tracking, revoke UI, cron cleanup)
- Automate GDPR retention tasks and data export pipelines.
- Complete security review for CSP, request signing, and sensitive endpoints.

### Phase 5: Performance and Scale (14–18 weeks) -- DONE (2026-02-18)
- ~~Standardize pagination and filtering on all list endpoints.~~ Done (18 additional endpoints)
- Complete query optimization and indexing review.
- Add caching layer (optional Redis) and background jobs for notifications.
- Enable streaming exports and batch operations for large data sets.

### Phase 6: UX, Mobile, and PWA (18–24 weeks) -- DONE (2026-02-18)
- ~~Add PWA manifest, offline shell, and installable experience.~~ Done (manifest, service worker, offline page, install prompt)
- Mobile-first refinement for asset workflows and approvals.
- Accessibility pass (WCAG) and UI polish.

### Phase 7: Business and SaaS Readiness (Parallel)
- Homepage with login
- Billing, plans, and tenant limits.
- Self-hosted vs SaaS packaging.
- Support, onboarding, and customer success workflows.

## Definition of Done
- Master plan reflects the current codebase and is referenced by all plan docs.
- All Phase 1 items complete with updated docs and validated flows.
- Remaining phases tracked with clear ownership, estimates, and acceptance criteria.

## Open Tasks (Consolidated)

This list mirrors all unchecked tasks across plan files. Some items are implementation tasks; others are verification/ops checklists and should remain unchecked until validated.

<!-- OPEN_TASKS_START -->

### FEATURES.md
- [x] Depreciation reporting (Done 2026-02-18 — report tab with summary cards, bar chart, asset table)
- [ ] Asset History — Asset check-in/check-out history (explicit workflow)
- [ ] Consumables Enhancement — Automatic reorder alerts (beyond low-stock notifications)
- [ ] Partially Implemented (DB/API Only) — User preferences (sidebar collapsed cookie only)
- [ ] Partially Implemented (DB/API Only) — Bulk import (API only)
- [ ] Multi-tenancy & Organization — White-labeling support
- [ ] Multi-tenancy & Organization — Per-tenant billing
- [ ] Integration & APIs — Third-party integrations (Slack, Teams, etc.)
- [ ] Integration & APIs — SSO/SAML authentication
- [ ] Integration & APIs — LDAP/Active Directory integration
- [ ] Integration & APIs — GraphQL API (optional)
- [ ] Notifications (Future) — In-app notifications center
- [ ] Notifications (Future) — Scheduled reports via email
- [ ] Reporting & Analytics (Future) — Report builder (custom reports)
- [ ] Reporting & Analytics (Future) — Excel export
- [ ] Advanced Features — Asset location tracking (GPS/RFID)
- [x] Advanced Features — Automated workflows (Done 2026-02-18 — workflow engine with condition evaluation, 5 action types, cron endpoints)
- [ ] Advanced Features — Multi-language support
- [ ] Advanced Features — Customizable dashboard widgets
- [ ] Advanced Features — AI-assisted support/helpdesk
- [ ] Personalization & Preferences — Persisted user preferences
- [ ] Personalization & Preferences — Custom dashboard per user
- [ ] Data & Database — Pre-reserve UUIDs on create (client workflows)
- [ ] Performance & Scalability — Server-side validation enforcement
- [ ] Performance & Scalability — Caching layer implementation
- [ ] Performance & Scalability — Performance optimization for large datasets
- [ ] Performance & Scalability — Database query optimization
- [x] Performance & Scalability — Rate limiting for API endpoints (Done — proxy.ts rate limiter with per-endpoint config)
- [x] Performance & Scalability — Server-side pagination + filtering endpoints (Done 2026-02-18 — 24 endpoints total)
- [ ] Performance & Scalability — Database transactions for complex workflows
- [ ] Performance & Scalability — Response compression
- [ ] Performance & Scalability — Cursor-based pagination
- [ ] Performance & Scalability — Streaming exports for large datasets
- [ ] Performance & Scalability — Batch operations for bulk updates
- [ ] Performance & Scalability — Virtualized lists for large tables
- [ ] Performance & Scalability — Frontend bundle analysis + code splitting
- [ ] Performance & Scalability — Image optimization and lazy loading
- [ ] Performance & Scalability — Stale-while-revalidate caching patterns
- [ ] Compliance & Security — Data encryption at rest
- [ ] Compliance & Security — Enhanced audit logging
- [ ] Compliance & Security — Compliance reporting (SOX, HIPAA, etc.)
- [ ] Compliance & Security — Data retention policies
- [ ] Compliance & Security — GDPR compliance features
- [ ] Compliance & Security — Security hardening beyond current feature flags
- [x] Compliance & Security — MFA/2FA (Done 2026-02-18 — TOTP with otplib, QR setup, backup codes, login flow, /mfa-verify page)
- [x] Compliance & Security — Password reset flow (Done 2026-02-18)
- [x] Compliance & Security — Concurrent session management (Done 2026-02-18 — device/IP tracking, session list UI, revoke, cron cleanup)
- [ ] Compliance & Security — CAPTCHA for login
- [ ] Compliance & Security — Suspicious activity detection
- [ ] Compliance & Security — Security headers audit and CSP reporting
- [ ] Compliance & Security — Request signing for sensitive operations
- [ ] Compliance & Security — API key management for integrations
- [ ] Compliance & Security — Field-level encryption for PII
- [ ] Compliance & Security — Data masking for logs
- [ ] Observability & Monitoring — Centralized log aggregation
- [ ] Observability & Monitoring — Application performance monitoring (APM)
- [ ] Observability & Monitoring — Alerting on errors, latency, and DB failures
- [ ] Observability & Monitoring — Synthetic monitoring checks
- [ ] Observability & Monitoring — Business metrics dashboards
- [ ] Testing & Quality — Unit test framework (Jest/Vitest)
- [ ] Testing & Quality — Component tests (React Testing Library)
- [ ] Testing & Quality — API integration tests
- [ ] Testing & Quality — Test data factories/fixtures
- [ ] Testing & Quality — Accessibility testing (axe-core)
- [ ] Testing & Quality — Code coverage targets and reporting
- [ ] Testing & Quality — Pre-commit hooks and lint gates
- [ ] Testing & Quality — Code formatting (Prettier)
- [ ] Testing & Quality — Commit message linting
- [ ] Testing & Quality — PR templates and review checklists
- [ ] Testing & Quality — CI/CD pipeline with quality gates
- [ ] Infrastructure & Ops — Secret management integration (Vault/Secrets Manager)
- [ ] Infrastructure & Ops — Automated DB backups with PITR
- [ ] Infrastructure & Ops — Read replicas for scale
- [ ] Infrastructure & Ops — CDN/WAF deployment recommendations
- [ ] Infrastructure & Ops — Database maintenance scripts
- [ ] UI/UX Improvements — Drag-and-drop file uploads
- [ ] UI/UX Improvements — Bulk import functionality (CSV)
- [ ] UI/UX Improvements — Customizable table columns
- [ ] UI/UX Improvements — Advanced data visualization (charts, graphs)
- [ ] UI/UX Improvements — Guided tours for new users (enhanced)
- [ ] UI/UX Improvements — Tooltips and help system
- [ ] UI/UX Improvements — Keyboard navigation improvements
- [ ] UI/UX Improvements — Accessibility enhancements (WCAG compliance)
- [ ] UI/UX Improvements — Skeleton loaders
- [ ] UI/UX Improvements — Shareable URLs (persist filters/state in query params)
- [ ] UI/UX Improvements — Auto-suggestions/typeahead
- [ ] UI/UX Improvements — Hover/animation polish
- [ ] UI/UX Improvements — Micro-interactions
- [ ] UI/UX Improvements — Regional settings (date/number/currency)
- [ ] UI/UX Improvements — Documentation expansion (user/admin guides)
- [ ] Mobile App — Native mobile application
- [ ] Mobile App — QR code scanning for quick asset lookup
- [ ] Mobile App — Mobile-optimized workflows
- [x] Mobile App — Offline mode support (Done 2026-02-18 — service worker, offline page, OfflineBanner)
- [x] Mobile App — PWA install + app icons (Done 2026-02-18 — manifest.json, icon.svg, PWAInstallPrompt)

### IMPLEMENTATION_SUMMARY.md
- [ ] As a Regular User: — Navigate to "My Tickets" from main menu
- [ ] As a Regular User: — Click "New Ticket" button
- [ ] As a Regular User: — Fill in title, description, priority
- [ ] As a Regular User: — Submit ticket
- [ ] As a Regular User: — Verify ticket appears in list
- [ ] As a Regular User: — Click on ticket to view details
- [ ] As a Regular User: — Add a comment to the ticket
- [ ] As a Regular User: — Verify comment appears
- [ ] As an Admin: — Navigate to "Tickets" from main menu
- [ ] As an Admin: — Verify kanban board displays with 3 columns
- [ ] As an Admin: — See user-created tickets in "New" column
- [ ] As an Admin: — Drag a ticket from "New" to "In Progress"
- [ ] As an Admin: — Verify ticket status updates
- [ ] As an Admin: — Click on a ticket to open modal
- [ ] As an Admin: — Assign ticket to an admin user
- [ ] As an Admin: — Change priority
- [ ] As an Admin: — Add a comment
- [ ] As an Admin: — Verify all changes save correctly
- [ ] As an Admin: — Drag ticket to "Completed"
- [ ] Permissions: — Verify users can only see their own tickets
- [ ] Permissions: — Verify admins can see all tickets
- [ ] Permissions: — Verify only admins can update ticket status
- [ ] Permissions: — Verify only admins can assign tickets
- [ ] Permissions: — Verify users can comment on their own tickets
- [ ] Permissions: — Verify admins can comment on any ticket

### ideas.md
- [ ] 1.3 Environment Configuration — Use secret management service (AWS Secrets Manager, Vault) - *Deferred: requires infrastructure*
- [ ] 1.4 Database Resilience — Configure read replicas for scaling - *Deferred: requires infrastructure*
- [ ] 1.4 Database Resilience — Set up automated backups with point-in-time recovery - *Deferred: requires infrastructure*
- [ ] 1.4 Database Resilience — Create database maintenance scripts - *Future enhancement*
- [x] 2.2 Authentication Improvements — Implement Multi-Factor Authentication (MFA/2FA) - Done (2026-02-18 — TOTP with otplib, QR setup, backup codes)
- [x] 2.2 Authentication Improvements — Add password reset flow via email - Done (2026-02-18)
- [x] 2.2 Authentication Improvements — Implement concurrent session management - Done (2026-02-18 — device tracking, session list UI, revoke)
- [ ] 2.3 Additional Security Measures — Add CAPTCHA for login form
- [ ] 2.3 Additional Security Measures — Implement IP-based suspicious activity detection
- [ ] 2.3 Additional Security Measures — Add security headers audit automation
- [ ] 2.3 Additional Security Measures — Enable Content Security Policy (CSP) reporting
- [ ] 2.3 Additional Security Measures — Implement request signing for sensitive operations
- [ ] 2.3 Additional Security Measures — Add API key management for external integrations
- [ ] 2.4 Data Protection — Encrypt sensitive data at rest
- [ ] 2.4 Data Protection — Implement field-level encryption for PII
- [ ] 2.4 Data Protection — Add data masking for logs
- [ ] 2.4 Data Protection — Create data retention and purging policies
- [ ] 2.4 Data Protection — GDPR compliance features (data export, deletion)
- [ ] 3.1 Caching Strategy — Implement Redis caching layer
- [ ] 3.1 Caching Strategy — Cache frequently accessed data (categories, statuses, manufacturers)
- [ ] 3.1 Caching Strategy — Add cache invalidation strategy
- [ ] 3.1 Caching Strategy — Use stale-while-revalidate pattern for UI
- [ ] 3.1 Caching Strategy — Implement database query result caching
- [ ] 3.2 Database Optimization — Add database indexes for common queries
- [ ] 3.2 Database Optimization — Optimize N+1 queries with proper includes
- [ ] 3.2 Database Optimization — Implement pagination with cursor-based approach for large datasets
- [ ] 3.2 Database Optimization — Add query analysis and slow query logging
- [ ] 3.3 Frontend Performance — Implement image optimization and lazy loading
- [ ] 3.3 Frontend Performance — Add bundle analysis and code splitting
- [ ] 3.3 Frontend Performance — Use React.lazy() for route-based code splitting
- [ ] 3.3 Frontend Performance — Implement virtual scrolling for large lists
- [x] 3.3 Frontend Performance — Add service worker for offline support (Done 2026-02-18 — sw.js with network-first + stale-while-revalidate)
- [ ] 3.3 Frontend Performance — Optimize CSS with critical path extraction
- [ ] 3.4 API Performance — Implement response compression
- [ ] 3.4 API Performance — Add GraphQL for flexible data fetching (optional)
- [ ] 3.4 API Performance — Use streaming for large data exports
- [ ] 3.4 API Performance — Implement batch operations for bulk updates
- [ ] 4.1 Automated Testing Setup — Set up Jest for unit testing
- [ ] 4.1 Automated Testing Setup — Configure React Testing Library for component tests
- [ ] 4.1 Automated Testing Setup — Add API integration tests
- [ ] 4.1 Automated Testing Setup — Create test data factories/fixtures
- [ ] 4.2 Test Coverage Goals — Achieve 80%+ code coverage for business logic
- [ ] 4.2 Test Coverage Goals — 100% coverage for authentication flows
- [ ] 4.2 Test Coverage Goals — 100% coverage for API endpoints
- [ ] 4.2 Test Coverage Goals — Visual regression testing for UI components
- [ ] 4.2 Test Coverage Goals — Accessibility testing (axe-core)
- [ ] 4.3 Quality Gates — Set up ESLint rules enforcement
- [ ] 4.3 Quality Gates — Add Prettier for code formatting
- [ ] 4.3 Quality Gates — Implement pre-commit hooks (Husky)
- [ ] 4.3 Quality Gates — Add commit message linting (Commitlint)
- [ ] 4.3 Quality Gates — Create PR templates and checklists
- [ ] 5.1 Logging Infrastructure — Configure log levels per environment
- [ ] 5.1 Logging Infrastructure — Set up log aggregation (ELK Stack, Datadog, CloudWatch)
- [ ] 5.1 Logging Infrastructure — Add log rotation and retention policies
- [ ] 5.2 Application Monitoring — Set up Application Performance Monitoring (APM)
- [ ] 5.2 Application Monitoring — Track response times and throughput
- [ ] 5.2 Application Monitoring — Monitor error rates and types
- [ ] 5.2 Application Monitoring — Track user sessions and interactions
- [ ] 5.2 Application Monitoring — Set up synthetic monitoring
- [ ] 5.3 Alerting System — Configure alerts for error rate spikes
- [ ] 5.3 Alerting System — Set up alerts for response time degradation
- [ ] 5.3 Alerting System — Alert on database connection failures
- [ ] 5.3 Alerting System — Notify on security events (failed logins, permission violations)
- [ ] 5.3 Alerting System — Create on-call rotation and escalation policies
- [ ] 5.4 Business Metrics — Track asset utilization rates
- [ ] 5.4 Business Metrics — Monitor user engagement metrics
- [ ] 5.4 Business Metrics — Dashboard for key performance indicators
- [ ] 5.4 Business Metrics — License expiration tracking
- [ ] 5.4 Business Metrics — Asset maintenance due dates
- [ ] 6.1 Asset Management Enhancements — **Bulk Import/Export** - API exists; UI pending
- [ ] 6.1 Asset Management Enhancements — **Asset Images** - Photo uploads with thumbnail generation (DB only)
- [ ] 6.1 Asset Management Enhancements — **Barcode/QR Scanning** - Mobile scanning for quick asset lookup
- [x] 6.1 Asset Management Enhancements — **Asset Depreciation** - Done (2026-02-18, report tab added)
- [x] 6.1 Asset Management Enhancements — **Warranty Tracking** - Done (2026-02-18, warranty report tab added)
- [x] 6.1 Asset Management Enhancements — **Maintenance Scheduling** - Done (2026-02-18, full CRUD page)
- [x] 6.1 Asset Management Enhancements — **Asset Reservations** - Done (UI exists on asset detail page)
- [ ] 6.2 Reporting & Analytics — **Dashboard Widgets** - Customizable dashboard
- [ ] 6.2 Reporting & Analytics — **Report Builder** - Custom report generation
- [ ] 6.2 Reporting & Analytics — **Scheduled Reports** - Automated report delivery via email
- [ ] 6.2 Reporting & Analytics — **Cost Analysis** - Basic totals implemented; deeper TCO pending
- [ ] 6.2 Reporting & Analytics — **Compliance Reports** - Audit-ready documentation
- [ ] 6.3 User Experience Improvements — **Saved Filters** - Save and share filter presets
- [ ] 6.3 User Experience Improvements — **Customizable Tables** - Column selection and ordering
- [ ] 6.3 User Experience Improvements — **Bulk Actions** - Multi-select for mass operations (bulk delete assets only)
- [ ] 6.3 User Experience Improvements — **Mobile App** - Native iOS/Android application
- [x] 6.3 User Experience Improvements — **Offline Mode** - Done (2026-02-18 — PWA, service worker, offline page)
- [ ] 6.4 Notification System — **In-App Notifications** - Real-time notification center
- [ ] 6.4 Notification System — **Slack/Teams Integration** - Channel notifications
- [x] 7.1 Multi-tenancy — Organization/tenant isolation (Done 2026-02-18 — org scoping on 13+ API routes)
- [ ] 7.1 Multi-tenancy — Tenant-specific configurations
- [ ] 7.1 Multi-tenancy — Cross-tenant reporting (admin)
- [ ] 7.1 Multi-tenancy — White-labeling support
- [ ] 7.1 Multi-tenancy — Per-tenant billing
- [x] 7.2 Advanced Access Control — Custom role creation (Done — Role CRUD API + admin UI)
- [ ] 7.2 Advanced Access Control — Field-level permissions
- [ ] 7.2 Advanced Access Control — Department-based access
- [ ] 7.2 Advanced Access Control — Approval workflows for sensitive actions
- [ ] 7.2 Advanced Access Control — Temporary access grants
- [ ] 7.3 Integration Capabilities — REST API documentation (OpenAPI spec + endpoint only)
- [x] 7.3 Integration Capabilities — Webhook support for external systems (Done — 17 events, HMAC signatures, retry with backoff, admin UI)
- [ ] 7.3 Integration Capabilities — SSO/SAML integration
- [ ] 7.3 Integration Capabilities — LDAP/Active Directory sync
- [ ] 7.3 Integration Capabilities — Third-party integrations (Jira, ServiceNow, Slack)
- [ ] 7.3 Integration Capabilities — Zapier/Make integration
- [ ] 7.4 Internationalization — Multi-language support (i18n)
- [ ] 7.4 Internationalization — Date/time localization
- [ ] 7.4 Internationalization — Currency support
- [ ] 7.4 Internationalization — RTL layout support
- [ ] Quick Wins (Remaining) — Add database indexes
- [ ] Quick Wins (Remaining) — Set up Prettier (ESLint already configured)
- [ ] Quick Wins (Remaining) — Configure security headers

### plans/IMPLEMENTATION_PLAN.md
- [x] 1. Complete Table Migrations — Assets DashboardTable (Done 2026-02-18, mobile card view added)
- [ ] 2. Testing & Validation — Install Playwright browsers
- [ ] 2. Testing & Validation — Run E2E test suite
- [ ] 2. Testing & Validation — Fix any failing tests
- [ ] 2. Testing & Validation — Manual testing on actual devices
- [ ] 2. Testing & Validation — Address npm audit vulnerabilities (7 moderate)
- [ ] 3. Responsive Improvements (Phase 3.5 & 3.6) — Asset create/edit forms
- [ ] 3. Responsive Improvements (Phase 3.5 & 3.6) — User create/edit forms
- [ ] 3. Responsive Improvements (Phase 3.5 & 3.6) — All entity create/edit forms
- [ ] 4. Documentation Updates — Update README.md with new test commands
- [ ] 4. Documentation Updates — Document ResponsiveTable component usage
- [ ] 4. Documentation Updates — Add screenshots of mobile vs desktop views
- [x] 5. Code Quality — Fix eslint configuration issue (Done 2026-02-18, next lint→eslint src/)
- [x] 5. Code Quality — Run linter on all files (Done 2026-02-18, 0 errors / 7 warnings)
- [ ] 5. Code Quality — Add JSDoc comments to ResponsiveTable
- [ ] 5. Code Quality — Review and optimize bundle size
- [ ] 6. Future Enhancements — Performance testing with Lighthouse
- [ ] 6. Future Enhancements — Accessibility audit (WCAG compliance)
- [ ] 6. Future Enhancements — Visual regression testing
- [ ] 6. Future Enhancements — Load testing with large datasets
- [x] Phase 3 Complete (Responsive Layouts) — All tables migrated to ResponsiveTable (8/8 done)
- [ ] Phase 3 Complete (Responsive Layouts) — Forms stack properly on mobile
- [ ] Phase 3 Complete (Responsive Layouts) — All E2E tests passing
- [ ] Overall Success — Zero console errors or warnings
- [ ] Overall Success — Lighthouse scores: Performance >80, Accessibility >95
- [ ] Overall Success — All critical user flows tested (E2E)

### plans/IMPLEMENTATION_SUMMARY.md
- [ ] Post-Deployment — Enable HTTPS (production)
- [ ] Post-Deployment — Set up monitoring
- [ ] Post-Deployment — Configure backups
- [ ] Post-Deployment — Review audit logs
- [ ] Post-Deployment — Train users
- [ ] Post-Deployment — Document admin procedures

### plans/SAAS_BUSINESS_GUIDE.md
- [ ] Weekly — Review error logs
- [ ] Weekly — Check system metrics
- [ ] Weekly — Respond to support tickets
- [ ] Monthly — Security updates
- [ ] Monthly — Dependency updates
- [ ] Monthly — Performance review
- [ ] Monthly — Backup verification
- [ ] Quarterly — Feature releases
- [ ] Quarterly — Customer feedback review
- [ ] Quarterly — Pricing review
- [ ] Quarterly — Infrastructure scaling assessment
- [ ] Phase 1: Foundation (Weeks 1-4) — Set up multi-tenancy architecture
- [ ] Phase 1: Foundation (Weeks 1-4) — Implement tenant isolation
- [ ] Phase 1: Foundation (Weeks 1-4) — Create signup/onboarding flow
- [ ] Phase 1: Foundation (Weeks 1-4) — Set up Stripe billing integration
- [ ] Phase 1: Foundation (Weeks 1-4) — Create pricing page
- [ ] Phase 1: Foundation (Weeks 1-4) — Set up customer portal
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Deploy to production (Vercel + Supabase)
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Set up monitoring and alerting
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Implement backup systems
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Configure CDN and caching
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Set up status page
- [ ] Phase 2: Infrastructure (Weeks 5-8) — Create deployment automation
- [ ] Phase 3: Growth Features (Weeks 9-12) — Build feature gating system
- [ ] Phase 3: Growth Features (Weeks 9-12) — Implement usage tracking/limits
- [ ] Phase 3: Growth Features (Weeks 9-12) — Create admin dashboard
- [ ] Phase 3: Growth Features (Weeks 9-12) — Add team invitation system
- [ ] Phase 3: Growth Features (Weeks 9-12) — Build notification system
- [ ] Phase 3: Growth Features (Weeks 9-12) — Set up email automation
- [ ] Phase 4: Launch (Weeks 13-16) — Create marketing website
- [ ] Phase 4: Launch (Weeks 13-16) — Write documentation
- [ ] Phase 4: Launch (Weeks 13-16) — Set up support channels
- [ ] Phase 4: Launch (Weeks 13-16) — Launch on Product Hunt
- [ ] Phase 4: Launch (Weeks 13-16) — Start content marketing
- [ ] Phase 4: Launch (Weeks 13-16) — Begin paid advertising
- [ ] Phase 5: Scale (Ongoing) — Gather customer feedback
- [ ] Phase 5: Scale (Ongoing) — Iterate on features
- [ ] Phase 5: Scale (Ongoing) — Optimize conversion funnels
- [ ] Phase 5: Scale (Ongoing) — Expand marketing channels
- [ ] Phase 5: Scale (Ongoing) — Build integrations
- [ ] Phase 5: Scale (Ongoing) — Hire support staff (when needed)
- [ ] Minimum Viable SaaS (MVP) — **Multi-tenancy** - Tenant ID on all tables
- [ ] Minimum Viable SaaS (MVP) — **Authentication** - NextAuth with tenant context
- [ ] Minimum Viable SaaS (MVP) — **Billing** - Stripe Checkout + webhooks
- [ ] Minimum Viable SaaS (MVP) — **Limits** - Asset/user count enforcement
- [ ] Minimum Viable SaaS (MVP) — **Signup Flow** - Email + password + company name
- [ ] Minimum Viable SaaS (MVP) — **Pricing Page** - 3 tiers + annual discount
- [ ] Minimum Viable SaaS (MVP) — **Terms & Privacy** - Basic legal pages
- [ ] Minimum Viable SaaS (MVP) — **Support** - Email support setup
- [ ] Self-Hosted MVP — **License System** - Simple key validation
- [ ] Self-Hosted MVP — **Download Portal** - GitHub releases or customer portal
- [ ] Self-Hosted MVP — **Installation Docs** - Docker-based setup
- [ ] Self-Hosted MVP — **Payment** - Stripe Payment Links or Gumroad

### plans/SECURITY_AUTH_PLAN.md
- [ ] Generate secret with: openssl rand -base64 32 — NextAuth config loads without errors
- [ ] Generate secret with: openssl rand -base64 32 — API route `/api/auth/providers` returns credentials provider
- [ ] Generate secret with: openssl rand -base64 32 — Environment variables set correctly
- [ ] 2.5 Update User Creation API — Migration runs successfully
- [ ] 2.5 Update User Creation API — All existing passwords are hashed
- [ ] 2.5 Update User Creation API — New users are created with hashed passwords
- [ ] 2.5 Update User Creation API — Can no longer see plain text passwords in database
- [ ] 3.5 Update Root Layout — Can access login page
- [ ] 3.5 Update Root Layout — Can login with valid credentials
- [ ] 3.5 Update Root Layout — Invalid credentials show error
- [ ] 3.5 Update Root Layout — Session persists on refresh
- [ ] 3.5 Update Root Layout — User info displays in navigation
- [ ] 3.5 Update Root Layout — Sign out works and redirects to login
- [ ] 4.5 Protect API Routes (Example) — Unauthenticated users redirected to login
- [ ] 4.5 Protect API Routes (Example) — Authenticated users can access protected pages
- [ ] 4.5 Protect API Routes (Example) — Non-admin users cannot access admin pages
- [ ] 4.5 Protect API Routes (Example) — API endpoints reject unauthenticated requests
- [ ] 4.5 Protect API Routes (Example) — API endpoints reject non-admin requests for admin endpoints
- [ ] 5.5 Create Audit Log System — Admin users see all UI elements
- [ ] 5.5 Create Audit Log System — Regular users see limited UI elements
- [ ] 5.5 Create Audit Log System — Permission checks work on API routes
- [ ] 5.5 Create Audit Log System — Users can only edit their own profiles
- [ ] 5.5 Create Audit Log System — Audit logs created for sensitive actions
- [ ] 6.7 Input Validation & Sanitization — Rate limiting works (test with multiple requests)
- [ ] 6.7 Input Validation & Sanitization — Security headers present in responses
- [ ] 6.7 Input Validation & Sanitization — CSRF protection active
- [ ] 6.7 Input Validation & Sanitization — Input validation catches invalid data
- [ ] 6.7 Input Validation & Sanitization — Login attempts rate limited
- [ ] 7.1 Security Testing Checklist — Cannot access protected pages without login
- [ ] 7.1 Security Testing Checklist — Invalid credentials rejected
- [ ] 7.1 Security Testing Checklist — Session expires after timeout
- [ ] 7.1 Security Testing Checklist — Session persists across page reloads
- [ ] 7.1 Security Testing Checklist — Logout clears session completely
- [ ] 7.1 Security Testing Checklist — Cannot reuse old session tokens
- [ ] 7.1 Security Testing Checklist — Regular users cannot access admin pages
- [ ] 7.1 Security Testing Checklist — Regular users cannot call admin API endpoints
- [ ] 7.1 Security Testing Checklist — Users can only edit their own profiles
- [ ] 7.1 Security Testing Checklist — Permission guards work in UI
- [ ] 7.1 Security Testing Checklist — API permission checks work
- [ ] 7.1 Security Testing Checklist — Passwords are hashed in database
- [ ] 7.1 Security Testing Checklist — Rate limiting prevents brute force
- [ ] 7.1 Security Testing Checklist — CSRF tokens validated
- [ ] 7.1 Security Testing Checklist — Security headers present
- [ ] 7.1 Security Testing Checklist — No sensitive data in error messages
- [ ] 7.1 Security Testing Checklist — SQL injection prevented (Prisma handles this)
- [ ] 7.1 Security Testing Checklist — XSS prevented (React escapes by default)
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — All security tests pass
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Documentation complete
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Environment variables documented
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Admin dashboard accessible
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Audit logs working
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Password policy enforced
- [ ] 7.6 Two-Factor Authentication (Optional Enhancement) — Security headers verified
- [ ] Phase 1: NextAuth Setup ✅ — Set environment variables
- [ ] Phase 1: NextAuth Setup ✅ — Test auth configuration
- [ ] Phase 2: Database Integration ✅ — Add NextAuth tables to schema
- [ ] Phase 2: Database Integration ✅ — Run Prisma migration
- [ ] Phase 2: Database Integration ✅ — Run password migration
- [ ] Phase 2: Database Integration ✅ — Verify passwords hashed
- [ ] Phase 3: Login UI ✅ — Test login flow
- [ ] Phase 3: Login UI ✅ — Test session persistence
- [ ] Phase 4: Route Protection ✅ — Create auth middleware
- [ ] Phase 4: Route Protection ✅ — Test route protection
- [ ] Phase 5: RBAC ✅ — Apply RBAC to UI
- [ ] Phase 5: RBAC ✅ — Test RBAC enforcement
- [ ] Phase 6: API Security ✅ — Apply rate limiting
- [ ] Phase 6: API Security ✅ — Add CSRF protection
- [ ] Phase 6: API Security ✅ — Test API security
- [ ] Phase 7: Testing & Hardening ✅ — Run security tests
- [ ] Phase 7: Testing & Hardening ✅ — Secure environment variables
- [ ] Phase 7: Testing & Hardening ✅ — Final security audit
- [ ] Success Criteria — All pages protected by authentication
- [ ] Success Criteria — All API endpoints protected
- [ ] Success Criteria — RBAC enforced everywhere
- [ ] Success Criteria — Rate limiting active
- [ ] Success Criteria — Documentation complete
- [ ] Success Criteria — All tests passing
- [ ] Success Criteria — No critical vulnerabilities
- [ ] Success Criteria — Production-ready security posture

<!-- OPEN_TASKS_END -->
