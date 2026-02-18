# Asset Tracker

A comprehensive, full-featured asset management platform built with Next.js. Track hardware, software, consumables, licences, and more across your organization with role-based access, audit logging, and integrations.

## Features

### Asset Management
- Full CRUD for assets with detailed profiles
- Asset lifecycle management (procure, deploy, retire)
- Transfers between users, locations, and organizations
- Reservation and booking system with approval flows
- File attachments and photos
- Depreciation tracking and reporting
- Warranty tracking and alerts
- Custom fields on assets
- QR code generation, printing, and scanning

### User Management
- Role-based access control (RBAC)
- Organization and department scoping
- Per-user preferences and settings
- User history timeline
- Admin tooling for org configuration

### Consumables & Accessories
- Stock level tracking with quantity and minimums
- Check-out system with usage tracking
- Automatic reorder alerts and low-stock notifications
- Category management

### Licences
- Licence management and assignment
- Licence categories

### Integrations
- Freshdesk integration for IT tickets
- Slack and Teams notifications
- Webhooks with delivery log viewer
- SSO/SAML provider support
- LDAP/AD sync and auth mapping

### Compliance & Security
- Audit logging with full entity diffs
- GDPR data retention and export tooling
- Encryption at rest (AES-256-GCM)
- Compliance reporting (SOX/HIPAA scaffolding)
- Account lockout, session timeout, and rate limiting

### Performance
- Server-side pagination and filtering
- Caching strategy (server-side + optional Redis)
- Rate limiting (in-memory or Upstash Redis)
- Database index optimization and transactions

### UX
- Search typeahead and auto-suggestions
- Keyboard navigation and shortcuts
- Skeleton loaders for perceived performance
- Shareable URLs with filters in query params
- i18n/localization framework
- Regional settings (date, number, currency)

### Mobile & PWA
- Progressive Web App with offline support
- Mobile-optimized navigation and workflows
- Responsive tables
- QR scanning for asset lookup
- Install prompt

## Tech Stack

- **Next.js 16** (App Router + Turbopack)
- **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **NextAuth.js** (v5)
- **Zod** validation
- **Sentry** error tracking
- **Playwright** E2E testing
- **Recharts** dashboards

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- [Bun](https://bun.sh/) (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd assettTracker

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Edit .env and set your DATABASE_URL and NEXTAUTH_SECRET
# Generate a secret: openssl rand -base64 32

# Push the database schema and generate the Prisma client
npx prisma db push
npx prisma generate

# (Optional) Seed the database
bun run db:seed

# Start the development server
bun dev
```

The app will be available at **http://localhost:3000**.

## Environment Variables

Copy `.env.example` and configure the following groups:

| Category | Key Variables | Required |
|---|---|---|
| Database | `DATABASE_URL` | Yes |
| NextAuth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Yes |
| Encryption | `ENCRYPTION_KEY` | Recommended |
| Feature Flags | `FEATURE_RATE_LIMITING`, `FEATURE_AUDIT_LOGGING`, etc. | No (defaults enabled) |
| Email | `EMAIL_PROVIDER`, provider-specific keys | No |
| Storage | `STORAGE_PROVIDER`, `S3_*` or `UPLOAD_DIR` | No |
| Freshdesk | `FRESHDESK_DOMAIN`, `FRESHDESK_API_KEY` | No |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No |

See `.env.example` for full details and provider options.

## Project Structure

```
src/
├── app/           # Next.js pages and API routes
├── components/    # Shared UI components
├── hooks/         # Custom React hooks
├── lib/           # Utilities (auth, prisma, cache, validation, etc.)
└── ui/            # Page-specific UI components
```

## Available Scripts

| Command | Description |
|---|---|
| `bun dev` | Start dev server with Turbopack and inspector |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:seed` | Seed the database |
| `bun run db:demo-seed` | Seed with demo data |
| `bun run db:demo-reset` | Reset demo database |
| `bun run create-admin` | Create an admin user |
| `bun run test` | Run Playwright tests |
| `bun run test:ui` | Run Playwright with UI mode |
| `bun run test:mobile` | Run mobile-specific tests |
| `bun run test:report` | Show Playwright test report |

## License

This project is licensed under the MIT License. See [licence.md](licence.md) for details.
