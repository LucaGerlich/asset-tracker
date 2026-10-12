# SaaS Boundary Phase 1b (Switch Reads) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the core read per-organization entitlements and the control-plane lock in cloud mode, keep self-hosted deployments unrestricted with nothing to configure, and ship the internal API, billing handoff and `org.created` events the control plane needs.

**Architecture:** One switch, `isCloudMode()` (`CONTROL_PLANE_SECRET` set), replaces `SELF_HOSTED`. Entitlements and the lock are loaded with the user in the existing organization select (like `orgStatus`) and resolved by pure functions; callers without a user (SCIM, crons, syncs, server pages) read them by organization id. Typed `EntitlementError` and `LimitError` map to 403 bodies with a machine-readable `code`. A new `src/lib/control-plane/` directory holds configuration, keys, the internal API helpers, events and the handoff token. The legacy Stripe path stays active while `STRIPE_SECRET_KEY` is set and keeps dual-writing.

**Tech Stack:** Next.js 16.2 (App Router, `src/proxy.ts`, `after()` from `next/server`), Prisma 7, BetterAuth 1.6.30, zod 4, jose 6, `node:crypto` (`hkdfSync`, `createHmac`, `timingSafeEqual`), vitest 4, Bun.

**Spec:** `docs/superpowers/specs/2026-10-05-saas-boundary-design.md` (all sections; the "Revision 3" section at its end overrides earlier text). Requires phase 1a (`docs/superpowers/plans/2026-10-12-saas-boundary-1a.md`, release 0.15.0) to be merged first.

## Global Constraints

