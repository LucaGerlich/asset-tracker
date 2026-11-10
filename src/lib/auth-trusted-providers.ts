/**
 * Which OAuth providers BetterAuth may auto-link to an existing local user by
 * email. Kept free of auth-server imports so the policy is unit-testable.
 *
 * An Entra account from ANY tenant can assert any email address, so Microsoft
 * is only trusted when the app is pinned to one concrete tenant GUID. With
 * `common`, `organizations` or `consumers` (or no tenant) nothing is trusted,
 * and a sign-in whose email matches an existing user is refused instead of
 * being linked (nOAuth account takeover).
 */

const TENANT_GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getTrustedProviders(
  microsoftTenantId: string | undefined,
): string[] {
  if (microsoftTenantId && TENANT_GUID.test(microsoftTenantId.trim())) {
    return ["microsoft"];
  }
  return [];
}
