# Demo Hosting Guide - Supabase Setup

This guide explains how to host a public demo version of the Asset Tracker application using Supabase as the database backend. The demo resets automatically every 30 minutes to provide a fresh state for new visitors.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Supabase Setup](#supabase-setup)
- [Environment Configuration](#environment-configuration)
- [Deployment Options](#deployment-options)
- [Automated Reset (30-minute cycle)](#automated-reset-30-minute-cycle)
- [Security Considerations](#security-considerations)
- [Demo Credentials](#demo-credentials)
- [Troubleshooting](#troubleshooting)

## Overview

The demo deployment provides:

- **Full application functionality** - Users can explore all features
- **Pre-populated sample data** - Realistic test data showcasing assets, users, locations, etc.
- **Automatic resets** - Database refreshes every 30 minutes
- **Demo accounts** - Pre-configured admin and user accounts
- **Secure isolation** - Demo data is separate from production systems

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Demo Frontend     │────▶│   Supabase Database  │
│  (Vercel/Railway)   │     │    (PostgreSQL)      │
└─────────────────────┘     └──────────────────────┘
         │                            │
         │                            │
         ▼                            ▼
┌─────────────────────┐     ┌──────────────────────┐
│  Cron Job Service   │────▶│   Reset Script       │
│  (cron-job.org/etc) │     │   (Every 30 min)     │
└─────────────────────┘     └──────────────────────┘
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and create an account
2. Click "New Project"
3. Choose your organization or create one
4. Set:
   - **Project name**: `assettracker-demo`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project" and wait for setup

### 2. Get Connection Strings

Navigate to **Project Settings** → **Database** and note:

- **Connection string (URI)**: For direct connections
- **Connection pooling string**: For serverless deployments (recommended for Vercel)

The connection string format:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 3. Initialize Database Schema

Run Prisma migrations against your Supabase database:

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Push the schema
npx prisma db push

# Seed with demo data
npm run db:demo-seed
```

## Environment Configuration

Create environment variables for your demo deployment:

```bash
# Database - Supabase connection (use pooler for serverless)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Enable SSL for cloud databases (auto-detected for Supabase URLs)
DATABASE_SSL="true"

# NextAuth configuration
NEXTAUTH_URL="https://your-demo-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Demo mode indicator (shows banner in UI)
DEMO_MODE="true"

# Node environment
NODE_ENV="production"
```

### Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

## Deployment Options

### Option 1: Vercel (Recommended)

1. Fork or import the repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

**Important for Vercel**: Use the Supabase **connection pooler** URL with `?pgbouncer=true` parameter for serverless compatibility.

```bash
# Vercel environment variables
DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DATABASE_SSL="true"
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="your-secret"
DEMO_MODE="true"
```

### Option 2: Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables
4. Deploy

### Option 3: Docker with External Database

```bash
# Build the image
docker build -t assettracker-demo .

# Run with Supabase connection
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  -e DATABASE_SSL="true" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e DEMO_MODE="true" \
  assettracker-demo
```

## Automated Reset (30-minute cycle)

The demo database resets every 30 minutes to provide a clean slate for new visitors.

### Option 1: Using cron-job.org (Free)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job
3. Configure:
   - **URL**: Your reset endpoint or script URL
   - **Schedule**: Every 30 minutes (`*/30 * * * *`)

### Option 2: GitHub Actions

Create `.github/workflows/demo-reset.yml`:

```yaml
name: Reset Demo Database

on:
  schedule:
    # Every 30 minutes
    - cron: '*/30 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Prisma Client
        run: npx prisma generate
      
      - name: Reset Demo Database
        run: node scripts/reset-demo-db.mjs
        env:
          DATABASE_URL: ${{ secrets.DEMO_DATABASE_URL }}
          DATABASE_SSL: 'true'
```

Add `DEMO_DATABASE_URL` secret in your repository settings.

### Option 3: Railway/Render Cron

Both Railway and Render support cron jobs. Create a separate service that runs:

```bash
node scripts/reset-demo-db.mjs
```

With schedule: `*/30 * * * *`

### Option 4: Vercel Cron (Vercel Pro)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reset-demo",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Create `src/app/api/cron/reset-demo/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await execAsync('node scripts/reset-demo-db.mjs');
    return NextResponse.json({ 
      success: true, 
      message: 'Demo database reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Reset failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Reset failed' 
    }, { status: 500 });
  }
}
```

## Security Considerations

### 1. Demo Account Limitations

Demo accounts have pre-defined credentials that are publicly known:
- **demo_admin** / **demo123** - Admin access
- **demo_user** / **demo123** - Standard user access

**Important**: The demo environment is isolated. Never connect demo systems to production data.

### 2. Data Protection

- All demo data is fake/generated
- Database resets every 30 minutes
- No real user data is stored
- Sessions are cleared on reset

### 3. Rate Limiting

Consider implementing rate limiting to prevent abuse:

```typescript
// In middleware or API routes
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});
```

### 4. Demo Banner

When `DEMO_MODE=true`, a banner is displayed informing users this is a demo environment.

### 5. Preventing Data Exfiltration

- Disable export features in demo mode if sensitive
- Monitor for unusual data access patterns

## Demo Credentials

| Account Type | Username     | Password  | Permissions |
|--------------|--------------|-----------|-------------|
| Admin        | demo_admin   | demo123   | Full access |
| User         | demo_user    | demo123   | Standard access |

Additional sample users (password: `password123`):
- alice
- bob  
- charlie

## NPM Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "db:demo-seed": "node prisma/demo-seed.js",
    "db:demo-reset": "node scripts/reset-demo-db.mjs"
  }
}
```

## Troubleshooting

### Connection Issues

**Error**: `SSL/TLS required`
- Ensure `DATABASE_SSL=true` is set
- For Supabase, SSL is automatically enabled when the URL contains "supabase"

**Error**: `Connection refused`
- Verify the connection string is correct
- Check if using pooler URL for serverless deployments
- Ensure your IP is not blocked by Supabase

### Reset Script Failures

**Error**: `Foreign key constraint violation`
- The reset script deletes data in the correct order
- If issues persist, check for new tables with foreign keys

**Error**: `Timeout during reset`
- Supabase free tier has connection limits
- Ensure only one reset process runs at a time

### Deployment Issues

**Vercel**: 
- Use connection pooler URL (`pooler.supabase.com`)
- Add `?pgbouncer=true` to connection string

**Railway/Docker**:
- Direct connections work fine
- Ensure container can reach Supabase (no firewall blocks)

## Self-Hosted vs Demo

| Feature | Self-Hosted | Demo (Supabase) |
|---------|-------------|-----------------|
| Database | Your PostgreSQL | Supabase |
| SSL | Optional | Required |
| Data Reset | Never | Every 30 min |
| User Accounts | Custom | Pre-configured |
| Configuration | Full control | Limited |

The same codebase supports both modes. The Prisma connection automatically detects Supabase URLs and enables SSL.

## Cost Estimation

### Supabase (Free Tier)
- 500 MB database
- 2 GB bandwidth
- Sufficient for demo purposes

### Vercel (Free Tier)
- Unlimited deployments
- 100 GB bandwidth
- Serverless functions included

### Total: $0/month for basic demo hosting

For higher traffic, consider:
- Supabase Pro: $25/month
- Vercel Pro: $20/month
