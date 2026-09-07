# Plan: finish MFA (D1) and SSO (D2) on BetterAuth

Status: **proposal, awaiting approval** (2026-09-07). Resolves `TECHNICAL_DEBT.md`
decisions D1 and D2. Research verified against the installed `better-auth@1.6.30`
and `@better-auth/sso@1.6.30` (peer `^1.6.30`).

## Why both are rewrites, not patches

- MFA: the login gate is already BetterAuth's `twoFactor` plugin (`auth-server.ts`,
  `LoginForm.tsx`, `mfa-verify/MfaVerifyForm.tsx` all use it). Only the _enrolment_
  side is custom and writes columns the gate never reads. Moving enrolment onto the
  plugin deletes 461 lines and three routes; patching the custom verify route to also
  write the plugin's table would couple us to library internals.
- SSO: the custom flow ends at `/login?sso_user=&sso_token=`, which nothing reads, and
  its config is global (`system_settings` `sso.*`, no `organizationId`). Because it
  never completed a login, **no tenant can be relying on it**, so there is no data to
  migrate. The plugin replaces 1,050 lines, four routes and the `@node-saml/node-saml`
  dependency with a per-organization provider registry, callbacks and session handling.

Same argument for MFA: the flag was never enforced at login, so forcing re-enrolment
removes no real protection. Users who enabled it must scan a new QR code once.

## Phase 1 — MFA on `twoFactor` (branch `feat/mfa-betterauth`, ~1 day)

1. **Schema.** Migration `remove_custom_mfa_extend_two_factor`: drop
   `user.mfaEnabled`, `user.mfaSecret`, `user.mfaBackupCodes`; add to `twoFactor`
   the plugin's `verified Boolean @default(false)`, `failedVerificationCount Int
@default(0)`, `lockedUntil DateTime?` (present in the installed plugin schema, absent
   from ours — the adapter would reject writes). Cross-check with
   `npx @better-auth/cli generate` before writing the migration.
2. **Server.** `twoFactor({ issuer: "AssetTracker", allowPasswordless: true,
backupCodeOptions: { storeBackupCodes: "encrypted" } })`. `allowPasswordless` only
   waives the password for users _without_ a credential account (LDAP/SSO users);
   local users still confirm with their password.
3. **Audit log.** `hooks.after` in `auth-server.ts` for `/two-factor/enable` and
   `/two-factor/disable` → `createAuditLog(...)`, replacing the logging that lived in
   the deleted routes.
4. **UI.** Rewrite `user/[id]/settings/ui/MfaSettings.tsx` on
   `authClient.twoFactor.enable / verifyTotp / disable / generateBackupCodes`; render
   the returned `totpURI` with the already-installed `qrcode.react`; show backup codes
   once. `settings/page.tsx` selects `twoFactorEnabled` instead of `mfaEnabled`.
5. **Delete** `api/auth/mfa/{setup,verify,disable}`, `lib/mfa.ts`,
   `lib/__tests__/mfa.test.ts`; remove `mfaSecret`/`mfaBackupCodes` from
   `api/user/route.ts` `stripPassword` and `mfaEnabled` from `SessionUser`.
6. **Compliance dashboard** (register item 37): replace the hard-coded "MFA not yet
   implemented" check with `count(twoFactorEnabled) / count(users)` for the org.
7. **Tests.** Unit test for the audit hook; route test that `/api/user` no longer
   leaks the removed fields; manual checklist: enrol → sign out → sign in → TOTP
   prompt → backup code → disable.
8. **Release.** `0.10.0` (behaviour change for enrolled users), CHANGELOG "Users who
   had MFA enabled must re-enrol", D1 → FIXED.

Before deploying: `SELECT count(*) FROM "user" WHERE "mfaEnabled"` on production to
size the notification.

## Phase 2 — SSO on `@better-auth/sso` (branch `feat/sso-betterauth`, 2–3 days)

1. `bun add @better-auth/sso@1.6.30`.
2. **Schema.** Hand-merge the plugin's `ssoProvider` model (`providerId`, `issuer`,
   `domain`, `oidcConfig`, `samlConfig`, `userId`) into `schema.prisma` following our
   `@db.Uuid` conventions, plus **our** `organizationId` FK to `organizations` as an
   additional field (we do not use BetterAuth's `organization` plugin, so its
   `organizationProvisioning` is unusable; `provisionUser` is the hook we need).
3. **Server.** `sso({ provisionUser, disableImplicitSignUp: false, domainVerification:
{ enabled: false } })`. `provisionUser` sets `organizationId` from the provider row,
   `authProvider = "sso"`, `externalId`, writes the audit log and fires the
   already-declared `user.sso_login` webhook (register item 28).
4. **Client.** Add `ssoClient()` to `auth-client.ts`.
5. **Admin route + UI.** Rewrite `api/admin/settings/sso/route.ts` to
   `auth.api.registerSSOProvider` / list / delete on `ssoProvider`, scoped to the
   caller's organization, gated by `requirePlanFeature(user, "sso")`. Rewrite
   `SSOSettingsTab.tsx` (588 lines) around the plugin's `oidcConfig` / `samlConfig`
   / `mapping` shapes with a SAML-or-OIDC selector; expose the SP metadata URL
   `/api/auth/sso/saml2/sp/metadata?providerId=…` for IdP setup.
6. **Login.** `sso-status/route.ts` reports whether any provider matches the typed
   email domain; `LoginForm.tsx` calls `authClient.signIn.sso({ email, callbackURL })`.
7. **Delete** `lib/sso.ts`, `api/auth/{sso-init,sso-login}`,
   `api/auth/callback/{oidc,saml}`, `lib/__tests__/sso.test.ts`; `bun remove
