# Asset Tracker — Hosting Guide

Complete guide for deploying Asset Tracker to production. Covers VPS (Docker), Vercel, and bare-metal setups.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Option A: VPS with Docker (Recommended)](#option-a-vps-with-docker-recommended)
4. [Option B: Vercel (Managed)](#option-b-vercel-managed)
5. [Option C: Bare-Metal / PM2](#option-c-bare-metal--pm2)
6. [Reverse Proxy & SSL](#reverse-proxy--ssl)
7. [Cron Jobs](#cron-jobs)
8. [File Storage](#file-storage)
9. [Email Configuration](#email-configuration)
10. [Monitoring & Logging](#monitoring--logging)
11. [Backups](#backups)
12. [Updating](#updating)
13. [Security Hardening](#security-hardening)
14. [Troubleshooting](#troubleshooting)

---

## System Requirements

| Component                 | Minimum               | Recommended                     |
| ------------------------- | --------------------- | ------------------------------- |
| CPU                       | 1 vCPU                | 2 vCPU                          |
| RAM                       | 1 GB                  | 2 GB                            |
| Disk                      | 10 GB                 | 20 GB+ (depends on attachments) |
| OS                        | Any Linux with Docker | Ubuntu 22.04+ / Debian 12+      |
| PostgreSQL                | 15                    | 16                              |
| Node.js (bare-metal only) | 20                    | 20 LTS                          |

**Tested VPS providers:** Hetzner, DigitalOcean, Contabo, AWS EC2, OVH, Linode.

---

## Environment Variables Reference

### Required

| Variable             | Description                                                          | Example                                         |
| -------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                                         | `postgresql://user:pass@host:5432/assettracker` |
| `BETTER_AUTH_SECRET` | Signs auth tokens. Generate: `openssl rand -base64 32`               | `K7x9...`                                       |
| `BETTER_AUTH_URL`    | Public URL of the app                                                | `https://assets.example.com`                    |
| `ENCRYPTION_KEY`     | AES-256-GCM key for sensitive data. Generate: `openssl rand -hex 32` | `a3f7...` (64 hex chars)                        |

### Recommended

| Variable      | Description                                               | Example      |
| ------------- | --------------------------------------------------------- | ------------ |
| `CRON_SECRET` | Protects cron endpoints. Generate: `openssl rand -hex 16` | `b4e2...`    |
| `SELF_HOSTED` | Skip SaaS landing page, go straight to login              | `true`       |
| `NODE_ENV`    | Runtime environment                                       | `production` |

### Database (Docker Compose only)

| Variable            | Description             | Default        |
| ------------------- | ----------------------- | -------------- |
| `POSTGRES_USER`     | Database username       | `assettracker` |
| `POSTGRES_PASSWORD` | Database password       | `assettracker` |
| `POSTGRES_DB`       | Database name           | `assettracker` |
| `DB_PORT`           | Exposed PostgreSQL port | `5432`         |
| `APP_PORT`          | Exposed app port        | `3000`         |

### Optional — SSL

| Variable       | Description                       | Default                         |
| -------------- | --------------------------------- | ------------------------------- |
| `DATABASE_SSL` | Force SSL for database connection | Auto-detected for Supabase/Neon |

### Optional — Email

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `EMAIL_PROVIDER`        | `brevo`, `sendgrid`, `mailgun`, `postmark`, or `ses` |
| `EMAIL_FROM`            | Sender email address                                 |
| `EMAIL_FROM_NAME`       | Sender display name                                  |
| `BREVO_API_KEY`         | Brevo API key (if using Brevo)                       |
| `SENDGRID_API_KEY`      | SendGrid API key (if using SendGrid)                 |
| `MAILGUN_API_KEY`       | Mailgun API key (if using Mailgun)                   |
| `MAILGUN_DOMAIN`        | Mailgun domain (e.g. `mg.example.com`)               |
| `POSTMARK_API_KEY`      | Postmark API key (if using Postmark)                 |
| `AWS_ACCESS_KEY_ID`     | AWS key (if using SES)                               |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (if using SES)                            |
| `AWS_REGION`            | AWS region (if using SES)                            |

### Optional — Integrations

| Variable                                                   | Description                                   |
| ---------------------------------------------------------- | --------------------------------------------- |
| `FRESHDESK_DOMAIN`                                         | Freshdesk subdomain                           |
| `FRESHDESK_API_KEY`                                        | Freshdesk API key                             |
| `UPSTASH_REDIS_REST_URL`                                   | Upstash Redis URL (distributed rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN`                                 | Upstash Redis token                           |
| `STORAGE_PROVIDER`                                         | `local` or `s3`                               |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | S3-compatible storage                         |

### Optional — Monitoring

| Variable            | Description                                     |
| ------------------- | ----------------------------------------------- |
| `SENTRY_DSN`        | Sentry DSN for error tracking                   |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (build-time, for source maps) |

### Feature Flags

All enabled by default unless noted. Set to `false` to disable.

| Variable                      | Default | Description                         |
| ----------------------------- | ------- | ----------------------------------- |
| `FEATURE_RATE_LIMITING`       | `true`  | API rate limiting                   |
| `FEATURE_ACCOUNT_LOCKOUT`     | `true`  | Lock after 5 failed logins (15 min) |
| `FEATURE_SESSION_TIMEOUT`     | `true`  | 30 min inactivity timeout           |
| `FEATURE_AUDIT_LOGGING`       | `true`  | Security event logging              |
| `FEATURE_EMAIL_NOTIFICATIONS` | `false` | Requires email provider             |
| `FEATURE_ADVANCED_SEARCH`     | `true`  | Advanced search features            |
| `MAINTENANCE_MODE`            | `false` | Show maintenance page               |

---

## Option A: VPS with Docker (Recommended)

### Step 1 — Server setup

```bash
# SSH into your VPS
ssh root@your-server-ip

# Install Docker (Ubuntu/Debian)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in for the docker group to take effect
exit
ssh root@your-server-ip
```

### Step 2 — Clone and configure

```bash
git clone https://github.com/YOUR_ORG/assettTracker.git
cd assettTracker

cp .env.example .env
nano .env
```

Set the required variables:

```env
# Database (Docker Compose built-in PostgreSQL)
DATABASE_URL=postgresql://assettracker:CHANGE_ME_STRONG_PASSWORD@db:5432/assettracker
POSTGRES_USER=assettracker
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=assettracker

# Auth
BETTER_AUTH_URL=https://assets.yourclient.com
BETTER_AUTH_SECRET=<openssl rand -base64 32>

# Security
ENCRYPTION_KEY=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 16>

# Self-hosted mode
SELF_HOSTED=true
```

### Step 3 — Build and start

```bash
# With bundled PostgreSQL (recommended for single-server setups)
docker compose --profile with-db up -d --build

# Wait for the database to be ready
docker compose logs -f db
# Wait until you see "database system is ready to accept connections", then Ctrl+C
```

**Using an external database instead?** (Supabase, Neon, managed Postgres)

```bash
# Set DATABASE_URL in .env to your external connection string, then:
docker compose --profile app-only up -d --build
```

### Step 4 — Initialize the database

```bash
# Apply all migrations
docker compose exec app npx prisma migrate deploy

# Create the first admin user (interactive)
docker compose exec app node scripts/create-admin.mjs
```

You will be prompted for: email, first name, last name, username, password (min 12 chars), and organization name.

### Step 5 — Verify

```bash
# Check the app is running
docker compose ps
docker compose logs app --tail 20

# Test HTTP (before SSL)
curl -I http://localhost:3000
```

Open `http://your-server-ip:3000` in a browser. You should see the login page.

### Step 6 — Set up SSL (see [Reverse Proxy & SSL](#reverse-proxy--ssl) below)

---

## Option B: Vercel (Managed)

### Step 1 — Database

Create a PostgreSQL database with one of:

| Provider                         | Free Tier | Best For                        |
| -------------------------------- | --------- | ------------------------------- |
| [Supabase](https://supabase.com) | 500 MB    | General use, built-in dashboard |
| [Neon](https://neon.tech)        | 512 MB    | Serverless, auto-scaling        |
| [Railway](https://railway.app)   | $5 credit | Simple setup                    |

**Supabase setup:**

1. Create a project at supabase.com
2. Go to Settings > Database > Connection string > URI
3. Use the **Session mode** pooler URL (port 5432)
4. Save the connection string for the next step

### Step 2 — Import to Vercel

1. Push the repo to GitHub (private repo is fine)
2. Go to [vercel.com](https://vercel.com) > New Project > Import from GitHub
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `.` (default)

### Step 3 — Environment variables

In Vercel Project Settings > Environment Variables, add for **Production**:

| Variable             | Value                          |
| -------------------- | ------------------------------ |
| `DATABASE_URL`       | `postgresql://...` from Step 1 |
| `BETTER_AUTH_URL`    | `https://your-domain.com`      |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`      |
| `ENCRYPTION_KEY`     | `openssl rand -hex 32`         |
| `CRON_SECRET`        | `openssl rand -hex 16`         |
| `SELF_HOSTED`        | `true`                         |

### Step 4 — Deploy

Click **Deploy**. The build runs `next build` automatically.

**Run migrations** (from your local machine, with the production DATABASE_URL):

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." node scripts/create-admin.mjs
```

**Or** automate migrations on every deploy by changing the Vercel build command in Project Settings > General > Build Command:

```
npx prisma migrate deploy && next build
```

### Step 5 — Custom domain

In Vercel Project Settings > Domains:

1. Add your domain (e.g. `assets.yourclient.com`)
2. Add the DNS records Vercel provides (CNAME or A)
3. HTTPS is provisioned automatically

### Step 6 — Configure cron jobs

The `vercel.json` already includes cron jobs. They run automatically once deployed. Vercel sends `CRON_SECRET` as the Bearer token.

Current schedule:
| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/demo-reset` | Daily 00:00 UTC | Demo data reset (only if `DEMO_MODE=true`) |
| `/api/cron/sessions` | Daily 01:00 UTC | Expired session cleanup |
| `/api/cron/notifications` | Daily 02:00 UTC | Email notifications (license expiry, low stock) |
| `/api/cron/workflows` | Daily 03:00 UTC | Automation rule execution |
| `/api/cron/gdpr-retention` | Daily 04:00 UTC | GDPR data retention enforcement |
| `/api/cron/ldap-sync` | Daily 05:00 UTC | LDAP user synchronization |

---

## Option C: Bare-Metal / PM2

For servers without Docker. Requires Node.js 20 and PostgreSQL installed directly.

### Step 1 — Install dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install PostgreSQL 16
sudo apt install -y postgresql-16
```

### Step 2 — Set up PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER assettracker WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE assettracker OWNER assettracker;
GRANT ALL PRIVILEGES ON DATABASE assettracker TO assettracker;
\q
```

### Step 3 — Build the app

```bash
git clone https://github.com/YOUR_ORG/assettTracker.git
cd assettTracker

cp .env.example .env
nano .env
# Set DATABASE_URL=postgresql://assettracker:STRONG_PASSWORD@localhost:5432/assettracker
# Set all other required env vars

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
node scripts/create-admin.mjs
```

### Step 4 — Run with PM2

```bash
pm2 start npm --name "assettracker" -- start
pm2 save
pm2 startup  # follow the printed command to enable on boot
```

### Step 5 — Set up cron jobs

```bash
crontab -e
```

```cron
0 0 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/sessions
0 2 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/notifications
0 3 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/workflows
0 4 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/gdpr-retention
0 5 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/ldap-sync
```

---

## Reverse Proxy & SSL

### Caddy (Recommended — automatic HTTPS)

```bash
sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```
assets.yourclient.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Caddy automatically provisions and renews Let's Encrypt certificates. DNS A record must point to the server IP.

### Nginx (Alternative)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/assettracker`:

```nginx
server {
    server_name assets.yourclient.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for large file uploads
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50m;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/assettracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d assets.yourclient.com
```

---

## Cron Jobs

Asset Tracker includes 6 automated jobs. On Vercel they run automatically via `vercel.json`. On VPS/bare-metal, set up system cron:

```bash
crontab -e
```

```cron
# Session cleanup — daily at 1 AM
0 1 * * * curl -sf -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/sessions > /dev/null

# Email notifications — daily at 2 AM
0 2 * * * curl -sf -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/notifications > /dev/null

# Workflow automation — daily at 3 AM
0 3 * * * curl -sf -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/workflows > /dev/null

# GDPR retention — daily at 4 AM
0 4 * * * curl -sf -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/gdpr-retention > /dev/null

# LDAP sync — daily at 5 AM
0 5 * * * curl -sf -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/ldap-sync > /dev/null
```

**Verifying cron jobs work:**

```bash
# Test manually
curl -v -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/sessions
```

---

## File Storage

### Local storage (default)

Files are stored in `./uploads/` on disk. For Docker, add a volume:

```yaml
# In docker-compose.yml, under the app service:
volumes:
  - uploads_data:/app/uploads
```

### S3-compatible storage

Set in `.env`:

```env
STORAGE_PROVIDER=s3
S3_BUCKET=assettracker-files
S3_REGION=eu-central-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
```

Works with AWS S3, Cloudflare R2, MinIO, or any S3-compatible service.

---

## Email Configuration

Configure via environment variables **or** the Admin Settings > Email UI.

**Recommended providers:**

| Provider   | Free Tier            | Setup                                              |
| ---------- | -------------------- | -------------------------------------------------- |
| Brevo      | 300/day              | Set `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY`       |
| SendGrid   | 100/day              | Set `EMAIL_PROVIDER=sendgrid` + `SENDGRID_API_KEY` |
| Postmark   | 100/month            | Set `EMAIL_PROVIDER=postmark` + `POSTMARK_API_KEY` |
| Amazon SES | 62k/month (with EC2) | Set `EMAIL_PROVIDER=ses` + AWS credentials         |

Test email delivery from Admin Settings > Email > Send Test Email after configuration.

---

## Monitoring & Logging

### Application logs

```bash
# Docker
docker compose logs app --tail 100 -f

# PM2
pm2 logs assettracker
```

### Sentry (optional)

Set `SENTRY_DSN` in `.env` for automatic error tracking. Source maps are uploaded during build when `SENTRY_AUTH_TOKEN` is set.

### Health check

```bash
curl -f http://localhost:3000/api/health || echo "App is down"
```

---

## Backups

### Database backup

```bash
# Docker — manual backup
docker compose exec -T db pg_dump -U assettracker assettracker > backup_$(date +%Y%m%d).sql

# Docker — compressed backup
docker compose exec -T db pg_dump -U assettracker assettracker | gzip > backup_$(date +%Y%m%d).sql.gz

# Bare-metal
pg_dump -U assettracker assettracker > backup_$(date +%Y%m%d).sql
```

### Automated daily backup (crontab)

```cron
0 2 * * * cd /opt/assettTracker && docker compose exec -T db pg_dump -U assettracker assettracker | gzip > /backups/assettracker_$(date +\%Y\%m\%d).sql.gz

# Retain last 30 days
5 2 * * * find /backups -name "assettracker_*.sql.gz" -mtime +30 -delete
```

### Restore from backup

```bash
# Docker
cat backup_20260306.sql | docker compose exec -T db psql -U assettracker assettracker

# Bare-metal
psql -U assettracker assettracker < backup_20260306.sql
```

---

## Updating

### Docker

```bash
cd /opt/assettTracker
git pull origin master

# Rebuild and restart (zero-downtime with Docker's rolling restart)
docker compose --profile with-db up -d --build

# Apply any new database migrations
docker compose exec app npx prisma migrate deploy
```

### Vercel

Push to the connected branch — Vercel auto-deploys. If using the build command `npx prisma migrate deploy && next build`, migrations apply automatically.

### Bare-metal / PM2

```bash
cd /opt/assettTracker
git pull origin master
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart assettracker
```

---

## Security Hardening

### Production checklist

- [ ] `NODE_ENV=production` is set
- [ ] All secrets are unique, generated with `openssl rand`
- [ ] `SELF_HOSTED=true` (skips public landing page)
- [ ] HTTPS is enforced via reverse proxy
- [ ] Database is not exposed publicly (port 5432 bound to localhost or Docker internal network)
- [ ] Firewall allows only ports 80, 443, and SSH (22)
- [ ] Docker runs as non-root user (built into the Dockerfile)
- [ ] `CRON_SECRET` is set (protects cron endpoints)
- [ ] Database backups are configured and tested

### Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Database access (Docker)

The Docker Compose file exposes PostgreSQL on the host by default. For production, remove or restrict the port mapping:

```yaml
# In docker-compose.yml, remove or comment out:
# ports:
#   - "${DB_PORT:-5432}:5432"
```

The app container connects to the database over the Docker network — no host port needed.

---

## Troubleshooting

### App won't start

```bash
docker compose logs app --tail 50
docker compose exec app npx prisma migrate status
```

### "relation does not exist" error

Migrations haven't been applied:

```bash
docker compose exec app npx prisma migrate deploy
```

### "no matching decryption secret" or session errors

`BETTER_AUTH_SECRET` changed. Users need to clear cookies and log in again.

### Database connection refused

```bash
# Check database is running
docker compose ps db
docker compose logs db --tail 20

# Test connection
docker compose exec db psql -U assettracker -c "SELECT 1"
```

### Build fails with Prisma errors

```bash
# Regenerate the Prisma client
docker compose exec app npx prisma generate
```

### Email not sending

1. Check Admin Settings > Email for configuration status
2. Click "Send Test Email"
3. Check logs: `docker compose logs app | grep -i email`

### Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker build cache
docker system prune -a

# Check database size
docker compose exec db psql -U assettracker -c "SELECT pg_size_pretty(pg_database_size('assettracker'));"
```
