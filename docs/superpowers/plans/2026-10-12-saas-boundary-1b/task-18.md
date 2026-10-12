### Task 18: Release 0.16.0

**Files:**

- Create: `tests/e2e/self-hosted.spec.ts`
- Modify: `playwright.config.js` (`testMatch` of the `marketing` project)
- Modify: `.env.example`, `README.md`, `docs/HOSTING_GUIDE.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY_GUIDE.md`, `docs/index.html`
- Modify: `CHANGELOG.md`, `TECHNICAL_DEBT.md`, `package.json`

**Interfaces:**

- Consumes: everything above. No code changes besides the E2E spec.

- [ ] **Step 1: Write the self-hosted E2E spec**

It runs only against a server started without any control-plane variable, so it is opt-in (the Playwright `webServer` env sets cloud mode since Task 3). The rate limiter fails open without a database, so the DB-less recipe works for these anonymous checks.

```ts
// tests/e2e/self-hosted.spec.ts
import { test, expect } from "@playwright/test";

// Opt-in: start the server WITHOUT CONTROL_PLANE_SECRET, NEW_ORG_ENTITLEMENTS and
// BILLING_URL, then run with E2E_SELF_HOSTED=1, for example:
//   DATABASE_URL="postgresql://nobody:x@127.0.0.1:1/none?schema=public" npx next dev
//   E2E_SELF_HOSTED=1 npx playwright test --project=marketing self-hosted
const enabled = process.env.E2E_SELF_HOSTED === "1";

test.describe("self-hosted deployment (no control plane)", () => {
  test.skip(!enabled, "set E2E_SELF_HOSTED=1 against a non-cloud server");

  test("sends visitors of the landing page to the login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("keeps public registration closed", async ({ request }) => {
    const res = await request.post("/api/auth/register", { data: {} });
    expect(res.status()).toBe(404);
  });

  test("has no internal API", async ({ request }) => {
    const res = await request.get("/api/internal/orgs");
    expect(res.status()).toBe(404);
  });

  test("has no billing handoff", async ({ request }) => {
    const res = await request.post("/api/billing/handoff");
    expect(res.status()).toBe(404);
  });
});
```

In `playwright.config.js`, extend the `marketing` project: `testMatch: /(marketing|accessibility|domain-split|self-hosted)\.spec\.ts/`.

- [ ] **Step 2: Check the spec is collected and skipped by default**

Run: `npx playwright test --list --project=marketing`
Expected: the four `self-hosted.spec.ts` tests are listed. (Running them needs the opt-in server above; the release checklist in Step 6 does that once.)

- [ ] **Step 3: Update the environment reference**

In `.env.example`, replace the `SELF_HOSTED` block:

```bash
# SELF_HOSTED is deprecated and ignored since 0.16.0 (a startup warning is logged
# when it is set). Self-hosted installs set nothing: without CONTROL_PLANE_SECRET
# every feature is available and no limits apply.
```

Change the Stripe header comment to `# Stripe Billing (optional, legacy SaaS billing; removed in a later release)`, and add a new section after "Platform Administration":

```bash
# ==============================================================================
# Control Plane (hosted SaaS operator only; self-hosters leave all of this unset)
# ==============================================================================

# Presence switches on cloud mode: per-organization entitlements, limits, the
# control-plane lock and the internal API. 32+ random characters.
# CONTROL_PLANE_SECRET=

# Accepted as well during a secret rotation. 32+ characters, differs from the above.
# CONTROL_PLANE_SECRET_PREVIOUS=

# Required in cloud mode: entitlements of a new organization (JSON).
# NEW_ORG_ENTITLEMENTS={"features":[],"maxAssets":100,"maxUsers":3}

# Optional: receives signed org.created events (https; http://localhost outside production).
# CONTROL_PLANE_WEBHOOK_URL=https://control.example.com/events

# Optional: billing site of the control plane (bare https origin). Enables "Manage billing".
# BILLING_URL=https://billing.example.com
#
# The two URLs are validated whenever they are set, also without the secret:
# leave them unset on self-hosted installs.
```

In the `SUPER_ADMIN_EMAILS` comment add: `# Required in cloud mode (at least one address).`

