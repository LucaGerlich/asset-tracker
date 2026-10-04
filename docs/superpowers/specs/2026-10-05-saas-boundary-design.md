# SaaS Boundary in Core: Design

- **Date:** 2026-10-05
- **Status:** Approved in brainstorming, pending written-spec review
- **Sub-project:** 1 of 5 (see "Programme context")

## Goal

Make the public, FSL-licensed core free of any billing, plan, trial or Stripe
knowledge, so that:

- self-hosters get every feature with no flag to set, and
- the hosted SaaS is driven by a separate, private **control plane** that
  decides what each organisation may do and tells the core through a narrow,
  authenticated interface.

## Programme context

The user wants to turn the project into a real SaaS with four goals: hide
business code, have room for SaaS-only tooling, separate the marketing site,
and run the SaaS on its own infrastructure. That work is split into five
sub-projects, each with its own spec, plan and implementation:

| #   | Sub-project                                              | Depends on               |
| --- | -------------------------------------------------------- | ------------------------ |
| 1   | **SaaS boundary in core** (this spec)                    | none                     |
| 2   | Private control-plane repo (billing, trials, Stripe)     | 1                        |
| 3   | Marketing site in its own repo and deployment            | can run alongside 1      |
| 4   | SaaS infrastructure (Hetzner, own DB, off the shared DB) | 2 for the final cut-over |
| 5   | SaaS-only tooling (operator console, metering, support)  | 2                        |

Chosen integration approach: **a separate control-plane service, with the
boundary at the data and an internal API**. Overlay builds (core as a
submodule with build-time module swapping) and a private fork were rejected:
the first fights the Next.js App Router and breaks on core upgrades, the
second means permanent merge conflicts.

## Current state

SaaS logic is spread through the core:

| Concern        | Location                                                                                                                | Call sites                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Feature gating | `isPlanFeatureEnabled` (`src/lib/plan-features.ts`), `requirePlanFeature` (`src/lib/api-auth.ts`), `PlanGate` component | SSO and LDAP settings, API keys, about 10 procurement routes, `BillingTab` |
| Usage limits   | `checkAssetLimit` / `checkUserLimit` (`src/lib/tenant-limits.ts`)                                                       | asset create (2), user add, team invite, import, SCIM users                |
| Org status     | `getOrgSuspensionStatus` (`src/lib/org-suspension.ts`), `/suspended` page                                               | `api-auth.ts`, `proxy.ts`                                                  |
| Signup         | trial assignment in `src/app/api/auth/register/route.ts`                                                                | 1                                                                          |
| Org creation   | `prisma.organization.create`                                                                                            | `auth/register`, `organizations`, `setup`                                  |
| Billing        | `src/lib/stripe.ts`, `src/app/api/billing/{checkout,portal,usage,webhook}`, `api/cron/check-trials`, `BillingTab`       | standalone                                                                 |
| Mode switch    | `isSelfHosted()` (`src/lib/deployment-mode.ts`), `SELF_HOSTED` in env validation and admin settings                     | 9 files                                                                    |

`Organization` carries `plan`, `stripeCustomerId`, `stripeSubscriptionId`,
`trialEndsAt`, `maxAssets` (default 100), `maxUsers` (default 3), `isActive`
and `suspendedAt`. Self-hosted orgs created through `/setup` get the same
defaults as free SaaS orgs, so **the data alone cannot tell a self-hosted org
from a free SaaS org**. This drives the resolution rule below.

## Design

### 1. Entitlements

One concept replaces plans, trials and Stripe IDs in the core.

```ts
// src/lib/entitlements.ts (public core)
export const GATED_FEATURES = [
  "sso",
  "ldap",
  "scim",
  "advanced_reports",
  "workflow_automation",
  "custom_fields",
  "api_keys",
  "procurement",
  "tco_dashboard",
  "white_label",
] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];

export type Entitlements = {
  features: GatedFeature[];
  maxAssets: number | null; // null = unlimited
  maxUsers: number | null; // null = unlimited
};
```

- New column `Organization.entitlements Json?`. Every read and write is
  validated with a zod schema (`entitlementsSchema`). An invalid stored value
  is logged and treated as the cloud default (never as unrestricted).
- Feature names are neutral capability names. Plan names and prices do not
  appear in the core.
- A JSON column instead of a table: there is one record per org, it is always
  read whole and has no relations. Move it to a table if per-feature expiry or
  history is ever needed.

**Resolution rule (the single source of truth):**

```ts
effectiveEntitlements(org) =
  org.entitlements ?? // set by the control plane
  (isControlPlaneEnabled()
    ? NEW_ORG_ENTITLEMENTS // cloud: restrictive default
    : UNRESTRICTED); // self-hosted: everything
```

- `isControlPlaneEnabled()` is true when `CONTROL_PLANE_SECRET` is set. It
  replaces `isSelfHosted()`. Self-hosters set nothing.
- Because `NULL` never means "unrestricted" in the cloud, a missed provisioning
  step can only make an org too restricted, never free and unlimited.

**Core API (replaces the current functions):**