@node-saml/node-saml`. Existing `sso.*` `system_settings` rows are left in place and
   ignored (nothing worked; admins reconfigure once).
8. **Tests.** Unit tests for `provisionUser` (org assignment, quota, audit, webhook)
   and the admin route's org scoping; manual OIDC test against a Google/Entra tenant
   and a SAML test against the IdP's test app. A mock-IdP e2e is a follow-up.
9. **Release.** `0.11.0`, D2 → FIXED, item 28 partially closed.

## Decisions (recommended default first)

| #   | Decision                                       | Recommendation                                                                                                                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MFA: migrate old secrets or force re-enrolment | **Re-enrol.** Old secrets are AES-encrypted with our key; the flag was never enforced, so nothing is lost.                                                                            |
| 2   | MFA for LDAP/SSO users (no local password)     | **Allow** (`allowPasswordless: true`); hide nothing.                                                                                                                                  |
| 3   | Backup codes                                   | Encrypted at rest, plugin defaults (10 codes × 10 chars).                                                                                                                             |
| 4   | Org-wide "require MFA" and admin reset         | Out of scope; new register item.                                                                                                                                                      |
| 5   | SSO org assignment                             | **Per provider row**: the org admin who registers the provider owns it; every user signing in through it lands in that org. Domain matching is how the login page picks the provider. |
| 6   | SSO just-in-time provisioning                  | **On** (domain-matched), with `checkUserLimit` in `provisionUser`; invited-only mode later via `disableImplicitSignUp`.                                                               |
| 7   | Who may configure SSO                          | **Org admin** with the `sso` plan feature (today: super-admin only).                                                                                                                  |
| 8   | MFA on SSO logins                              | **Not enforced** by us; the IdP owns it (plugin does not gate SSO with 2FA).                                                                                                          |
| 9   | Domain verification (DNS TXT)                  | Off for now; revisit before opening self-serve SSO.                                                                                                                                   |
| 10  | Order                                          | Phase 1 first, merged to `development` and verified, then Phase 2.                                                                                                                    |

## Out of scope

Upgrading `better-auth` to 1.7 (account-table migration), the BetterAuth
`organization` plugin, org-level MFA policy, a mock IdP for CI.
