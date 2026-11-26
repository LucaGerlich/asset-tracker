# Environments

The hosted instances of this repository, which branch feeds each one, and which database
each one uses.

| Environment | Vercel project      | Branch        | URL                                        | Database                                    |
| ----------- | ------------------- | ------------- | ------------------------------------------ | ------------------------------------------- |
| Dev         | `asset-tracker-dev` | `development` | https://asset-tracker-dev-seven.vercel.app | `asset_dev` (own login `asset_dev`)         |
| Demo        | `assett-tracker`    | `master`      | https://assett-tracker.vercel.app          | `postgres`, schema `public` (shared server) |
| Production  | not set up yet      | `master`      | n/a                                        | `asset_prod` (planned)                      |

All of them live on the Vercel team `lucagerlichs-projects`. The databases run on the
Hetzner PostgreSQL server.

## Release flow

1. Feature and fix branches open pull requests into `development`.
2. Merging into `development` deploys **Dev** and migrates `asset_dev`.
3. A release pull request `development` → `master` deploys **Demo** (later **Production**)
   and migrates its database.

## Migrations

- `vercel.json` runs `prisma migrate deploy` only when `VERCEL_ENV=production`, which is a
  project's production branch. Preview deployments never migrate.
- Rehearse a release's migrations on a copy of the target database before merging into
  `master`: restore a `pg_dump` into a local Postgres of the same major version, run
  `migrate deploy` there, and check the result.
- Never run `npm run build` or `bun run build` locally. Both run `prisma migrate deploy`
  against whatever `DATABASE_URL` your `.env` points at. Use `npx next build` instead.

## Environment variables

Each project has its own secrets (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`).
Never copy them between environments. `ENCRYPTION_KEY` in particular protects stored
credentials and must stay the same for the lifetime of a database.

Dev runs with `SELF_HOSTED=true` and has no email, Stripe or SSO configuration, so it cannot
send real mail or touch billing. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the
project's own domain, or sign-in fails.

## Test data

Dev and Demo hold three demo tenants created by `prisma/demo-seed.js` (see the README
section "Demo data"). Re-running the seed replaces only those tenants:

```bash
DEMO_SEED_CONFIRM=yes DATABASE_URL=<target> node prisma/demo-seed.js
```