| New                                                                      | Replaces                        |
| ------------------------------------------------------------------------ | ------------------------------- |
| `getEffectiveEntitlements(orgId)` (cached per org, invalidated on write) | `getOrgPlan`, `getPlanFeatures` |
| `hasFeature(orgId, feature)`                                             | `isPlanFeatureEnabled`          |
| `requireFeature(user, feature)` in `api-auth.ts`                         | `requirePlanFeature`            |
| `checkAssetLimit()` / `checkUserLimit()` reading entitlements            | same names, new source          |
| `<FeatureGate feature>`                                                  | `<PlanGate>`                    |

`FeatureGate` shows "Not available for your organization" and, when
`BILLING_URL` is set, a "Manage billing" action (see 4). It shows no plan names
or prices.

### 2. Organisation creation

All three creation paths (`auth/register`, `organizations`, `setup`) call one
helper, `createOrganization(tx, data)` in `src/lib/organizations.ts`, which:

1. creates the org with `entitlements = NEW_ORG_ENTITLEMENTS` when the control
   plane is enabled, otherwise `NULL`;
2. after the transaction commits, emits `org.created` (see 3.2).

Trials become a control-plane concern. Until phase 3 the legacy trial path in
`register` stays (see "Rollout").

### 3. Control plane and core interface

The control plane has its own database (customers, subscriptions, Stripe IDs)
and never touches core tables.

**Why not a shared database:** raw writes would bypass zod validation, the
audit log and the core's org cache (stale entitlements are a real risk, given
earlier cache-invalidation bugs). They would also tie the control plane to the
core's Prisma schema and give it read access to all tenant data.

#### 3.1 Internal API (control plane to core)

