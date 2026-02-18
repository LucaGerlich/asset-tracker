# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-18

### Added

#### Phase 0 -- Baseline
- Core asset CRUD with QR codes, validation, and bulk operations
- User management with roles, permissions, and profile pages
- Accessories, licenses, and consumables management
- Supporting entities (manufacturers, suppliers, locations, models, status types, categories)
- Dashboard with summary statistics and charts
- Reporting and analytics with CSV/PDF export
- Global search across all entities
- Email notification system (Brevo, SendGrid, Mailgun, Postmark, SES)
- Admin settings panel (general, email, notifications, labels, depreciation, custom fields)
- Audit logging infrastructure and asset history timeline
- Authentication with NextAuth, feature flags, and rate limiting
- Docker and Podman deployment support
- Database schema for multi-tenancy, RBAC, webhooks, reservations, maintenance, and more

#### Phase 1 -- In-Progress Features
- User history timeline on user detail page
- Asset label printing workflow from assets table
- Saved search filters with database persistence
- Maintenance scheduling UI (list, create, update, close)
- Warranty tracking UI on asset detail pages
- Depreciation UI surfaced in asset views and reports
- Custom fields support on asset create, edit, and detail pages
- Consumable quantity and minimums UI with validation

#### Phase 2 -- Pending Functionalities
- Asset photos and attachments UI with API integration
- Consumables stock level management workflows
- Automatic reorder alerts for low-stock consumables
- Consumable check-out system and usage tracking
- Per-user settings and preferences persistence
- Freshdesk integration settings UI
- Freshdesk API integration for IT tickets (Hardware Request, Problem types)
- IT Tickets page with Freshdesk ticket listing, filtering, and search
- Local ticket system with comments (API and UI)

#### Phase 3 -- Multi-Tenancy and RBAC
- Organization management UI (admin settings tab)
- Role management UI and user-role assignment
- Organization scoping enforced on all queries and API endpoints

#### Phase 4 -- Integrations and API Surface
- Webhooks UI and delivery log viewer
- SSO/SAML configuration UI
- LDAP/AD integration settings (sync and auth mapping)
- Slack and Teams integrations for notifications
- Freshdesk ticketing integration with settings and ticket management

#### Phase 5 -- Advanced Asset Workflows
- Asset reservation and booking UI with approval flow
- Asset lifecycle management workflow (procure, deploy, retire)
- Asset transfers between users, locations, and organizations
- Approval workflows for asset requests
- Barcode scanning and QR code generation support
- Location tracking integration scaffolding (GPS/RFID)
- Automated workflows engine with configurable rules and triggers

#### Phase 6 -- Performance and Scalability
- Server-side pagination and filtering across 5 API routes
- In-memory caching strategy with TTL-based expiration
- 11 database indexes on key lookup columns
- Zod validation for critical API endpoints
- Database transactions for multi-step operations

#### Phase 7 -- Compliance and Security
- AES-256-GCM encryption utility for sensitive data at rest
- Secrets management utility
- Enhanced audit logging with full entity diffs
- Audit log viewer (admin page with filters, pagination, CSV export)
- GDPR data export, anonymization, and retention tools
- Compliance reporting dashboard (SOX/HIPAA scaffolding)
- Input sanitization utility

#### Phase 8 -- UX, Accessibility, and i18n
- Skeleton loaders for all major pages
- Shareable URLs with filter and pagination state in query params
- Search typeahead and autocomplete in sidebar
- Keyboard shortcuts (Ctrl+K search, g+a/u/d/c navigation, ? help dialog)
- Skip-to-content link and ARIA labels for screen readers
- i18n framework with English locale (120+ translatable strings)
- Regional formatting for dates, numbers, currency, and relative time
- FormattedDate component for consistent date rendering
- ActionTooltip, StatusBadge, ConfirmDialog, and EmptyState components
- CSS hover-lift and transition utilities

#### Phase 9 -- Mobile and PWA
- PWA manifest, service worker, and offline fallback page
- Install prompt with 7-day dismissal cooldown
- Mobile bottom navigation bar with sheet drawer
- ResponsiveTable component (card view on mobile)
- Touch-friendly tap targets and safe area handling
- Offline detection banner with online/offline transitions
- Client-side API response caching (localStorage, 5MB limit, TTL)

### Changed
- Rate limiting verified and enforced across all API routes
- Security headers hardened (CSP, X-Content-Type-Options, X-Frame-Options, XSS protection)

### Fixed
- Two unprotected admin API routes patched (privilege escalation vulnerability)

### Security
- AES-256-GCM encryption for sensitive data at rest
- Security headers (CSP, XSS protection, X-Frame-Options, X-Content-Type-Options)
- Input sanitization on all user-facing inputs
- Privilege escalation fix on 2 admin API routes
- GDPR-compliant data export, anonymization, and retention policies
- Rate limiting enforced on all endpoints

[1.0.0]: https://github.com/your-org/assettTracker/releases/tag/v1.0.0
