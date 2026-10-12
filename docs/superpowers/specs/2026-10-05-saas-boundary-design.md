# SaaS Boundary in Core: Design

- **Date:** 2026-10-05, revised 2026-10-06 after a multi-agent review
- **Status:** Revised; pending written-spec review
- **Sub-project:** 1 of 5 (see "Programme context")
- **Prerequisite:** Phase 0 security fixes
  (`2026-10-06-phase0-tenant-security-design.md`) are merged and released.

## Goal

Make the public, FSL-licensed core free of any billing, plan, trial or Stripe
knowledge, so that:

- self-hosters get every feature with nothing to configure, and
- the hosted SaaS is driven by a separate, private **control plane** that
  decides what each organisation may do and tells the core through a narrow,
  authenticated interface.

## Programme context

| #   | Sub-project                                                          | Depends on               |
| --- | -------------------------------------------------------------------- | ------------------------ |
| 0   | Phase 0: tenant and security fixes (own spec)                        | none                     |
| 1   | **SaaS boundary in core** (this spec)                                | 0                        |
| 2   | Private control-plane repo (billing, trials, Stripe, reconcile)      | 1                        |
| 3   | Marketing site in its own repo and deployment                        | can run alongside 1      |
| 4   | SaaS infrastructure (Hetzner, own DB, separate Preview DB)           | 2 for the final cut-over |
| 5   | SaaS-only tooling (operator console, metering, support, offboarding) | 2                        |
| 6   | Per-tenant SSO (each customer brings their own IdP)                  | 1                        |

Chosen integration: **a separate control-plane service with its own database
and an internal API into the core.** Overlay builds and a private fork were
rejected (fragile against the App Router; permanent merge conflicts). A shared
database was rejected because raw writes would bypass validation and the audit
log and would couple the control plane to the core's Prisma schema.

Decisions taken during review (2026-10-06):

- SSO and LDAP configuration stays **operator-level** (platform settings that
  only super-admins change). It is not a per-org entitlement. Per-tenant SSO is
  sub-project 6.
- Only features with a real per-org enforcement point are entitlements (see 2).
  `white_label` is dropped (not implemented). `sso` and `ldap` are dropped
  (operator-level).

## 1. Deployment mode

There is exactly one mode switch:

```ts
// src/lib/deployment-mode.ts (rewritten)
export function isCloudMode(): boolean {
  return Boolean(process.env.CONTROL_PLANE_SECRET);
}
```

`SELF_HOSTED` is deprecated: ignored, with a one-time startup warning when set.
Self-hosters set nothing.

**Fail-closed guard.** A SaaS deployment that loses its secret must not run
unrestricted. Phase 1b's cut-over writes `system_settings` key
`deployment.mode = 'cloud'`. In `instrumentation.ts` `register()`, when
`isCloudMode()` is false, the server reads that key once. If it is `'cloud'`,
the server refuses to start. One query per cold start.

Consequences:

- A Preview deployment pointed at the production database without the secret
  refuses to start. Previews need their own database (sub-project 4) or the
  full cloud env before phase 1b.
- A self-hosted database never gets the marker, so self-hosters are unaffected.

## 2. Entitlements

```ts
// src/lib/entitlements-shared.ts (client-safe: no prisma, no server-only)
export const GATED_FEATURES = [
  "api_keys",
  "procurement",
  "scim",
  "advanced_reports",
  "tco_dashboard",
  "custom_fields",
  "workflow_automation",
] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];
export type Entitlements = {
  features: GatedFeature[];
  maxAssets: number | null; // null = unlimited
  maxUsers: number | null;
};
export const entitlementsSchema; // zod 4, strict object, limits int >= 0 | null
export const FEATURE_LABELS: Record<GatedFeature, string>;
```

```ts
// src/lib/entitlements.ts ('server-only')
getEffectiveEntitlements(orgId: string | null): Promise<Entitlements>
hasFeature(orgId: string | null, feature: GatedFeature): Promise<boolean>
requireEntitlement(orgId: string | null, feature: GatedFeature): Promise<void>
checkAssetLimit(orgId: string | null): Promise<LimitResult>
checkUserLimit(orgId: string | null): Promise<LimitResult>
// LimitResult = { allowed: boolean; current: number; max: number | null }
```

Storage: `Organization.entitlements Json?`. "NULL" always means SQL NULL
(`Prisma.DbNull` or omitted), never `Prisma.JsonNull`. Readers treat both as
NULL.

**Resolution rule:**

