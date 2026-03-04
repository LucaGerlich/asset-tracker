<p align="center">
  <h1 align="center">Asset Tracker</h1>
  <p align="center">
    Open-source IT asset management platform for organizations of any size.
    <br />
    Track hardware, software, licences, consumables, and more — with RBAC, audit logging, and integrations.
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## Features

### Asset Management
- Full CRUD with detailed asset profiles and lifecycle management (procure → deploy → retire)
- Transfers between users, locations, and organizations
- Reservations and booking with approval workflows
- File attachments, depreciation tracking, warranty alerts
- Custom fields, QR code generation, printing, and scanning

### Users & Access Control
- 35 granular RBAC permissions across 30+ API routes
- Multi-tenancy with organization and department scoping
- Per-user preferences with regional formatting (date, number, currency)
- User activity history and admin tooling

### Consumables, Accessories & Licences
- Stock level tracking with quantity minimums and reorder alerts
- Check-out system with usage tracking
- Licence management and seat assignment

### Ticketing & Workflows
- Built-in ticket system with Kanban board and user views
- Automated workflow engine with condition evaluation and 5 action types
- Maintenance scheduling and tracking

### Integrations
- **Slack & Microsoft Teams** — real-time notifications for asset, user, maintenance, and stock events
- **Webhooks** — HMAC-signed with retry backoff and delivery log viewer
- **SSO/SAML** and **LDAP/AD** authentication
- **Freshdesk** ticket sync
- **Stripe** billing for SaaS mode

### Security & Compliance
- MFA/2FA with TOTP and backup codes
- AES-256-GCM encryption at rest for secrets
- Audit logging with full entity diffs
- GDPR data retention enforcement with automated cron jobs
- Rate limiting, account lockout, concurrent session management
- Full CSP, HSTS, and security headers

### Dashboard & Reporting
- Customizable dashboard with drag-and-drop widgets
- 5+ chart types: lifecycle, cost breakdown, location distribution, maintenance trends, depreciation forecast
- CSV and PDF export
- Search with typeahead and filterable URLs

### Mobile & PWA
- Progressive Web App with offline support and install prompt
- Mobile-optimized navigation with responsive tables
- QR scanning for asset lookup

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router + Turbopack) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/) |
| Auth | [NextAuth v5](https://authjs.dev/) with JWT sessions |
| UI | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix) |
| Validation | [Zod](https://zod.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| Monitoring | [Sentry](https://sentry.io/) |
| Testing | [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E) |
| Payments | [Stripe](https://stripe.com/) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (or [Bun](https://bun.sh/))
- **PostgreSQL** database

### Installation

```bash
git clone https://github.com/LucaGerlich/assettTracker.git
cd assettTracker

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL at minimum
# Generate a secret: openssl rand -base64 32

# Set up database
npx prisma db push
npx prisma generate

# (Optional) Seed with sample data
bun run db:seed

# Start development server
bun dev
```

Open **http://localhost:3000** to get started.

### Create an Admin User

```bash
bun run create-admin
```

### Docker

```bash
docker build -t asset-tracker .
docker run -p 3000:3000 --env-file .env asset-tracker
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server with Turbopack |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |
| `bun run test` | Run unit tests (Vitest) |
| `bun run test:e2e` | Run E2E tests (Playwright) |
| `bun run db:seed` | Seed the database |
| `bun run db:demo-seed` | Seed with demo data |
| `bun run create-admin` | Create an admin user |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # 100+ REST API endpoints
│   ├── assets/             # Asset management pages
│   ├── dashboard/          # Dashboard with customizable widgets
│   ├── admin/              # Admin settings & configuration
│   ├── login/              # Auth pages (login, MFA, password reset)
│   └── ...                 # Accessories, licences, consumables, etc.
├── components/             # Shared UI components (shadcn/ui based)
├── hooks/                  # Custom React hooks (usePermissions, useSession, etc.)
├── lib/                    # Core utilities
│   ├── integrations/       # Slack/Teams notification module
│   ├── rbac.ts             # Permission system (35 permissions)
│   ├── workflow-engine.ts  # Automated workflow execution
│   ├── gdpr-retention.ts   # GDPR retention enforcement
│   ├── tenant-limits.ts    # Plan-based resource limits
│   └── ...                 # Auth, validation, encryption, webhooks
└── ui/                     # Page-specific UI components
prisma/
└── schema.prisma           # Data model (42 models)
```

---

## Environment Variables

Copy `.env.example` for the full list. Key groups:

| Category | Variables | Required |
|----------|-----------|----------|
| Database | `DATABASE_URL` | Yes |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Yes |
| Encryption | `ENCRYPTION_KEY` | Recommended |
| Email | `EMAIL_PROVIDER`, provider-specific keys | No |
| Storage | `STORAGE_PROVIDER`, `S3_*` or `UPLOAD_DIR` | No |
| Integrations | Slack/Teams webhook URLs, Freshdesk keys | No |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | No |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No |

---

## Deployment

Asset Tracker can be deployed anywhere that supports Next.js:

- **Vercel** — zero-config deployment with built-in cron scheduling
- **Docker** — self-hosted with the included Dockerfile
- **Any Node.js host** — `bun run build && bun start`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide for Vercel, Docker, and self-hosting |
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Developer quick start — auth patterns, permissions, multi-tenancy |
| [SECURITY_GUIDE.md](docs/SECURITY_GUIDE.md) | Security architecture and implementation details |
| [DEVELOPMENT_NOTES.md](docs/DEVELOPMENT_NOTES.md) | Architecture decisions and implementation history |

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and add tests where appropriate
4. Run linting and tests (`bun run lint && bun run test`)
5. Commit with a conventional commit message
6. Open a Pull Request

This project uses [Husky](https://typicode.github.io/husky/) pre-commit hooks with Prettier and ESLint.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Luca Gerlich
