import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "..");
const THROWING_GUARDS =
  /\b(requireApiAuth|requireApiAdmin|requirePermission|requireSuperAdmin|requirePlanFeature|requireApiCanRequest|getAuthUser)\s*\(/;
const MUTATING_EXPORT =
  /export\s+(?:async\s+)?(?:function\s+|const\s+)(POST|PUT|PATCH|DELETE)\b/g;

/**
 * Mutating handlers that must stay usable while an org is read-only or
 * locked, or that do not act on org data. Paths relative to src/app/api.
 */
const WRITE_GUARD_EXEMPT = new Set([
  "auth/[...all]/route.ts",
  "auth/register/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
  "auth/set-password/route.ts",
  "auth/change-password/route.ts",
  "auth/sessions/[id]/route.ts",
  "auth/sessions/revoke-all/route.ts",
  "auth/callback/saml/route.ts",
  "setup/route.ts",
  "billing/webhook/route.ts",
  "billing/portal/route.ts",
  "billing/checkout/route.ts",
  "user/preferences/route.ts",
  "user/notification-preferences/route.ts",
  "asset/qrcode/bulk/route.ts",
  "labels/pdf/route.ts",
  "route.ts",
  "admin/settings/email/test/route.ts",
  "admin/settings/freshdesk/test/route.ts",
  "admin/settings/ldap/test/route.ts",
  "admin/settings/integrations/test/route.ts",
  "admin/settings/intune/test/route.ts",
  "admin/settings/storage/test/route.ts",
  "scim/v2/Users/route.ts",
  "scim/v2/Users/[id]/route.ts",
  "team/invite/[token]/route.ts",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "__tests__") return [];
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

const files = routeFiles(API_DIR).map((full) => ({
  rel: path.relative(API_DIR, full),
  src: readFileSync(full, "utf8"),
}));

describe("API route conventions", () => {
  it("maps guard errors through apiErrorResponse", () => {
    const offenders = files
      .filter((f) => THROWING_GUARDS.test(f.src))
      .filter((f) => !f.src.includes("apiErrorResponse("))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("calls requireWritableOrg in every mutating handler", () => {
    const offenders = files
      .filter((f) => !WRITE_GUARD_EXEMPT.has(f.rel))
      .filter((f) => [...f.src.matchAll(MUTATING_EXPORT)].length > 0)
      .filter(
        (f) =>
          (f.src.match(/requireWritableOrg\(/g)?.length ?? 0) <
          [...f.src.matchAll(MUTATING_EXPORT)].length,
      )
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("keeps the exemption list honest (every entry exists)", () => {
    const rels = new Set(files.map((f) => f.rel));
    expect([...WRITE_GUARD_EXEMPT].filter((r) => !rels.has(r))).toEqual([]);
  });
});
