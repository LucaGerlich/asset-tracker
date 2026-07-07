# Technical Debt

Last updated: 2026-07-07 (v0.9.4 — multi-agent audit remediation)

This document tracks issues found during the 2026-07-07 whole-application audit
(six specialist review agents: UI dead-ends, API logic, client React, RBAC/authz,
Prisma data layer, cross-cutting consistency). Items marked **FIXED** were resolved
in v0.9.4; items marked **DEFERRED** are documented here with a recommended fix.

## Summary

**Fixed**: ~55 issues across cross-org isolation, auth hardening, concurrency,
cache invalidation, UI dead-ends, and consistency.
**Deferred**: 12 lower-severity / product-decision items (below).

---

## FIXED — Cross-org isolation (multi-tenant IDOR)

The dominant theme. A set of newer/legacy routes queried without `organizationId`,
letting an authenticated user of org A read/mutate/delete org B's data.

- `api/asset/transfers` GET+POST — scoped list via asset relation; source asset and
  user/location transfer targets now verified in-org.
- `api/asset/reservations` GET/POST/PUT — switched raw `getSession` → `requireApiAuth`
  (also restores `isActive` + suspension checks); scoped via asset relation.
- `api/reservations/[id]` GET/PUT/DELETE — same `requireApiAuth` switch + asset-org check.
- `api/approvals` (list) and `api/approvals/[id]` GET/PUT — scoped via `requester.organizationId`.
- `api/components/checkout` GET+POST and `[id]` GET/PUT — scoped via component relation;
  checkout target asset verified in-org.
- `api/licence/seats` GET+POST — scoped licence lookup to org.
- `api/kits` PUT+DELETE (body routes) and `api/kits/[id]/checkout` — scoped kit, target
  user, and per-item asset/licence/accessory lookups.
- `api/audits` DELETE (body route) — scoped campaign lookup.
- `api/asset/checkout` + `/bulk` — target user/location/asset lookups scoped
  (fixed `orgId ?? undefined` → `?? null`).
- `api/userAssets/{assign,unassign}` and `api/userAccessoires/{assign,unassign}` —
  verify asset/accessory/user belong to caller's org; org-scoped the `statusType` lookups.
