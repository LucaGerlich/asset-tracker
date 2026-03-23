<div align="center">

# Asset Tracker

**Open-source IT asset management for teams of any size.**

Track hardware, software licences, consumables, and accessories — with role-based access, audit logging, SSO, and integrations built in.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[Features](#features) · [Quick Start](#quick-start) · [Deployment](#deployment) · [Configuration](#configuration) · [Contributing](#contributing)

</div>

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Asset Management

- Full lifecycle tracking (procure, deploy, maintain, retire)
- Check-out / check-in with audit trail and history
- Reservations with admin approval workflow and email notifications
- File attachments with image gallery and thumbnails
- QR code generation, printing, and scanning with action panel
- Custom fields per asset category
- Depreciation tracking and warranty alerts
- Bulk import (CSV) for assets, accessories, consumables, licences, users, and locations

</td>
<td width="50%" valign="top">

### Users & Access Control

- 35 granular RBAC permissions
- Multi-tenancy with organization and department scoping
- Role-based dashboard (admin stats vs. user "My Assets" view)
- Microsoft Entra ID (Azure AD) SSO
- LDAP / Active Directory authentication
- SAML SSO support
- MFA / 2FA with TOTP and backup codes
- Per-user preferences (date, number, currency formats)

</td>
</tr>
<tr>
<td valign="top">

### Inventory

- **Licences** — seat assignment, compliance monitoring, expiry tracking
- **Accessories** — check-out tracking with quantity management
- **Consumables** — stock levels with reorder alerts and stock alert system
- **Components** — categorized tracking and assignment

</td>
<td valign="top">

### Ticketing & Workflows

- Built-in ticket system with Kanban board
- Email notifications on ticket assignment, comments, and status changes
- Automated workflow engine (conditions + 5 action types)
- Recurring maintenance scheduling with auto-calculated next due dates
- Request and approval flows with admin email notifications

</td>
</tr>
<tr>
<td valign="top">

### Integrations

- **Slack & Microsoft Teams** notifications
- **Webhooks** — HMAC-signed with retry and delivery logs
- **Freshdesk** ticket sync
- **Stripe** billing (SaaS mode)
- **Email** — Brevo, SendGrid, Mailgun, Postmark, SES
- **SCIM** — user provisioning (RFC 7644 compliant)

</td>
<td valign="top">

### Security & Compliance

- AES-256-GCM encryption at rest
- Full organization scoping on all API endpoints (SaaS-ready)
- Audit logging with full entity diffs
- GDPR data retention enforcement (automated cron)
- Rate limiting and account lockout
- Referential integrity checks on delete operations
- CSP, HSTS, and security headers
- Input validation (Zod) on all write endpoints

</td>
</tr>
<tr>
<td valign="top">

### Dashboard & Reporting

- Drag-and-drop customizable widgets
- Dashboard widgets: stats, expiring licences, cost overview, recent activity, upcoming maintenance
- Charts: lifecycle, cost by category, asset age, location, maintenance, depreciation forecast
- CSV, Excel, and PDF export
- Typeahead search with filterable URLs

</td>
<td valign="top">

### Mobile & PWA

- Progressive Web App with install prompt
- Mobile-optimized navigation and tables
- QR scanning with asset detail action panel
- Responsive card views for all data tables

</td>
</tr>
</table>

---

## Tech Stack

| Layer      | Technology                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ |
| Framework  | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)                                  |
| Language   | [TypeScript 5.9](https://www.typescriptlang.org/)                                          |
| Database   | [PostgreSQL](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/) (42 models) |
| Auth       | [BetterAuth](https://www.better-auth.com/) — sessions, SSO, MFA                            |
| UI         | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)           |
| Validation | [Zod](https://zod.dev/)                                                                    |
| Charts     | [Recharts](https://recharts.org/)                                                          |
| Monitoring | [Sentry](https://sentry.io/) / [Glitchtip](https://glitchtip.com/)                         |
| Testing    | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)                      |
| Caching    | PostgreSQL UNLOGGED tables (serverless-safe)                                               |

---

## Quick Start

### Prerequisites

- **Node.js 18+** or [Bun](https://bun.sh/)
- **PostgreSQL** database

### 1. Clone and install

```bash
git clone https://github.com/luca-fitseveneleven/assetTracker.git
cd assetTracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set at minimum:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/assettracker
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=          # generate with: openssl rand -base64 32
ENCRYPTION_KEY=              # generate with: openssl rand -hex 32
CRON_SECRET=                 # generate with: openssl rand -hex 16 (required in production)
```

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Create an admin user

```bash
npm run create-admin
```

### 5. Start the server

```bash
npm run dev
```

Open **http://localhost:3000** and sign in.

---

## Deployment

### Docker

```bash
docker build -t asset-tracker .
docker run -p 3000:3000 --env-file .env asset-tracker
```

### Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: assettracker
      POSTGRES_USER: assettracker
      POSTGRES_PASSWORD: changeme
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/luca-fitseveneleven/assetTracker)

Set the environment variables in the Vercel dashboard and connect your PostgreSQL database. The build command automatically runs migrations.

### Any Node.js Host

```bash
npm run build
npm start
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` for the full reference.

| Category          | Key Variables                                                           |     Required     |
| ----------------- | ----------------------------------------------------------------------- | :--------------: |
| **Database**      | `DATABASE_URL`                                                          |       Yes        |
| **Auth**          | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`                                 |       Yes        |
| **Encryption**    | `ENCRYPTION_KEY`                                                        |   Recommended    |
| **Cron**          | `CRON_SECRET`                                                           | Yes (production) |
| **Microsoft SSO** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |        No        |
| **Email**         | `EMAIL_PROVIDER`, provider API keys                                     |        No        |
| **Storage**       | `STORAGE_PROVIDER` (`local`, `s3`, `azure`)                             |        No        |
| **Integrations**  | Slack/Teams webhooks, Freshdesk API key                                 |        No        |
| **Billing**       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                            |        No        |
| **Redis**         | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                    |        No        |
| **CAPTCHA**       | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                |        No        |
| **Self-hosted**   | `SELF_HOSTED=true` — disables landing page, pricing, registration       |        No        |

---

## Scripts

| Command                | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Start dev server (Turbopack)           |
| `npm run build`        | Production build (includes migrations) |
| `npm start`            | Start production server                |
| `npm run lint`         | ESLint                                 |
| `npm run format`       | Prettier                               |
| `npm run test`         | Unit tests (Vitest)                    |
| `npm run test:e2e`     | E2E tests (Playwright)                 |
| `npm run analyze`      | Bundle size analysis                   |
| `npm run db:seed`      | Seed database                          |
| `npm run create-admin` | Create admin user                      |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router — pages & API routes
│   ├── api/                # 160+ REST API endpoints
│   ├── assets/             # Asset management pages
│   ├── dashboard/          # Role-based widget dashboard
│   ├── admin/              # Admin settings & configuration
│   └── ...                 # Licences, accessories, consumables, etc.
├── components/             # Shared UI components (shadcn/ui)
│   └── dashboard/          # Dashboard widgets (stats, cost, licences)
├── hooks/                  # Custom React hooks
├── lib/                    # Core utilities
│   ├── email/              # Email templates and queue service
│   ├── integrations/       # Slack / Teams notification module
│   ├── storage/            # Pluggable file storage (local, S3, Azure)
│   ├── errors.ts           # Typed error classes (AppError hierarchy)
│   ├── rbac.ts             # Permission system (35 permissions)
│   ├── notifications.ts    # Email notification service
│   ├── workflow-engine.ts  # Automated workflow execution
│   ├── cache.ts            # PostgreSQL-backed cache (UNLOGGED table)
│   ├── rate-limit.ts       # Distributed rate limiting
│   ├── url.ts              # Base URL helper (env-aware)
│   └── ...                 # Auth, validation, encryption, webhooks
└── ui/                     # Page-specific UI components
prisma/
└── schema.prisma           # Data model (42 models)
tests/
├── e2e/                    # Playwright E2E tests (11 test files)
└── ...                     # Vitest unit tests (29 test files)
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run linting and tests (`npm run lint && npm run test`)
4. Commit with a conventional commit message
5. Open a Pull Request

This project uses [Husky](https://typicode.github.io/husky/) pre-commit hooks with Prettier, ESLint, and [commitlint](https://commitlint.js.org/).

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Luca Gerlich