- Branch `feat/saas-boundary-1b` from `development` after 0.15.0 is merged. Do not push.
- Release version `0.16.0`, bumped in the last task only.
- Commits: conventional (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), English, header ≤ 100 characters, body lines ≤ 100, no `Co-Authored-By`, no mention of Claude.
- Code style: TypeScript strict in new code (the repo's `tsconfig` is not strict; write as if it were), no `any`, named exports. Keep the repo's Prettier style (2-space indent, double quotes).
- Never run `prisma db push`, `prisma migrate reset`, `prisma migrate dev` or `bun run build`. This release has **no migration**. Never run any `scripts/*.ts` locally through `bun` or `node` (Bun loads `.env`, which points at the shared production database). Importing a script into a vitest file with its dependencies mocked is allowed (`tests/scripts/preflight-env.test.ts`).
- DB-backed tests: `process.env.DATABASE_URL && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1" ? describe : describe.skip`, inside a rolled-back transaction. CI only. Vitest 4 takes options second: `it(name, { timeout }, fn)`.
- **Test mode default:** without `CONTROL_PLANE_SECRET` the code is self-hosted (unrestricted). A test that needs cloud behaviour calls `stubCloudMode()` from `tests/setup/cloud-mode.ts` (Task 2) and `vi.unstubAllEnvs()` in `afterEach`. No global default.
- New guards that throw typed errors go into the `THROWING_GUARDS` regex of `src/app/api/__tests__/route-conventions.test.ts` and into the automock `src/lib/__mocks__/api-auth.ts` when exported from `api-auth.ts`.
- Denial messages never name a plan or a price.
- Error bodies: `{ error: string, code: string, ...extras }`. Never stack traces or raw `error.message` of unexpected errors.
- After every task: `npx vitest run <the task's test files>`, `npx tsc --noEmit -p .`, `npx eslint <touched files under src/>`. Before the last commit of a task that changes shared modules, run the whole suite: `npx vitest run`.

## Decisions (from spec Revision 3; binding for every task)

- `isCloudMode() = Boolean(process.env.CONTROL_PLANE_SECRET)`. Non-cloud: status always `active`, entitlements `UNRESTRICTED`, limits unlimited, stored values ignored.
- `isBillingEnabled() = isCloudMode() && (Boolean(process.env.BILLING_URL) || isLegacyBillingActive())`.
- With legacy billing inactive: the Stripe webhook answers 404, check-trials does nothing, register writes no trial.
- Revoked feature: create/edit blocked; list, deactivate and delete stay open; stored values stay readable.
- Limits: `max: null` = unlimited; active users only; explicit org id; checks run before the create; at the limit you cannot add; an org already over its limit only loses creation; reactivation counts as creation. Cloud + org-less creation → `ForbiddenError("organization_required")`.
- Entitlement resolution (cloud): valid stored value → stored (unknown features filtered and logged); SQL NULL or JSON `null` → `NEW_ORG_ENTITLEMENTS`; invalid shape → `NEW_ORG_ENTITLEMENTS` and an error log; org null → `NEW_ORG_ENTITLEMENTS`.
- `NEW_ORG_ENTITLEMENTS` is parsed on every use; an invalid or missing value in cloud mode throws (startup validation rejects it first).

## Review Focus

1. **Self-hosted with stale SaaS data.** No `CONTROL_PLANE_SECRET` but restrictive stored `entitlements`, a `lockedAt`, an old `suspendedAt`: every gate allows, limits are unlimited, status is `active`, there is no billing UI, and `/api/internal/*` and `/api/billing/handoff` answer 404. Owners: Tasks 2, 6, 10, 14, 15.
2. **A cloud deployment that lost its secret refuses to start; a self-hoster is never blocked by the marker check**, including when the database is unreachable at startup. Owner: Task 5.
3. **Org-less users in cloud mode** never get more than `NEW_ORG_ENTITLEMENTS` features and can create nothing org-scoped, on every creator including the SSO callbacks and the cron syncs. Owners: Tasks 6, 10, 11.
4. **Revocation keeps data usable:** lists, deactivation and deletion stay open; existing custom field values render read-only; API key lists stay visible. Owners: Tasks 7, 8, 16.
5. **Internal API authentication:** `CRON_SECRET` and session cookies never authenticate; the previous secret works only when set; outside cloud mode every route answers 404 before any other check. Owner: Task 14.

## File structure

New:

- `src/lib/control-plane/config.ts`: configuration rules, `NEW_ORG_ENTITLEMENTS` parsing (Task 4)
- `src/lib/deployment-marker.ts`: startup marker guard (Task 5)
- `scripts/lib/deployment-mode-marker.ts`, `scripts/set-deployment-mode.ts`, `scripts/preflight-env.ts` (Tasks 4, 5)
- `src/lib/entitlements.ts`: server-side resolution and checks (Task 6)
- `src/lib/org-access.ts`: status plus entitlements by org id, per-run cache (Task 6)
- `src/lib/control-plane/keys.ts`, `billing-contact.ts`, `events.ts` (Task 12)
- `src/lib/control-plane/auth.ts`, `internal-org.ts`, `status-actions.ts`, `src/app/api/internal/orgs/**` (Task 14)
- `src/lib/app-origin.ts`, `src/lib/csp.ts`, `src/lib/html-escape.ts`, `src/lib/control-plane/handoff.ts`, `src/app/api/billing/handoff/route.ts` (Task 15)
- `src/components/FeatureGate.tsx`, `src/components/FeatureUnavailable.tsx`, `src/components/ManageBillingCard.tsx`, `src/lib/page-context.ts` (Task 16)
- `src/app/api/entitlements/route.ts`, `src/contexts/EntitlementsContext.tsx` (Task 17)
- `tests/setup/cloud-mode.ts` (Task 2)

Deleted: `src/components/PlanGate.tsx`, `src/components/UpgradeRequired.tsx` (Task 16); the unused exports of `src/lib/feature-flags.ts` (Task 3); `requirePlanFeature` and `src/lib/plan-features.ts` (Task 6). `plan-features-shared.ts`, `stripe.ts`, `BillingTab` and the billing routes stay until phase 3a.

## Tasks

Each task lives in its own file next to this plan (`docs/superpowers/plans/2026-10-12-saas-boundary-1b/`), with its Files, Interfaces and checkbox steps. An implementer reads this file (constraints, decisions, review focus) plus their task file. Run the tasks in order; "Needs" lists the tasks whose interfaces a task consumes.

| #   | Task                                                                                                   | Needs       | Lines |
| --- | ------------------------------------------------------------------------------------------------------ | ----------- | ----- |
| 1   | [Typed entitlement and limit denials](2026-10-12-saas-boundary-1b/task-01.md)                          | 1a          | 355   |
| 2   | [Cloud mode switch](2026-10-12-saas-boundary-1b/task-02.md)                                            | 1a          | 1086  |
| 3   | [Marketing gate, feature-flag cleanup, billing tab visibility](2026-10-12-saas-boundary-1b/task-03.md) | 2           | 578   |
| 4   | [Control-plane configuration and production preflight](2026-10-12-saas-boundary-1b/task-04.md)         | 2           | 1344  |
| 5   | [Deployment marker guard and cut-over script](2026-10-12-saas-boundary-1b/task-05.md)                  | 2, 4        | 1258  |
| 6   | [Entitlements core, control-plane lock and the route guard](2026-10-12-saas-boundary-1b/task-06.md)    | 1, 2, 4     | 2457  |
| 7   | [API key use-time gate, advanced reports, TCO](2026-10-12-saas-boundary-1b/task-07.md)                 | 6           | 1325  |
| 8   | [Custom field and workflow automation gates](2026-10-12-saas-boundary-1b/task-08.md)                   | 6           | 1764  |
| 9   | [SCIM gate](2026-10-12-saas-boundary-1b/task-09.md)                                                    | 6           | 669   |
| 10  | [Limits core and the route creators](2026-10-12-saas-boundary-1b/task-10.md)                           | 1, 6        | 1705  |
| 11  | [Limits in SCIM, SSO and the identity syncs](2026-10-12-saas-boundary-1b/task-11.md)                   | 9, 10       | 1571  |
| 12  | [Control-plane keys, billing contact and `org.created` events](2026-10-12-saas-boundary-1b/task-12.md) | 2, 4        | 1201  |
| 13  | [Organization creation through one helper](2026-10-12-saas-boundary-1b/task-13.md)                     | 4, 12       | 1549  |
| 14  | [Internal API](2026-10-12-saas-boundary-1b/task-14.md)                                                 | 6, 12       | 2533  |
| 15  | [Billing handoff and CSP](2026-10-12-saas-boundary-1b/task-15.md)                                      | 4, 7, 12    | 1524  |
| 16  | [Client gating](2026-10-12-saas-boundary-1b/task-16.md)                                                | 3, 6, 7, 15 | 2402  |
| 17  | [Navigation follows entitlements](2026-10-12-saas-boundary-1b/task-17.md)                              | 6, 16       | 1031  |
| 18  | [Release 0.16.0](2026-10-12-saas-boundary-1b/task-18.md)                                               | all         | 263   |