- `api/licence/assign` — target user now verified in-org.
- `api/componentCategory` DELETE — scoped lookup.
- `api/scim/v2/Users` — duplicate-user check scoped to org (was cross-org, leaked existence).
- `lib/notifications.ts` — `notifyReservationRequest`, `checkLowStock`,
  `checkExpiringWarranties` now resolve admins per-org (was emailing every org's admins).
- `api/requests` — admin notification query scoped to org.
- `dashboard/page.tsx` — map location query scoped to org.
- `lib/data.ts` — 12 shared-table getters (locations, status, manufacturers, suppliers,
  categories×5, models, userAssets, userAccessoires) now use `strictOrgWhere()` +
  org-keyed cache keys (were global keys serving one org's data to another).

## FIXED — Auth hardening

- `lib/api-auth.ts` — `requireApiAdmin` and `requirePermission` now enforce the
  org-suspension gate (previously bypassed it via direct `getAuthUser`).
- `api/reservations/*` — no longer bypass the `isActive` deactivation check (via
  `requireApiAuth` switch above).
- `api/asset/checkout` POST — now requires `asset:assign` (matched its bulk sibling;
  was any authenticated user).
- All 12 `api/cron/*` routes — `CRON_SECRET` compared in constant time via new
  `lib/cron-auth.ts` `isValidCronAuth` (was `!==`, a timing oracle).

## FIXED — Concurrency / data integrity

- `lib/po-number.ts` + `generate-po` — `generatePONumber` accepts the transaction
  client; generation wrapped in Serializable tx with retry on P2002/P2034. Fixes both
  duplicate PO numbers within one request and the concurrent-request race.
- `api/licence/seats` POST — Serializable isolation prevents seat over-assignment;
  P2002/P2034 surfaced as 409; "Licence not found" now 404, "no seats"/"already assigned" 409.
- `api/user` PUT — optimistic lock made atomic via conditional `updateMany` on `change_date`.
- `api/user/addUser` — user + credential account + team invitation now created in one
  transaction (was 3 separate writes; a mid-way failure left an unloggable user).
- `api/components` PUT — editing `totalQuantity` now reconciles `remainingQuantity`
  (preserves checked-out amount; keeps `remainingQuantity <= totalQuantity`).

## FIXED — Cache invalidation (stale list/count/detail)

Same class as the earlier component fix. Added `invalidateCacheByPrefix` to mutation
routes that lacked it: asset add/delete/updateStatus, accessory delete, consumable
delete/restock/checkout, licence delete/assign/unassign, all 5 category routes,
kits create/update/delete, users create/update, audit campaigns, component check-in.
Also converted the 5 reference-data routes (manufacturer/location/statusType/supplier/model)
from exact-key `invalidateCache` to `invalidateCacheByPrefix` (needed after data.ts keys
became org-suffixed).

## FIXED — UI dead-ends & client bugs

- Created `kits/[id]/edit/page.tsx` (Edit button 404'd; the form already supported edit mode).
- Removed the non-functional "Delete user" button (no backend endpoint existed).
- Removed the procurement draft "Edit" button (route did not exist).
- Asset table: assign-dialog crash on deleted user (optional chaining); search filter
  null crash (optional chaining); silent assign/unassign failures now toast; bulk
  status/location updates now check `res.ok` and report partial failures instead of
  falsely claiming success.
- Assign-user button no longer wrongly gated on `asset.requestable`.
- Custom-field saves in all 6 create/edit forms now check `res.ok` and warn on failure
  (was silently discarding custom-field data after the entity was created).
- `ComponentDetailClient` uses `router.refresh()` instead of `window.location.reload()`.
- Sidebar user dropdown guards on `user?.id` (avoided `/user/undefined` links while loading).

## FIXED — Consistency

- Audit-log viewer entity filter synced with `AUDIT_ENTITIES` (component, kit,
  licence_seat, eula_template, audit_campaign, report_schedule, intune_sync were missing).
- Audit logging added to asset DELETE and accessory DELETE (destructive actions that
  previously left no trail).
- Plan-gating API bypass closed: `admin/settings/sso`, `admin/settings/ldap`,
  `admin/api-keys` write handlers now call `requirePlanFeature` (self-hosted passes through).

---

## DEFERRED — recommended fixes for a follow-up pass

1. **Quota TOCTOU** (`lib/tenant-limits.ts`): `checkAssetLimit`/`checkUserLimit` count then
   create in separate steps — a concurrent burst can exceed the plan cap by N-1. Fix:
   wrap count+create in a Serializable tx or take a per-org Postgres advisory lock. Low
   real-world impact (soft billing-cap overshoot), invasive fix — deferred deliberately.

2. **Quota skipped on some creation paths** (`procurement/orders/[id]/receive`,
   `lib/integrations/intune.ts`, `lib/ldap.ts`): these create assets/users without calling
   `checkAssetLimit`/`checkUserLimit`. Add the checks (SCIM already does for users).

3. **Global search coverage** (`api/search`): only asset/user/consumable are searched, but
   the registry marks accessory/licence/component `searchable` and `GlobalSearch.tsx`
   advertises accessories. Drive `/api/search` off `getSearchableEntities()`.

4. **i18n unwired**: full locale infrastructure exists but `t()` is imported by zero
   components and the User-Settings "Language" selector persists a preference nothing reads.
   Decision needed: wire `setLocale` at bootstrap + migrate strings, or remove the selector.
   Left intact (it does not error) pending that decision.

5. **Assignment notifications dead code** (`lib/notifications.ts`): `notifyAssetAssignment`/
   `notifyAssetUnassignment` have templates + preference toggles in settings but zero call
   sites. Wire them from `userAssets/{assign,unassign}` (and an accessory equivalent).

6. **Audit-log gaps (remaining)**: user UPDATE, licence assign/unassign, and asset status
   change log via webhook only, not `createAuditLog`. Add audit entries for a complete trail.

7. **Export coverage** (`lib/export.ts`): components and kits cannot be exported though they
   are full inventory siblings; the Help page describes an "Export button on list pages"
   that does not exist (only Reports uses export, hardcoded to assets). Add a shared
   `ExportButton` and the missing entity configs.

8. **Webhook event registry** (`lib/webhooks.ts`): advertises 6 events never fired
   (`asset.assigned/unassigned`, `license.expiring`, `eula.accepted`, `ldap.sync_completed`,
   `user.sso_login`); accessory fires no events at all. Fire them or prune the registry.

9. **Plan-gating dead-end nav**: "Procurement" shows in the nav for every admin regardless
   of plan; the page renders then all fetches 403. Gate the page/nav with `PlanGate`. Also
   `custom_fields`/`workflow_automation`/`advanced_reports`/`tco_dashboard`/`scim` are sold
   as paid but enforced nowhere.

10. **Timestamp columns without timezone** (`schema.prisma`): ~40 business-logic fields use
    `@db.Timestamp(6)` (no tz). If the DB session timezone ever drifts from UTC, comparisons
    (`trialEndsAt`, `accessExpiresAt`, etc.) go silently wrong. Migrate to `@db.Timestamptz`.

11. **Global unique constraints** (`schema.prisma`): `asset.assettag` and `asset.serialnumber`
    are globally `@unique`, not per-org — two tenants can't reuse the same tag. Switch to
    `@@unique([assettag, organizationId])` etc.

12. **Dead code**: unused `Footer.tsx` (broken/case-wrong links) and three unused
    `DashboardTable` variants (accessories/suppliers/generic). Delete when convenient.

## Test harness note

The Vitest suite is pre-broken independent of this work: the Prisma-mock pattern
(`prisma.x.findUnique.mockResolvedValue`) does not attach to the generated client, so
~27/60 API tests fail at baseline with zero changes. Several tests also assert the
pre-fix (insecure/unscoped) behavior — e.g. `findUnique`-mocked lookups where routes now
use org-scoped `findFirst`. These need updating once the mock infrastructure is repaired.
Typecheck (non-test) and ESLint are clean.