In `README.md`, replace the "Self-hosted" table row with
`| **Control plane** | `CONTROL_PLANE_SECRET`, `NEW_ORG_ENTITLEMENTS`, `BILLING_URL` — hosted SaaS only |        No        |`
and change the Billing row's description to `` `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (legacy) ``.

In `docs/HOSTING_GUIDE.md` and `docs/DEPLOYMENT.md`, remove every `SELF_HOSTED=true` line and table row (HOSTING_GUIDE lines 57, 173, 262, 621; DEPLOYMENT lines 96, 214) and change DEPLOYMENT line 153 to "Open `https://assets.yourclient.com`: it shows the login page (deployments without `CONTROL_PLANE_SECRET` skip the landing page)". In `docs/index.html`, remove the `SELF_HOSTED` lines and table rows at 610, 704, 784 and 1039 the same way.

In `docs/SECURITY_GUIDE.md` §7.3 add the bullet: "Cloud mode (`CONTROL_PLANE_SECRET` set): an empty `SUPER_ADMIN_EMAILS` means nobody is a super-admin, whatever the organization count; startup validation rejects it." Then add a section after §7:

```markdown
### 7.x Control-plane boundary (cloud mode)

- `/api/internal/*` answers 404 outside cloud mode. In cloud mode it accepts only
  `Authorization: Bearer <CONTROL_PLANE_SECRET>` (or the previous secret during a
  rotation), compared in constant time. Session cookies, API keys and `CRON_SECRET`
  never authenticate there. Writes are audited with `userId: null` and
  `actor: "control-plane"`.
- `POST /api/billing/handoff` needs a browser session of an admin and an `Origin`
  equal to the app origin; API keys get 403. It issues a 60-second HS256 token
  (key derived with HKDF from the secret) in an auto-submitting form, never in a URL.
- A database marked `deployment.mode = cloud` refuses to start without the secret, so
  a lost secret can never run the SaaS unrestricted. The demo reset refuses to run in
  cloud mode.

### 7.y Control-plane contract (what the private control plane can rely on)

- Internal API error bodies are `{ error, code, issues? }` with codes `not_found` (not
  cloud mode, 404), `unauthorized` (401), `invalid_id` (400), `org_not_found` (404),
  `validation_failed` (400, with zod `issues`), `invalid_json` (400) and
  `internal_error` (500). Query and body validation is strict: unknown query
  parameters and unknown body keys are rejected. `/api/*` is rate limited per IP and
  path (100 reads and 30 writes per minute).
- `GET /api/internal/orgs` pages by `cursor` (the last org id) in `createdAt, id`
  order; `createdAfter` is inclusive. An empty page after a cursor can mean the cursor
  org was deleted: restart from `createdAfter`.
- `org.created` events: `X-Event-Id` is stable only across the retries of one
  delivery, so deduplicate on the organization id. `billingContact` can be `null` (an
  org created by an operator has no users yet) and `emailVerified` is `false` for
  native sign-ups; do not require it.
- Handoff: the form POST to `BILLING_URL/handoff` carries the token in the body and
  `Origin` set to the app origin (the page uses `Referrer-Policy: strict-origin`).
  Verify `iss`, `aud = billing-handoff` and `exp`, reject a reused `jti`, and check
  `Origin`.
```

- [ ] **Step 4: Write the CHANGELOG entry**

The heading carries the release commit's date; replace `2026-10-26` if the release lands on another day.

```markdown
## [0.16.0] - 2026-10-26

Phase 1b of the SaaS boundary (`docs/superpowers/specs/2026-10-05-saas-boundary-design.md`):
the core reads per-organization entitlements and the control-plane lock in cloud mode,
and stays unrestricted everywhere else.

### Added

- Cloud mode: `CONTROL_PLANE_SECRET` switches on entitlements, limits and the lock.
  Without it every feature is available and no limits apply.
- Internal API for the control plane (`/api/internal/orgs`, entitlements, status), a
  billing handoff (`POST /api/billing/handoff`) and signed `org.created` events.
- Startup guard: a database marked as cloud refuses to start without the secret.
- `scripts/set-deployment-mode.ts` writes that marker.

### Security

- SCIM, advanced reports, the TCO dashboard (page, report tab, dashboard widget and
  scheduled report), custom fields and workflow automation are now enforced per
  organization in cloud mode. Only API keys and procurement were enforced before.
- API keys stop working for an organization whose entitlements drop `api_keys`.
- The SCIM user limit is enforced (the check never found the organization before), and
  so are limits for procurement receipts, LDAP and Intune syncs and user reactivation.
- In cloud mode the legacy global SCIM token is refused, OIDC and SAML sign-ups that
  cannot be tied to an organization are refused, and an empty `SUPER_ADMIN_EMAILS`
  grants nobody super-admin rights.

### Changed

- `SELF_HOSTED` is ignored (a startup warning is logged). Self-hosted installs need no
  configuration; installs that never set it lose the default 100-asset and 3-user caps.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are optional. Without the secret key
  the Stripe webhook answers 404 and the trial cron does nothing.
- Denials carry codes `feature_not_entitled` (with `feature`) and `limit_reached`
  (with `resource` and `max`); messages no longer name plans.
- User limits count active users only; pending invitations do not reserve a seat (the
  limit is checked again when an invitation is accepted).
- The landing, pricing, terms and privacy pages redirect to `/login` unless cloud mode
  is on.
- In cloud mode the LDAP and Intune cron syncs, which run without an organization,
  create and reactivate nothing (each skip is logged); manual syncs from the settings
  use the operator's organization. OIDC and SAML sign-ups without an organization are
  refused with the error key `organization_required` (the login page does not display
  it yet).
- Limit denials read "Forbidden: Your organization has reached its asset limit" (or user
  limit); the import page no longer shows the remaining slots.

### Removed

- `PlanGate`, `UpgradeRequired`, `requirePlanFeature` and the unused feature-flag helpers.

**Upgrade notes**

Self-hosted: remove `SELF_HOSTED`; nothing else to do.

Hosted SaaS (cut-over), in this order:

1. Gate: run the 0.15.0 backfill dry run; its summary must show `"unset":0` and
   `"invalid":0`. Preview must have its own database or the full cloud env: once step 5
   is done, every deployment on the SaaS database without the secret refuses to start
   (Preview, and a local `next start` with the production `.env`).
2. Check the production build can run the preflight: a recent production build log
   shows `bun` resolving (the install step uses it), and in the Vercel project settings
   every variable `validateEnvironment()` needs (`DATABASE_URL`, `BETTER_AUTH_URL`,
   `BETTER_AUTH_SECRET`, `CRON_SECRET`, `ENCRYPTION_KEY`, the control-plane variables,
   `SUPER_ADMIN_EMAILS`) is exposed to the Production build, not only the runtime. If
   either fails, remove `bun scripts/preflight-env.ts &&` from `vercel.json` for this
   release; startup validation still refuses a bad env at runtime.
3. Set in the production env: `CONTROL_PLANE_SECRET` (32+ characters),
   `NEW_ORG_ENTITLEMENTS`, `SUPER_ADMIN_EMAILS`, `ALLOW_PUBLIC_SIGNUP=true`, and keep the
   Stripe variables (legacy billing stays active until the control plane takes over).
   The production build runs `scripts/preflight-env.ts` and fails on a bad value.
4. Deploy 0.16.0 and confirm the app runs with the secret.
5. Write the marker against the SaaS database. Run once without `--confirm` to print the
   target (it exits without connecting), check it, then repeat with it:
   `bun scripts/set-deployment-mode.ts --schema <schema>` and
   `bun scripts/set-deployment-mode.ts --schema <schema> --confirm "<printed target>"`.
6. Gate to phase 2: `curl -H "Authorization: Bearer $CONTROL_PLANE_SECRET" <app>/api/internal/orgs`
   answers 200 with a `legacy` block for every customer org; the backfill dry run lists
   no unexpected `overLimit` org.
```

- [ ] **Step 5: Update the debt register and the version**

In `TECHNICAL_DEBT.md`: set "Last updated" to the release date and `v0.16.0`; mark item 29 (unenforced plan features) `FIXED in 0.16.0`; amend item 63 (legacy SCIM token) with "refused in cloud mode since 0.16.0; still active for self-hosters"; amend item 15 (quota TOCTOU) with "limits now also checked in procurement receive, LDAP and Intune; the check-then-create race remains"; amend item 54 (OIDC/SAML org-less users) with "refused in cloud mode since 0.16.0". Add new items from 82 on (item 81 is 1a's), in the register's format:

- 82. **Custom field forms (medium)** (`src/components/CustomFieldsSection.tsx`, the create forms): the create forms render no inputs (the values GET needs an `entityId`), and the accessory, component, licence and consumable forms never save values in edit mode. _Recommended:_ fix the section's create mode and post values in edit mode.
- 83. **Unused `POST /api/asset/addAsset` (low)** (`src/app/api/asset/addAsset/route.ts`): no UI caller; only the Postman collection. _Recommended:_ remove it or document it as API.
- 84. **`prisma/create-admin.ts` raw organization insert (low)**: bypasses `createOrganization`; in cloud mode its org reads as `NEW_ORG_ENTITLEMENTS` (NULL), which is correct, but it sends no `org.created` event. _Recommended:_ route it through the helper or delete it in favour of `/api/setup`.
- 85. **Stripe CSP origins (low)** (`src/lib/csp.ts`): `form-action`, `connect-src` and `frame-src` still allow Stripe for the legacy path. _Recommended:_ remove them in phase 3a unless the control plane's handoff redirects to Stripe.
- 86. **Sitemap and robots list marketing pages on self-hosted installs (low)** (`src/app/sitemap.ts`, `src/app/robots.ts`): `/pricing`, `/terms` and `/privacy` redirect to `/login` without cloud mode but stay listed. _Recommended:_ filter them on `isCloudMode()`, or move them with the marketing site (sub-project 3).
- 87. **Pending invitations do not reserve seats (low)** (`src/app/api/team/invite/route.ts`): the user limit is checked at create and again at accept, so several invitations can exceed it until accepted. _Recommended:_ count pending invitations if seats become a billed unit.
- 88. **LDAP sync user lookup is not organization-scoped (medium)** (`src/lib/ldap.ts`): a reactivated user may belong to another organization yet takes a seat of the syncing one; cron syncs create nothing in cloud mode. _Recommended:_ scope the lookup and add an LDAP default-organization setting (with items 53 and 59).
- 89. **Login page ignores `?error=` (low)** (`src/app/login`): `organization_required` from the OIDC and SAML callbacks is not shown. _Recommended:_ display known error keys (with item 54).
- 90. **Setup and the admin organization route do not seed defaults (low)** (`src/app/api/setup/route.ts`, `src/app/api/organizations/route.ts`): only register calls `seedOrgDefaults`. _Recommended:_ seed inside `createOrganization`'s callers consistently.

Set `"version": "0.16.0"` in `package.json`.

Spec section 9's self-hosted expectations "no billing UI" and "no gated feature denied" need a session, so the anonymous E2E cannot reach them; unit tests cover them: `settings-tabs.test.ts` (billing tab hidden without `billingEnabled`), `entitlement-gates.test.ts` and `entitlement-gates-matrix.test.ts` (every gate allows without the control plane, also with restrictive stored values) and `billing-handoff.test.ts` (404 outside cloud mode).

- [ ] **Step 6: Verify the whole release**

Run: `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint src/`
Expected: all pass (DB tests skipped locally).

Then the opt-in E2E once, with the DB-less recipe and no control-plane variables in the shell:

Run: `DATABASE_URL="postgresql://nobody:x@127.0.0.1:1/none?schema=public" npx next dev` (separate terminal), then `E2E_SELF_HOSTED=1 npx playwright test --project=marketing self-hosted`
Expected: 4 passed. Stop the dev server afterwards.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/self-hosted.spec.ts playwright.config.js .env.example README.md docs/HOSTING_GUIDE.md docs/DEPLOYMENT.md docs/SECURITY_GUIDE.md docs/index.html CHANGELOG.md TECHNICAL_DEBT.md package.json
git commit -m "docs: release notes and upgrade guide for 0.16.0"
```