| Method and path                           | Body / response                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUT /api/internal/orgs/:id/entitlements` | body: `Entitlements`. Response: the stored value                                                                                                                                                                               |
| `POST /api/internal/orgs/:id/status`      | body: `{ action: 'suspend' \| 'reactivate' \| 'lock' }`. `suspend` sets `suspendedAt = now()` (14-day read-only grace, as today). `reactivate` clears `suspendedAt` and sets `isActive = true`. `lock` sets `isActive = false` |
| `GET /api/internal/orgs/:id`              | `{ id, name, slug, createdAt, isActive, suspendedAt, entitlements, usage: { assets, users } }`                                                                                                                                 |
| `GET /api/internal/orgs?cursor=&limit=`   | paginated list of the same shape, `limit` at most 100                                                                                                                                                                          |

- **Auth:** `Authorization: Bearer <CONTROL_PLANE_SECRET>`, compared with
  `crypto.timingSafeEqual`. Missing or wrong header: 401. Rate-limited with the
  existing limiter.
- **When `CONTROL_PLANE_SECRET` is unset, every `/api/internal/*` route returns 404.**
- `:id` is validated as a UUID. An unknown org returns 404.
- Every write invalidates the org's entitlement and status cache and writes an
  audit-log entry with actor `control-plane`.
- `proxy.ts` treats `/api/internal/*` as a non-session route. It authenticates
  only by bearer secret and never by cookie.

#### 3.2 Events (core to control plane)

- Event `org.created` with payload `{ id, name, slug, createdAt, adminEmail }`.
- Sent as a POST to `CONTROL_PLANE_WEBHOOK_URL` with headers
  `X-Signature: sha256=<hmac(secret, timestamp + '.' + body)>` and
  `X-Timestamp`. The receiver rejects anything older than 5 minutes. Signing
  reuses the helpers in `src/lib/webhooks.ts` where they fit.
- Delivery is retried 3 times with backoff, after the transaction commits.
  Failure is logged and never fails the user's signup.
- Missed events are recovered by the control plane's nightly reconcile through
  `GET /api/internal/orgs` (part of sub-project 2).

#### 3.3 Billing handoff (user to control plane)

- `POST /api/billing/handoff` (org admins only) creates a token
  `{ orgId, userId, email, role, jti, exp: now + 60s }`, signed with HMAC-SHA256
  using `CONTROL_PLANE_SECRET`.
- The core answers with an auto-submitting HTML form that POSTs the token to
  `BILLING_URL/handoff`. The token never appears in a URL, so it cannot leak
  through logs or the Referer header. The response gets a CSP nonce like every
  other page.
- The control plane verifies the signature and expiry, rejects a reused `jti`,
  accepts only admins, and then opens its own session (sub-project 2).
- From phase 3 on, the admin settings "Billing" tab is shown only when
  `BILLING_URL` is set and contains only the "Manage billing" action. Until
  then the existing `BillingTab` stays (see "Rollout").

### 4. Configuration

| Var                         | Required           | Meaning                                                             |
| --------------------------- | ------------------ | ------------------------------------------------------------------- |
| `CONTROL_PLANE_SECRET`      | no                 | 32+ chars. Enables cloud mode, the internal API and handoff signing |
| `CONTROL_PLANE_WEBHOOK_URL` | when secret is set | HTTPS URL for events                                                |
| `NEW_ORG_ENTITLEMENTS`      | when secret is set | JSON `Entitlements`, validated at startup                           |
| `BILLING_URL`               | when secret is set | HTTPS base URL of the control plane's billing UI                    |

Env validation is fatal (the app refuses to start) when `CONTROL_PLANE_SECRET`
is set and any dependent var is missing or invalid, or when the secret is
shorter than 32 characters. `SELF_HOSTED`, `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` are removed in phase 3. Until then they keep working.

### 5. Rollout

Production has live orgs with plans, Stripe IDs and trials. Nothing may be
lost and no paying org may be downgraded, even briefly.

**Phase 1a: additive core release**

- Migration adds `entitlements Json?` (NULL for all orgs). No code reads it yet.
- Ships `scripts/backfill-entitlements.ts`, run manually against the **SaaS
  database only** after deploy. It writes `entitlements` from `plan`,
  `maxAssets` and `maxUsers` (`-1` becomes `null`), using the feature lists in
  today's `plan-features-shared.ts`. It is idempotent: it only touches orgs
  whose `entitlements` is NULL. Self-hosted databases never run it.

**Phase 1b: switch release**

- All checks read `getEffectiveEntitlements`. The internal API, events,
  handoff, `createOrganization` and `FeatureGate` ship.
- The legacy billing path stays in place so live subscriptions and trials are
  untouched: the Stripe routes, `BillingTab`, the `check-trials` cron and the
  trial assignment in `register`. Every legacy write of `plan` (Stripe
  webhook, `check-trials`, `register`) also writes `entitlements` through one
  temporary helper, `legacyPlanToEntitlements(plan, maxAssets, maxUsers)`,
  which the backfill script uses too. The helper is deleted in phase 3.
- Production sets `CONTROL_PLANE_SECRET` and the dependent vars. Until the
  control plane exists, `CONTROL_PLANE_WEBHOOK_URL` and `BILLING_URL` may point
  at a stub, and events that fail are reconciled later.

**Phase 2: control plane goes live (sub-project 2, separate spec)**

- One-off import of orgs plus Stripe customer and subscription IDs.
- The Stripe webhook endpoint is switched to the control plane in the Stripe
  dashboard.

**Phase 3: cleanup core release, only after phase 2 is confirmed working**

- Delete `legacyPlanToEntitlements`, the trial assignment in `register`,
  `lib/stripe.ts`, `/api/billing/{checkout,portal,usage,webhook}`,
  `api/cron/check-trials` (and its `vercel.json` entry), `BillingTab`,
  `deployment-mode.ts`, `plan-features.ts`, `plan-features-shared.ts`, and the
  `stripe` dependency.
- Migration drops `plan`, `stripeCustomerId`, `stripeSubscriptionId`,
  `trialEndsAt`, `maxAssets` and `maxUsers`.
- Rollback before phase 3 is a plain redeploy, because no data is dropped
  until then.

**Prerequisite for every phase:** these migrations run against the production
database, which is currently shared with other applications (see
`TECHNICAL_DEBT.md` item 8a). Use `migrate deploy` only. Never `db push` or
`migrate reset`.

## Error handling

- An invalid `entitlements` JSON in the DB: log at error level with the org ID,
  fall back to `NEW_ORG_ENTITLEMENTS` (cloud) or `UNRESTRICTED` (self-hosted).
  Never crash the request.
- Internal API: zod errors return 400 with field paths. No stack traces or
  internal identifiers in responses.
- Event delivery failure is logged with org ID and attempt count and does not
  surface to the user.
- An expired, reused or tampered handoff token is rejected by the control
  plane. The core only creates tokens and never accepts them.

## Testing

TDD, with unit tests written first:

- Resolution rule: stored value, NULL in cloud mode, NULL in self-hosted mode,
  invalid JSON, empty features, null limits, limit reached.
- `hasFeature`, `requireFeature`, `checkAssetLimit`, `checkUserLimit` in both
  modes.
- Internal API auth: secret unset returns 404, missing or wrong bearer returns
  401, valid returns 200, constant-time comparison is used, UUID validation,
  unknown org returns 404.
- Internal API writes invalidate the cache and write the audit log.
- Event signing: signature format and timestamp. Retry on failure; signup still
  succeeds.
- Handoff: only admins, 60-second expiry, unique `jti`, signature verifies with
  the shared secret, token not present in any URL.
- Env validation: each dependent var missing or invalid is fatal when the
  secret is set; nothing is required when it is not.
- `createOrganization`: used by all three paths, sets entitlements per mode,
  emits the event after commit.
- `legacyPlanToEntitlements` and the backfill script against a fresh
  Postgres: plan to entitlements mapping, `-1` to `null`, idempotent. Stripe
  webhook, `check-trials` and `register` write both `plan` and `entitlements`
  in phase 1b.
- E2E: a self-hosted build (no secret) shows no billing tab and gates no
  feature.

## Out of scope

- The control plane itself, its database, Stripe checkout, trials, reconcile
  and operator console (sub-projects 2 and 5).
- Moving the marketing site and pricing page (sub-project 3). Until then the
  pricing page in the core keeps its current content.
- Infrastructure changes (sub-project 4).
- IP allowlists, mutual TLS, a message queue, and single sign-on from the
  control plane back into the app. A shared secret over HTTPS, plus nightly
  reconcile, is enough at current scale.
