# Asset Tracker — Database Migration Guide

How to migrate Asset Tracker's PostgreSQL database to a new server, provider, or instance.

---

## Table of Contents

1. [Overview](#overview)
2. [Before You Start](#before-you-start)
3. [Step 1: Export the Current Database](#step-1-export-the-current-database)
4. [Step 2: Create the New Database](#step-2-create-the-new-database)
5. [Step 3: Import the Dump](#step-3-import-the-dump)
6. [Step 4: Verify the Import](#step-4-verify-the-import)
7. [Step 5: Update the Application](#step-5-update-the-application)
8. [Step 6: Test the Application](#step-6-test-the-application)
9. [Step 7: Final Cutover](#step-7-final-cutover)
10. [Provider-Specific Instructions](#provider-specific-instructions)
11. [Migrating from Fresh (No Existing Data)](#migrating-from-fresh-no-existing-data)
12. [Schema Reference](#schema-reference)
13. [Troubleshooting](#troubleshooting)

---

## Overview

Asset Tracker uses **PostgreSQL** (15+) with **Prisma ORM**. The database contains:

- **42+ tables** covering assets, users, organizations, roles, audit logs, workflows, etc.
- **4 Prisma migrations** applied in order:
  1. `00000000000000_initial_baseline` — Core tables (users, assets, accessories, licences, consumables, etc.)
  2. `20260129151226_add_ticket_system` — IT ticket system
  3. `20260129165029_multi_tanancy` — Multi-tenancy (organizations, departments, roles, webhooks)
  4. `20260305_betterauth_schema` — BetterAuth auth tables (replaces NextAuth)
- **Encrypted data** — Some fields (API keys, MFA secrets) are encrypted with `ENCRYPTION_KEY`. The same key must be used on the new database.

**Migration strategy:** Full `pg_dump` export → import into new database → switch `DATABASE_URL`.

---

## Before You Start

### Checklist

- [ ] New PostgreSQL 15+ instance is running and accessible
- [ ] You have the current `DATABASE_URL` (source)
- [ ] You have the new `DATABASE_URL` (destination)
- [ ] You have the `ENCRYPTION_KEY` from the current deployment (encrypted data will be unreadable without it)
- [ ] You have sufficient disk space for the dump (2x database size recommended)
- [ ] You've scheduled a maintenance window (users will experience brief downtime during cutover)
- [ ] You've notified users if applicable

### Gather current database info

```bash
# Docker setup — check database size
docker compose exec db psql -U assettracker -c "
  SELECT pg_size_pretty(pg_database_size('assettracker')) AS db_size;
"

# Check table row counts
docker compose exec db psql -U assettracker -c "
  SELECT schemaname, relname AS table, n_live_tup AS row_count
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"

# Check migration status
docker compose exec app npx prisma migrate status
```

For external databases, replace `docker compose exec db psql -U assettracker` with `psql "YOUR_DATABASE_URL"`.

---

## Step 1: Export the Current Database

### Option A: Docker Compose database

```bash
# Plain SQL dump (human-readable, slower import)
docker compose exec -T db pg_dump -U assettracker \
  --no-owner --no-acl \
  assettracker > assettracker_export.sql

# Compressed dump (recommended for large databases)
docker compose exec -T db pg_dump -U assettracker \
  --no-owner --no-acl \
  --format=custom \
  assettracker > assettracker_export.dump
```

### Option B: External database (Supabase, Neon, etc.)

```bash
# Plain SQL
pg_dump "postgresql://user:pass@host:5432/assettracker" \
  --no-owner --no-acl \
  > assettracker_export.sql

# Compressed (recommended)
pg_dump "postgresql://user:pass@host:5432/assettracker" \
  --no-owner --no-acl \
  --format=custom \
  > assettracker_export.dump
```

### Option C: Bare-metal PostgreSQL

```bash
pg_dump -U assettracker --no-owner --no-acl assettracker > assettracker_export.sql
```

### Flags explained

| Flag              | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `--no-owner`      | Omits ownership commands (the new DB user may differ) |
| `--no-acl`        | Omits grant/revoke statements                         |
| `--format=custom` | Compressed binary format; supports parallel restore   |

### Verify the dump

```bash
# Check file size (should be non-zero)
ls -lh assettracker_export.*

# For SQL dumps, check it ends properly
tail -5 assettracker_export.sql
# Should end with something like: "-- PostgreSQL database dump complete"

# For custom dumps, verify integrity
pg_restore --list assettracker_export.dump | head -20
```

---

## Step 2: Create the New Database

### Option A: Self-hosted PostgreSQL

```bash
sudo -u postgres psql
```

```sql
-- Create user and database
CREATE USER assettracker WITH PASSWORD 'NEW_STRONG_PASSWORD';
CREATE DATABASE assettracker OWNER assettracker;
GRANT ALL PRIVILEGES ON DATABASE assettracker TO assettracker;

-- Required extensions (Prisma uses gen_random_uuid)
\c assettracker
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\q
```

### Option B: Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > Database > Connection string > URI**
3. Use the **Session mode** pooler URL (port 5432)
4. Save the connection string
5. `pgcrypto` extension is enabled by default

### Option C: Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string from the dashboard
3. Enable the `pgcrypto` extension:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Option D: Docker Compose (new server)

On the new server:

```bash
git clone https://github.com/YOUR_ORG/assettTracker.git
cd assettTracker
cp .env.example .env
# Edit .env with new database credentials

docker compose --profile with-db up -d db
# Wait for database to be ready
docker compose logs -f db
```

---

## Step 3: Import the Dump

### From SQL dump

```bash
# To an external database
psql "postgresql://user:pass@new-host:5432/assettracker" < assettracker_export.sql

# To a Docker database on the new server
cat assettracker_export.sql | docker compose exec -T db psql -U assettracker assettracker

# To local PostgreSQL
psql -U assettracker assettracker < assettracker_export.sql
```

### From custom/compressed dump

```bash
# To an external database
pg_restore --no-owner --no-acl \
  -d "postgresql://user:pass@new-host:5432/assettracker" \
  assettracker_export.dump

# To a Docker database
pg_restore --no-owner --no-acl \
  -d "postgresql://assettracker:password@localhost:5432/assettracker" \
  assettracker_export.dump

# Parallel restore (faster for large databases)
pg_restore --no-owner --no-acl --jobs=4 \
  -d "postgresql://user:pass@new-host:5432/assettracker" \
  assettracker_export.dump
```

### Expected output

You may see notices like:

```
NOTICE:  table "xxx" does not exist, skipping
```

These are safe to ignore — they occur when DROP IF EXISTS runs on a clean database.

**Errors to watch for:**

- `FATAL: password authentication failed` — wrong credentials
- `ERROR: database "assettracker" does not exist` — create the database first (Step 2)
- `ERROR: extension "pgcrypto" is not available` — install the extension (Step 2)

---

## Step 4: Verify the Import

Connect to the new database and verify:

```bash
psql "NEW_DATABASE_URL"
```

```sql
-- Check all tables exist (should be 42+)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Check key tables have data
SELECT 'users' AS tbl, count(*) FROM "user"
UNION ALL SELECT 'assets', count(*) FROM asset
UNION ALL SELECT 'organizations', count(*) FROM "Organization"
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'accounts', count(*) FROM accounts
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;

-- Verify Prisma migration history was copied
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;
```

Expected migrations:

```
 00000000000000_initial_baseline    | 2026-...
 20260129151226_add_ticket_system   | 2026-...
 20260129165029_multi_tanancy       | 2026-...
 20260305_betterauth_schema         | 2026-...
```

If the `_prisma_migrations` table is present with all 4 rows, the migration history is intact and Prisma will not attempt to re-run migrations.

---

## Step 5: Update the Application

### Docker

Edit `.env` on the application server:

```env
# Old:
# DATABASE_URL=postgresql://assettracker:oldpass@old-host:5432/assettracker

# New:
DATABASE_URL=postgresql://assettracker:newpass@new-host:5432/assettracker
```

If the new database is a cloud provider that requires SSL:

```env
DATABASE_SSL=true
```

> **Note:** SSL is auto-detected for Supabase and Neon URLs. Set `DATABASE_SSL=true` explicitly for other cloud providers.

Restart the application:

```bash
docker compose --profile with-db down
docker compose --profile app-only up -d
# Or if the new DB is still in Docker Compose:
docker compose --profile with-db up -d
```

### Vercel

1. Go to Project Settings > Environment Variables
2. Update `DATABASE_URL` to the new connection string
3. Add `DATABASE_SSL=true` if needed
4. Redeploy: trigger a new deployment (push a commit or click "Redeploy")

### Bare-metal / PM2

```bash
# Update .env with new DATABASE_URL
nano .env

# Restart
pm2 restart assettracker
```

---

## Step 6: Test the Application

Run through this checklist after switching:

- [ ] **Login works** — sign in with an existing admin account
- [ ] **Session persists** — refresh the page, still logged in
- [ ] **Asset list loads** — go to Assets, verify data is present
- [ ] **Create a test asset** — verify writes work
- [ ] **Admin Settings loads** — verify system_settings table migrated
- [ ] **Audit logs show history** — verify audit_logs data
- [ ] **Check Prisma migration status:**

```bash
# Should say "Database schema is up to date"
docker compose exec app npx prisma migrate status
# Or for bare-metal:
npx prisma migrate status
```

---

## Step 7: Final Cutover

Once everything is verified:

1. **Update DNS / connection strings everywhere** — make sure no service still points to the old database
2. **Take a final backup of the old database** (for safety)
3. **Monitor application logs** for the first 24 hours

```bash
# Docker
docker compose logs app -f --tail 50

# PM2
pm2 logs assettracker
```

4. **Keep the old database running for 7 days** as a rollback option, then decommission it

---

## Provider-Specific Instructions

### Migrating TO Supabase

Supabase connection strings use connection pooling. Use the correct URL:

- **Session mode** (port 5432) — for migrations and pg_restore
- **Transaction mode** (port 6543) — for the application `DATABASE_URL`

```bash
# Import using the SESSION mode URL (port 5432, not 6543)
pg_restore --no-owner --no-acl \
  -d "postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres" \
  assettracker_export.dump
```

After import, set the application `DATABASE_URL` to the **transaction mode** URL if using Vercel (serverless):

```env
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
```

For Docker/VPS (long-lived connections), use the **session mode** URL:

```env
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres
```

### Migrating TO Neon

Neon uses a serverless driver. The standard `pg` adapter works fine.

```bash
# Import
pg_restore --no-owner --no-acl \
  -d "postgresql://user:pass@ep-xxxxx.region.aws.neon.tech/assettracker?sslmode=require" \
  assettracker_export.dump
```

```env
DATABASE_URL=postgresql://user:pass@ep-xxxxx.region.aws.neon.tech/assettracker?sslmode=require
DATABASE_SSL=true
```

### Migrating TO a new Docker Compose instance

On the new server:

```bash
# 1. Set up the new server with Docker Compose
git clone https://github.com/YOUR_ORG/assettTracker.git && cd assettTracker
cp .env.example .env && nano .env

# 2. Start only the database
docker compose --profile with-db up -d db
# Wait for ready: docker compose logs -f db

# 3. Copy the dump file to the new server
scp assettracker_export.sql newserver:/opt/assettTracker/

# 4. Import
cat assettracker_export.sql | docker compose exec -T db psql -U assettracker assettracker

# 5. Start the app
docker compose --profile with-db up -d
```

### Migrating FROM Supabase TO self-hosted

```bash
# Export from Supabase (use session mode URL)
pg_dump "postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:5432/postgres" \
  --no-owner --no-acl --format=custom \
  --exclude-schema='auth|storage|realtime|supabase_*|graphql*|pgbouncer|pgsodium*|vault|extensions' \
  > assettracker_export.dump
```

The `--exclude-schema` flag skips Supabase's internal schemas that don't exist on a plain PostgreSQL server.

---

## Migrating from Fresh (No Existing Data)

If you're setting up a brand new database (no data to migrate), skip the dump/restore and use Prisma:

```bash
# Apply all migrations from scratch
DATABASE_URL="postgresql://user:pass@new-host:5432/assettracker" npx prisma migrate deploy

# Seed essential data (status types)
DATABASE_URL="postgresql://user:pass@new-host:5432/assettracker" npm run db:seed

# Create the first admin user
DATABASE_URL="postgresql://user:pass@new-host:5432/assettracker" node scripts/create-admin.mjs
```

This creates all 42+ tables and applies all 4 migrations in order.

---

## Schema Reference

### Migration History

| #   | Migration                          | Description          | Key Tables                                                                                                   |
| --- | ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `00000000000000_initial_baseline`  | Core schema          | user, asset, accessories, consumable, licence, accounts, sessions, audit_logs, system_settings, and ~25 more |
| 2   | `20260129151226_add_ticket_system` | IT tickets           | tickets, ticket_comments                                                                                     |
| 3   | `20260129165029_multi_tanancy`     | Multi-tenancy + RBAC | Organization, Department, Role, UserRole, Webhook, WebhookDelivery, AssetReservation, StockAlert, ImportJob  |
| 4   | `20260305_betterauth_schema`       | BetterAuth auth      | Renames columns in accounts/sessions, adds verification, twoFactor tables                                    |

### Key tables and their purposes

| Table                | Purpose                             | Typical Size   |
| -------------------- | ----------------------------------- | -------------- |
| `user`               | All users (PK: `userid`)            | Small          |
| `asset`              | IT assets (PK: `assetid`)           | Large          |
| `accessories`        | Peripherals, accessories            | Medium         |
| `consumable`         | Consumable inventory                | Medium         |
| `licence`            | Software licences                   | Medium         |
| `Component`          | Sub-components                      | Medium         |
| `accounts`           | Auth provider accounts (BetterAuth) | Small          |
| `sessions`           | Active user sessions                | Small          |
| `audit_logs`         | Security & change audit trail       | Can grow large |
| `Organization`       | Multi-tenant organizations          | Small          |
| `system_settings`    | App configuration                   | Small          |
| `_prisma_migrations` | Migration tracking                  | Tiny (4 rows)  |

### Encrypted columns

The following data is encrypted at rest using `ENCRYPTION_KEY`:

- API keys stored in `system_settings` (where `isEncrypted = true`)
- MFA/TOTP secrets in `twoFactor` table

**Critical:** If you change the `ENCRYPTION_KEY`, encrypted data becomes unreadable. Always carry the same `ENCRYPTION_KEY` to the new deployment.

---

## Troubleshooting

### "Database schema is not up to date"

```bash
# Check which migrations are pending
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

### "relation \_prisma_migrations does not exist"

The migration history table wasn't imported. This happens if you dumped a subset of tables. Solutions:

**Option A:** Re-import the full dump (recommended).

**Option B:** Baseline the existing database:

```bash
# Mark all migrations as applied without running them
npx prisma migrate resolve --applied 00000000000000_initial_baseline
npx prisma migrate resolve --applied 20260129151226_add_ticket_system
npx prisma migrate resolve --applied 20260129165029_multi_tanancy
npx prisma migrate resolve --applied 20260305_betterauth_schema
```

### "permission denied for table"

The new database user doesn't own the tables. Fix:

```sql
-- Connect as superuser
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO assettracker;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO assettracker;
GRANT USAGE ON SCHEMA public TO assettracker;
```

### "SSL connection is required"

Add `?sslmode=require` to the connection string or set `DATABASE_SSL=true`:

```env
DATABASE_URL=postgresql://user:pass@host:5432/assettracker?sslmode=require
DATABASE_SSL=true
```

### Import is slow

For large databases (>1 GB):

```bash
# Use parallel restore with custom format
pg_restore --no-owner --no-acl --jobs=4 \
  -d "NEW_DATABASE_URL" \
  assettracker_export.dump
```

### Data mismatch after import

```bash
# Compare row counts between old and new
# On OLD database:
psql "OLD_URL" -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"

# On NEW database:
psql "NEW_URL" -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
```

Row counts should match. If `n_live_tup` is 0 on the new database, run `ANALYZE;` to update statistics:

```sql
ANALYZE;
```

### Sessions don't work after migration

Active sessions from the old database should work if `BETTER_AUTH_SECRET` hasn't changed. If users get logged out:

- Verify `BETTER_AUTH_SECRET` matches the old deployment
- Check the `sessions` table has data: `SELECT count(*) FROM sessions;`
- Users can simply log in again — sessions are recreated automatically