| Mode        | org.entitlements      | Result                                                                        |
| ----------- | --------------------- | ----------------------------------------------------------------------------- |
| self-hosted | anything (ignored)    | `UNRESTRICTED` (every feature, no limits)                                     |
| self-hosted | org is null           | `UNRESTRICTED`                                                                |
| cloud       | valid stored value    | stored value, with unknown features filtered out and logged                   |
| cloud       | NULL or invalid shape | `NEW_ORG_ENTITLEMENTS`, logged at error level for invalid                     |
| cloud       | org is null           | `NEW_ORG_ENTITLEMENTS` features, and creation of org-scoped records is denied |

- In self-hosted mode stored values are ignored. A database restored from the
  SaaS, or an accidental backfill, can never restrict a self-hoster.
- Read path is lenient (filter unknown features, keep the rest). Write path
  (internal API) is strict: unknown features are a 400.
- No cache. Entitlements are read with the org row by primary key, wrapped in
  React `cache()` for per-request dedupe. This avoids the invalidation bugs a
  cross-request cache would bring back.

**Enforcement matrix.** On revocation, data is kept, configuration reads and
deletes stay open, and use and new configuration are blocked.

| Feature               | Config-time gate                          | Use-time gate                                                                              |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `api_keys`            | `POST /api/admin/api-keys`                | `authenticateWithApiKey` (api-auth.ts)                                                     |
| `procurement`         | all procurement routes (today's 13 files) | same routes; `/procurement` pages hidden                                                   |
| `scim`                | SCIM token creation                       | `authenticateScim` using the token's org; the legacy global token is refused in cloud mode |
| `advanced_reports`    | n/a                                       | `/api/reports/advanced` and its page                                                       |
| `tco_dashboard`       | n/a                                       | `/api/dashboard/tco` and `/tco`                                                            |
| `custom_fields`       | definition create/update                  | writing values; existing values stay readable                                              |
| `workflow_automation` | rule create/update                        | `workflow-engine` skips the org's rules                                                    |

Limits:

- `current` users = users with `isActive = true` in the org; assets = all
  assets in the org (today's semantics).
- A limit lowered below current usage is accepted. Creation is blocked; existing
  records stay. The internal GET reports `overLimit`.
- Every creator calls the check with an explicit org ID: asset create (2
  routes), import, procurement receive, user add, invite create **and**
  accept, SCIM, the SSO provisioning hook, OIDC and SAML callbacks, LDAP sync
  and Intune sync. Syncs skip and log rather than fail the whole run.

**Denials** use Phase 0's typed errors: `EntitlementError`
(`code: 'feature_not_entitled'`, `feature`) and `LimitError`
(`code: 'limit_reached'`, `resource`, `max`). Both map to 403 with
`{ error, code, ... }` via Phase 0's shared error mapper. Messages are neutral
("not available for your organization"); no plan names.

**Client gating.** `FeatureGate` replaces `PlanGate` and `UpgradeRequired`.
Server pages pass `features: GatedFeature[]` and `billingEnabled: boolean`
props. The component imports only `entitlements-shared.ts`.

**Collision cleanup.** Delete the unused `requireFeature`, `withFeatureFlag`,
`featureFlagGuard`, `useFeatureFlag`, `setFeatureFlag`,
`getFeatureFlagsSummary` and `resetFeatureFlags` from `feature-flags.ts`, and
its `selfHosted` flag (replaced by `isCloudMode()`).

## 3. Organisation status

Phase 0 makes status enforcement real: read-only blocks writes, locked-out
blocks API, SSR and sign-in, and tenants can no longer change their own
`isActive`. This spec adds the control plane's own lock.

New column `Organization.lockedAt DateTime?`, written **only** by the internal
API. `getOrgStatus` order of precedence:

1. `lockedAt` set, or `isActive = false` → `locked_out`
2. `suspendedAt` within 14 days → `read_only`
3. `suspendedAt` older → `locked_out`
4. otherwise → `active`

Transitions (all idempotent, applied to the current state):

| Action       | Effect                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| `suspend`    | if active (no `lockedAt`, `suspendedAt` NULL): `suspendedAt = now()`; otherwise no-op  |
| `lock`       | `lockedAt = coalesce(lockedAt, now())`                                                 |
| `reactivate` | `lockedAt = NULL`, `suspendedAt = NULL` (does not touch the operator-owned `isActive`) |

Every response returns the resulting status. The control plane must serialise
writes per org (single writer); the core keeps last-writer-wins.

Locked and read-only admins can still reach `/suspended`, sign out, and the
billing handoff (4.3). `/suspended` shows "Manage billing" when billing is
enabled, otherwise a contact message.

## 4. Control plane and core interface

The control plane addresses the core by its **app origin** (`BETTER_AUTH_URL`),
never the marketing host, and does not follow redirects. The domain split
307-redirects cross-host requests, and clients drop `Authorization` on a
cross-origin redirect.

### 4.1 Keys

`CONTROL_PLANE_SECRET` (32+ random chars) is the inbound bearer credential.
Purpose keys are derived from it with HKDF and never sent anywhere:

```ts
hkdfSync("sha256", secret, "", "asset-tracker/events-v1", 32);
hkdfSync("sha256", secret, "", "asset-tracker/handoff-v1", 32);
```

`CONTROL_PLANE_SECRET_PREVIOUS` (optional) is also accepted as a bearer
during rotation.

### 4.2 Internal API (control plane to core)

Every `/api/internal/*` handler calls `requireControlPlane(request)` first:
404 when not in cloud mode, 401 when the bearer is missing or wrong. It uses
the existing length-safe constant-time helper. `proxy.ts` needs no change
(`/api/*` is not session-gated there). A test walks every internal route file
and asserts the guard is called.

| Method and path                                       | Body                                              | 200 response                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `PUT /api/internal/orgs/:id/entitlements`             | `Entitlements` (strict)                           | `{ org: InternalOrg }`                                                                           |
| `POST /api/internal/orgs/:id/status`                  | `{ action: 'suspend' \| 'lock' \| 'reactivate' }` | `{ org: InternalOrg }`                                                                           |
| `GET /api/internal/orgs/:id`                          | n/a                                               | `{ org: InternalOrg }`                                                                           |
| `GET /api/internal/orgs?createdAfter=&cursor=&limit=` | n/a                                               | `{ orgs: InternalOrg[], nextCursor: string \| null }`, `limit` ≤ 100, ordered by `createdAt, id` |

```ts
type InternalOrg = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: "active" | "read_only" | "locked_out";
  isActive: boolean;
  suspendedAt: string | null;
  lockedAt: string | null;
  entitlements: Entitlements | null; // stored value
  usage: { assets: number; users: number }; // batched groupBy for lists
  overLimit: boolean;
  billingContact: {
    userId: string;
    email: string;
    emailVerified: boolean;
  } | null; // oldest active admin
  legacy?: {
    plan: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    trialEndsAt: string | null;
  }; // until phase 3a
};
```

- Errors: `{ error: string, code: string, issues?: ZodIssue[] }`. 400 on
  validation, 401, 404 (unknown org or not cloud mode), 429.
- `:id` must be a UUID.
- Writes log an audit entry: `createAuditLog({ userId: null, action: 'UPDATE',
entity: 'organization', entityId, details: { actor: 'control-plane', before,
after } })`. These entries are operator-visible only.

### 4.3 Billing handoff (user to control plane)

- Only shown and only routable when `BILLING_URL` is set (404 otherwise).
- "Manage billing" is a same-origin `<form method="post"
action="/api/billing/handoff">`.
- `POST /api/billing/handoff` requires:
  - a BetterAuth **browser session**; API keys are rejected with 403;
  - a DB-fresh admin check;
  - `Origin` equal to the app origin.
    It deliberately skips the org-status block so locked and read-only admins
    can pay.
- Token: compact JWS HS256 via `jose` with the handoff key, claims
  `iss` (app origin), `aud: 'billing-handoff'`, `sub` (userId), `orgId`,
  `email`, `jti` (UUID), `iat`, `exp = iat + 60`.
- Response: an HTML page with a nonce'd script that auto-submits a POST form
  carrying the token to `BILLING_URL/handoff`.
- `proxy.ts` `buildCspHeader` adds `new URL(BILLING_URL).origin` to
  `form-action` when `BILLING_URL` is set.
- Control-plane obligations (sub-project 2): verify `iss`/`aud`/`exp`, reject
  a reused `jti`, check `Origin`, and keep its own sessions short.

### 4.4 Events (core to control plane)

- Only event: `org.created` with payload `{ id, name, slug, createdAt,
billingContact }`.
- Sent only when `CONTROL_PLANE_WEBHOOK_URL` is set; otherwise skipped
  (reconcile covers it).
- Wire format, in `src/lib/control-plane/events.ts` (not `webhooks.ts`, which
  fans out to tenant webhooks):
  - `X-Event-Id`: UUID
  - `X-Timestamp`: unix seconds
  - `X-Signature`: `sha256=` + hex HMAC-SHA256(events key,
    `${timestamp}.${rawBody}`)
  - the body is sent byte-identical.
- Delivery runs in `after()` from `next/server` after the creating transaction
  commits: 3 attempts, 5 s timeout each, backoff 0.5 s and 1 s. Failures are
  logged with org ID and attempt.
- Recovery is the control plane's nightly reconcile via
  `GET /api/internal/orgs?createdAfter=`.

## 5. Organisation creation

`createOrganization(tx, { name, slug, entitlements? })` in
`src/lib/organizations.ts` only writes the org. Stored entitlements:

1. the explicit `entitlements` argument if given;
2. otherwise, in cloud mode, `NEW_ORG_ENTITLEMENTS`;
3. otherwise NULL.

The caller calls `notifyOrgCreated(org)` after the transaction commits. All
creation paths use it: `auth/register` (wrapped in a transaction),
`organizations` POST, `setup`, and `prisma/demo-seed.js` (via the same
mapping, without events). Org API responses use a shared
`organizationApiSelect` allow-list. Billing columns and `entitlements` never
leave through tenant-facing routes.

## 6. Configuration

| Var                                          | Required                          | Rule                                                                              |
| -------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `CONTROL_PLANE_SECRET`                       | no; its presence means cloud mode | 32+ chars                                                                         |
| `CONTROL_PLANE_SECRET_PREVIOUS`              | no                                | 32+ chars                                                                         |
| `NEW_ORG_ENTITLEMENTS`                       | in cloud mode                     | JSON that passes `entitlementsSchema`                                             |
| `SUPER_ADMIN_EMAILS`                         | in cloud mode                     | at least one address; `requireSuperAdmin` fails closed when empty in cloud mode   |
| `CONTROL_PLANE_WEBHOOK_URL`                  | no                                | `https:`, no credentials or query (`http://localhost` allowed outside production) |
| `BILLING_URL`                                | no                                | same as above                                                                     |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no (legacy, removed in 3a)        | when set, legacy billing is active                                                |

- Rules live in `validateControlPlaneConfig()`, modelled on
  `validateSplitConfig()`, and are fatal at startup.
- `scripts/preflight-env.ts` runs the same validation in the production build
  before `prisma migrate deploy` (in `vercel.json`), so a bad env fails the
  build, not the live site.
- Stripe vars are never required. A self-hoster who sets nothing boots.

## 7. Rollout

Pattern: expand → backfill → switch reads → stop legacy writers → contract.
**Gates** are runnable checks; a phase starts only when its gate passes.

**Phase 1a: expand and dual-write (core release)**

- Migration adds `entitlements Json?` and `lockedAt Timestamp?` to
  `organizations` (nullable, no default, safe on the shared DB). The
  `deployment.mode` marker is a `system_settings` row and needs no schema
  change.
- Ships `entitlements-shared.ts` and a pure
  `legacyPlanToEntitlements(plan, maxAssets, maxUsers)`:
  - starter: no features;
  - professional: api_keys, procurement, advanced_reports, workflow_automation,
    custom_fields, tco_dashboard;
  - enterprise: professional plus scim;
  - unknown plan: starter, logged;
  - `-1` or ≥ 999999: null.
- Legacy writers (Stripe webhook, `check-trials`, `register` trial) also write
  `entitlements` via that helper, only when legacy billing is active
  (`STRIPE_SECRET_KEY` set). Nothing reads `entitlements` yet.
- Ships `scripts/backfill-entitlements.ts` (Bun, `DATABASE_URL`):
  - `--dry-run` (default) prints per org: current effective access (given the
    deployment's real `SELF_HOSTED` value), proposed entitlements, usage and
    over-limit.
  - `--apply` writes only orgs whose `entitlements` is NULL. It is idempotent.
- Run only against the SaaS database.

**Gate 1a → 1b** (SaaS DB):

- Record production and Preview values of `SELF_HOSTED` and `STRIPE_*`.
- If production ran with `SELF_HOSTED=true`, orgs were effectively
  unrestricted: decide per org in the dry-run output before applying.
- Re-run backfill `--apply` immediately before the switch.
  `SELECT count(*) FROM public.organizations WHERE entitlements IS NULL` must be 0.
- Preview has its own DB or the full cloud env.
- `SUPER_ADMIN_EMAILS` is set.

**Phase 1b: switch reads (core release; cloud env set before deploy)**

- Every check reads `getEffectiveEntitlements`. Status uses `lockedAt`. The
  internal API, handoff, events, `createOrganization` and `FeatureGate` ship.
- A cut-over step writes `deployment.mode = 'cloud'`.
- The legacy billing path stays active (Stripe routes, `BillingTab`,
  `check-trials`, the register trial) and keeps dual-writing. The internal API
  is deployed, but nothing calls it until phase 2.

**Gate 1b → 2:** the internal API answers with the production secret; GET
returns `legacy` fields for every customer org; the dry-run report has no
unexpected `overLimit` orgs.

**Phase 2: control plane goes live (sub-project 2)**

1. The control plane imports orgs, `legacy` Stripe IDs and trial dates via
   `GET /api/internal/orgs`, then resyncs from Stripe as its source of truth.
2. Switch the Stripe webhook endpoint to the control plane in the Stripe
   dashboard.
3. Remove `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the core's env
   and redeploy. Legacy billing is now inactive: the core's webhook route
   returns 404, and `check-trials` and the register trial are no-ops, so no
   legacy writer can overwrite control-plane state.
4. The control plane pushes entitlements and status for every org.

**Phase 3a: stop using legacy columns (code-only core release, no migration)**

- Delete:
  - `legacyPlanToEntitlements`, the register trial, `lib/stripe.ts`,
    `/api/billing/{checkout,portal,usage,webhook}`, `api/cron/check-trials`
    (and its `vercel.json` entry);
  - `BillingTab`, `PlanGate`, `UpgradeRequired`, `plan-features*.ts`, the
    `stripe` dependency, the `legacy` block of `InternalOrg`, and the
    `SELF_HOSTED` warning.
- Remove `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`,
  `maxAssets` and `maxUsers` from `schema.prisma`, so the client stops
  selecting them. The columns stay in the database.
- Before release, `scripts/archive-billing-columns.ts` exports those columns
  to a CSV kept with the control plane.

**Phase 3b: contract (later core release)**

- Migration drops the six columns. Rollback before 3b is a plain redeploy.

Every migration uses `migrate deploy` only, against a production database that
is shared with other applications (`TECHNICAL_DEBT.md` item 8a). Never use
`db push` or `migrate reset`.

## 8. Error handling

- Invalid stored entitlements: log the org ID at error level, then apply the
  resolution rule. Never crash a request.
- Internal API: zod issues in 400 bodies; no stack traces or internal details.
- Event failures are logged and never surface to the user.
- Denials are typed errors mapped to 403 with a machine-readable `code`. The
  offline queue (Phase 0) keeps denied mutations instead of dropping them.

## 9. Testing

TDD; unit tests first. Existing tests that change: `org-suspension.test.ts`,
`api-auth.test.ts`, `env-validation.test.ts`, plan-gating tests, and
`src/lib/__mocks__/api-auth.ts`. The plan lists them per task.

- **Resolution rule:** every row of the table, both NULL kinds, an unknown
  feature, an invalid shape, a null org.
- **Enforcement matrix:** each feature's config-time and use-time gate, in
  cloud mode (denied and allowed) and self-hosted mode (always allowed).
- **Limits:** every creator listed in 2, including the SSO hook, SCIM, invite
  accept and syncs (skip and log); deactivated users not counted; an
  over-limit org blocks creation only.
- **Status:** the transition table, the precedence order, `suspend` idempotence,
  and a lock that a tenant cannot undo.
- **Internal API:**
  - 404 when not in cloud mode; 401 for a missing or wrong bearer or a
    session cookie only; the previous secret is accepted;
  - non-UUID ID; unknown org; strict body; audit entry written;
  - every route file calls `requireControlPlane`.
- **Handoff:**
  - session required; API key gets 403; non-admin and demoted admin get 403;
    a wrong `Origin` is rejected;
  - a locked admin can obtain a token;
  - token claims and 60-second expiry; token never in a URL;
  - CSP `form-action` contains the billing origin.
- **Events:** signature vector, sent after commit, retry, signup succeeds when
  the receiver is down, skipped when the URL is unset.
- **Configuration:** every rule in 6 is fatal; the preflight script fails on a
  bad env; the fail-closed guard refuses to start with the cloud marker and no
  secret.
- **Backfill** against an ephemeral Postgres (the existing DB test setup,
  never production): mapping, sentinels, unknown plan, idempotence, dry-run
  output.
- **Self-hosted E2E** (existing DB-less E2E recipe): no billing UI, no gated
  feature denied, `/api/auth/register` closed.

## Out of scope

- The control plane, its database, Stripe checkout, trials, dunning, reconcile,
  operator console, offboarding and purge (sub-projects 2 and 5).
- Per-tenant SSO (sub-project 6).
- Moving the marketing site and pricing page (sub-project 3).
- Infrastructure, including a separate Preview database (sub-project 4).
- IP allowlists, mutual TLS, a message queue, optimistic-concurrency revisions
  on internal writes, and sign-in from the control plane back into the app.
