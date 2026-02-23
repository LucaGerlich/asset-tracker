# Asset Tracker — Deployment Guide

Two deployment options: **VPS with Docker** (recommended for client deployments) or **Vercel** (faster setup, managed hosting).

---

## Prerequisites (both options)

### 1. PostgreSQL Database

You need a PostgreSQL 15+ database. Options:

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| [Supabase](https://supabase.com) | 500 MB | Easiest, includes connection pooling |
| [Neon](https://neon.tech) | 512 MB | Serverless Postgres, good for Vercel |
| [Railway](https://railway.app) | $5 credit | Simple setup |
| Self-hosted (VPS) | Unlimited | Included in Docker Compose setup |

### 2. Generate Secrets

Run these locally and save the output — you'll need them for env vars:

```bash
# NEXTAUTH_SECRET — signs JWT tokens
openssl rand -base64 32

# ENCRYPTION_KEY — encrypts sensitive data at rest (API keys, MFA secrets)
openssl rand -hex 32

# CRON_SECRET — protects cron job endpoints
openssl rand -hex 16
```

### 3. Clone the Repository

On your deployment machine (or wherever you're building):

```bash
git clone https://github.com/YOUR_USERNAME/assettTracker.git
cd assettTracker
```

---

## Option A: VPS with Docker (Recommended)

Works on any VPS: Hetzner, DigitalOcean, Contabo, AWS EC2, etc.

### Step 1: Server Setup

SSH into your VPS and install Docker:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

### Step 2: Clone and Configure

```bash
git clone https://github.com/YOUR_USERNAME/assettTracker.git
cd assettTracker

# Create production environment file
cp .env.example .env
```

Edit `.env` with your production values:

```bash
nano .env
```

```env
# Database (using the Docker Compose database)
DATABASE_URL=postgresql://assettracker:STRONG_PASSWORD_HERE@db:5432/assettracker
POSTGRES_USER=assettracker
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_DB=assettracker

# Auth — CRITICAL: set these
NEXTAUTH_URL=https://assets.yourclient.com
NEXTAUTH_SECRET=<output from openssl rand -base64 32>

# Encryption — REQUIRED in production
ENCRYPTION_KEY=<output from openssl rand -hex 32>

# Cron security
CRON_SECRET=<output from openssl rand -hex 16>

# Self-hosted mode (skip SaaS landing page, go straight to login)
SELF_HOSTED=true

# Email (optional — can configure later via Admin Settings UI)
# EMAIL_PROVIDER=brevo
# BREVO_API_KEY=your_key
# EMAIL_FROM=noreply@yourclient.com
# EMAIL_FROM_NAME=Asset Tracker
```

### Step 3: Build and Start

```bash
# Start with bundled PostgreSQL database
docker compose --profile with-db up -d --build

# Wait for database to be healthy (~10 seconds)
docker compose logs -f db  # Ctrl+C when you see "ready to accept connections"
```

### Step 4: Initialize Database

```bash
# Run Prisma migrations to create all tables
docker compose exec app npx prisma migrate deploy

# Create the first admin user (interactive prompt)
docker compose exec app node scripts/create-admin.mjs
```

### Step 5: Reverse Proxy with HTTPS (Caddy)

Install Caddy for automatic HTTPS:

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

Caddy automatically provisions Let's Encrypt certificates. Make sure your DNS A record points to the VPS IP.

### Step 6: Verify

1. Open `https://assets.yourclient.com` — should show login page (SELF_HOSTED=true skips landing)
2. Log in with the admin credentials you created
3. Go to Admin Settings > Email to configure email if needed
4. Go to Admin Settings > General to set company name, etc.

### Optional: Using an External Database

If using Supabase/Neon instead of Docker Postgres:

```bash
# Start app only (no bundled database)
docker compose --profile app-only up -d --build
```

Set `DATABASE_URL` to your external database connection string in `.env`.

### Updating

```bash
cd assettTracker
git pull
docker compose --profile with-db up -d --build
docker compose exec app npx prisma migrate deploy
```

---

## Option B: Vercel

### Step 1: Create Vercel Account

Create a separate Vercel account for the client (or use a Vercel Team). Do NOT deploy from your personal account if the client should own it.

### Step 2: Database

Create a PostgreSQL database (Supabase or Neon recommended for Vercel):

**Supabase:**
1. Go to [supabase.com](https://supabase.com), create a project
2. Go to Settings > Database > Connection string > URI
3. Copy the connection string (use the "Transaction" pooler URL for Vercel)

### Step 3: Connect Repository

1. Fork the repo to a GitHub account the client's Vercel can access (or add it as a private repo connection)
2. In Vercel: New Project > Import from GitHub > select the repo
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `.` (default)

### Step 4: Environment Variables

In Vercel Project Settings > Environment Variables, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` (from Supabase/Neon) | Production |
| `NEXTAUTH_URL` | `https://assets.yourclient.com` | Production |
| `NEXTAUTH_SECRET` | `<openssl rand -base64 32>` | Production |
| `ENCRYPTION_KEY` | `<openssl rand -hex 32>` | Production |
| `CRON_SECRET` | `<openssl rand -hex 16>` | Production |
| `SELF_HOSTED` | `true` | Production |

Optional email vars:
| Variable | Value | Environment |
|----------|-------|-------------|
| `EMAIL_PROVIDER` | `brevo` | Production |
| `BREVO_API_KEY` | `your_key` | Production |
| `EMAIL_FROM` | `noreply@yourclient.com` | Production |
| `EMAIL_FROM_NAME` | `Asset Tracker` | Production |

### Step 5: Deploy

Click "Deploy". After the first deployment:

```bash
# Run migrations against the production database (from your local machine)
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Create admin user
DATABASE_URL="postgresql://..." node scripts/create-admin.mjs
```

Or use Vercel's build command override to run migrations automatically. In Vercel Settings > General > Build Command:

```
npx prisma migrate deploy && next build
```

### Step 6: Custom Domain

In Vercel Project Settings > Domains:
1. Add `assets.yourclient.com`
2. Add the DNS records Vercel shows you (CNAME or A record)
3. HTTPS is automatic

### Step 7: Cron Jobs (Optional)

For automated notifications (license expiry, maintenance due, low stock alerts), add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/sessions",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/workflows",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Vercel Cron automatically sends the `CRON_SECRET` as the Bearer token.

**For VPS**, use system cron:

```bash
crontab -e
```

```
# Daily notifications at 9 AM
0 9 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/notifications

# Clean expired sessions every 6 hours
0 */6 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/sessions

# Process workflows every 15 minutes
*/15 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://assets.yourclient.com/api/cron/workflows
```

---

## Post-Deployment Checklist

- [ ] Can access the app at the custom domain with HTTPS
- [ ] Can log in with admin credentials
- [ ] Admin Settings > General — set company name and defaults
- [ ] Admin Settings > Email — configure or verify email provider
- [ ] Send a test email from Admin Settings > Email
- [ ] Create initial asset categories, locations, status types
- [ ] Create additional user accounts as needed
- [ ] Verify cron jobs are running (check audit logs after 24h)
- [ ] Take a database backup

## Backups (VPS)

```bash
# Manual backup
docker compose exec db pg_dump -U assettracker assettracker > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * cd /path/to/assettTracker && docker compose exec -T db pg_dump -U assettracker assettracker | gzip > /backups/assettracker_$(date +\%Y\%m\%d).sql.gz
```

## Troubleshooting

**App won't start:**
```bash
docker compose logs app          # Check app logs
docker compose logs db           # Check database logs
docker compose exec app npx prisma migrate status  # Check migration state
```

**"no matching decryption secret" error:**
The `NEXTAUTH_SECRET` changed. Users need to clear cookies / log in again.

**Email not sending:**
Check Admin Settings > Email for env config status. Send a test email. Check logs:
```bash
docker compose logs app | grep "email"
```
