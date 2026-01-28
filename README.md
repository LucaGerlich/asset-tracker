# Asset Management System

This project is an Asset Management System designed to help organizations manage their assets efficiently. It includes features like assigning assets to users, updating asset information, unassigning assets, and filtering assets based on various criteria. The application is built with Next.js, React, and Prisma for the database interactions.

This is build using [Next.js](https://nextjs.org/), [Prisma](https://prisma.io/), [PostgreSQL](https://postgresql.org/) and [shadcn/ui](https://ui.shadcn.com/)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Manual Installation](#manual-installation)
- [Docker Deployment](#docker-deployment)
- [Demo Deployment](#demo-deployment)
- [API Testing with Postman](#api-testing-with-postman)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Asset Management**: Add, update, assign, and unassign assets.
- **User Management**: Assign users to assets and manage user information.
- **Filtering and Sorting**: Filter assets by various criteria and sort them as needed.
- **Pagination**: Efficiently handle large datasets with pagination.
- **Responsive Design**: Fully responsive design for mobile and desktop views.
- **Search Functionality**: Quickly search for assets using the search bar.
- **User Onboarding**: Intuitive user onboarding with guided tours and tooltips.
- **Accessibility**: Designed with accessibility in mind.
- **Docker Support**: Easy deployment with Docker and Docker Compose.
- **Podman Support**: Alternative deployment with Podman and podman-compose.

## Installation

### Quick Start with Docker

The easiest way to get started is using the interactive installation script:

```bash
# Clone the repository
git clone https://github.com/your-username/asset-management-system.git
cd asset-management-system

# Run the interactive installer
./install.sh
```

The installer will guide you through:
- Choosing between using an existing PostgreSQL database or creating one with Docker
- Selecting schema creation method (Prisma migrations or SQL scripts)
- Configuring application settings

### Manual Installation

If you prefer manual setup:

```bash
# Clone the repository
git clone https://github.com/your-username/asset-management-system.git
cd asset-management-system

# Install dependencies
npm install
# or
bun install

# Copy environment example and configure
cp .env.example .env
# Edit .env with your database settings

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
# or push schema directly
npx prisma db push

# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker Deployment

The application supports both **Docker** and **Podman** as container runtimes. The install script automatically detects which one is available.

### Prerequisites

**Option A: Docker**
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2 recommended)

**Option B: Podman**
- [Podman](https://podman.io/getting-started/installation)
- [podman-compose](https://github.com/containers/podman-compose) (`pip install podman-compose` or `dnf install podman-compose`)

### Using Docker Compose / Podman Compose

**Option 1: Full Stack (App + PostgreSQL)**

```bash
# Copy and configure environment
cp .env.example .env

# Start with included PostgreSQL database
docker compose --profile with-db up -d

# Run Prisma migrations (first time only)
docker compose exec app npx prisma migrate deploy
```

**Option 2: App Only (External Database)**

```bash
# Configure .env with your external database URL
# DATABASE_URL="postgresql://user:password@your-host:5432/your-db"

# Start app only
docker compose --profile app-only up -d
```

**Option 3: Development Mode**

```bash
# Start with hot-reload for development
docker compose --profile dev up -d
```

### Docker Commands

```bash
# View logs
docker compose logs -f

# Stop all services
docker compose down

# Restart services
docker compose restart

# Access app shell
docker compose exec app sh

# Run Prisma commands
docker compose exec app npx prisma studio
docker compose exec app npx prisma migrate deploy
```

### Podman Commands

If using Podman instead of Docker, replace `docker compose` with `podman-compose`:

```bash
# View logs
podman-compose logs -f

# Stop all services
podman-compose down

# Restart services
podman-compose restart

# Access app shell
podman-compose exec app sh

# Run Prisma commands
podman-compose exec app npx prisma studio
podman-compose exec app npx prisma migrate deploy
```

### Database Schema Setup

You can set up the database schema using either method:

**Using Prisma (Recommended):**
```bash
# Push schema to database
npx prisma db push

# Or run migrations
npx prisma migrate deploy

# Seed initial data
npm run db:seed
```

**Using SQL Scripts:**
```bash
# Using psql
psql -h localhost -U assettracker -d assettracker -f sql/init/01-schema.sql
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database Connection
DATABASE_URL="postgresql://assettracker:assettracker@localhost:5432/assettracker"

# Docker PostgreSQL Settings (if using Docker-provided database)
POSTGRES_USER=assettracker
POSTGRES_PASSWORD=assettracker
POSTGRES_DB=assettracker

# Application Settings
APP_PORT=3000
DB_PORT=5432
NODE_ENV=production
```

## API Testing with Postman

A Postman collection is included for API testing:

1. Import the collection from `postman/AssetTracker.postman_collection.json`
2. Import the environment from `postman/AssetTracker.postman_environment.json`
3. Set the `baseUrl` variable to your server URL (default: `http://localhost:3000`)

## Demo Deployment

You can deploy a public demo version of the application using Supabase as the database backend. The demo includes:

- **Pre-populated sample data** - Realistic test data showcasing all features
- **Automatic resets** - Database refreshes every 30 minutes
- **Demo accounts** - Pre-configured admin and user accounts

### Quick Start

1. Create a [Supabase](https://supabase.com) project
2. Deploy to Vercel/Railway with environment variables:
   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DATABASE_SSL="true"
   DEMO_MODE="true"
   NEXTAUTH_URL="https://your-domain.com"
   NEXTAUTH_SECRET="your-secret"
   ```
3. Initialize the database:
   ```bash
   npx prisma db push
   npm run db:demo-seed
   ```

### Demo Credentials

| Account | Username | Password |
|---------|----------|----------|
| Admin | demo_admin | demo123 |
| User | demo_user | demo123 |

For detailed setup instructions, see [docs/DEMO_HOSTING.md](docs/DEMO_HOSTING.md).

### Available API Endpoints

| Category | Endpoint | Methods |
|----------|----------|---------|
| Assets | `/api/asset` | GET, POST |
| Assets | `/api/asset/getAsset` | GET |
| Assets | `/api/asset/addAsset` | POST |
| Assets | `/api/asset/updateStatus` | PATCH |
| Assets | `/api/asset/deleteAsset` | DELETE |
| Users | `/api/user` | GET, POST |
| User Assets | `/api/userAssets` | GET |
| User Assets | `/api/userAssets/assign` | POST |
| User Assets | `/api/userAssets/unassign` | POST |
| Accessories | `/api/accessories` | GET |
| Licences | `/api/licence` | GET |
| Consumables | `/api/consumable` | GET |
| Locations | `/api/location` | GET |
| Manufacturers | `/api/manufacturer` | GET |
| Suppliers | `/api/supplier` | GET |

## Database Schema

The database schema includes the following main tables:

- **user**: User accounts and permissions
- **asset**: Physical assets (laptops, phones, etc.)
- **accessories**: Asset accessories
- **consumable**: Consumable items
- **licence**: Software licenses
- **location**: Physical locations
- **manufacturer**: Asset manufacturers
- **supplier**: Asset suppliers
- **model**: Asset models
- **userAssets**: User-Asset assignments
- **userAccessoires**: User-Accessory assignments
- **userHistory**: Audit trail

See `prisma/schema.prisma` for the complete schema definition or `sql/init/01-schema.sql` for the SQL version.

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature-branch`)
6. Create a new Pull Request

## Licence
