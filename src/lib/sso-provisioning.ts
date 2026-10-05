/**
 * Org assignment for users created by an OAuth sign-in (BetterAuth generic OAuth).
 *
 * Every query is org-scoped, so a user created without an organizationId is
 * invisible to admins and sees an empty app. New OAuth users are therefore
 * assigned to SSO_DEFAULT_ORGANIZATION_ID — but only for providers locked to a
 * single tenant, otherwise any Microsoft/Google account could join the org.
 */

import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";
import { logger } from "@/lib/logger";

/** Microsoft multi-tenant authorities that accept accounts from any directory. */
const OPEN_MICROSOFT_TENANTS = new Set([
  "",
  "common",
  "organizations",
  "consumers",
]);

// ponytail: one env-configured org per deployment; add per-org email-domain
// mapping if a multi-tenant instance ever offers OAuth sign-in to several orgs.
function isTenantRestricted(providerId: string): boolean {
  if (providerId !== "microsoft") return false;
  const tenant = (process.env.MICROSOFT_TENANT_ID ?? "").trim().toLowerCase();
  return !OPEN_MICROSOFT_TENANTS.has(tenant);
}

/**
 * Returns the user data to insert, with org and provider set, or null when the
 * sign-up must be refused (BetterAuth then aborts with unable_to_create_user).
 */
export async function resolveSsoUserData<T extends Record<string, unknown>>(
  user: T,
  providerId: string,
): Promise<(T & { organizationId: string; authProvider: string }) | null> {
  const organizationId = process.env.SSO_DEFAULT_ORGANIZATION_ID?.trim();
  const reject = (reason: string) => {
    logger.warn("OAuth sign-up refused", { reason, providerId });
    return null;
  };

  if (!organizationId) return reject("SSO_DEFAULT_ORGANIZATION_ID not set");
  if (!isTenantRestricted(providerId)) {
    return reject("provider is not restricted to a single tenant");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, maxUsers: true },
  });
  if (!org?.isActive) return reject("default organization missing or inactive");

  if (!isSelfHosted() && org.maxUsers !== -1) {
    const count = await prisma.user.count({ where: { organizationId } });
    if (count >= org.maxUsers) return reject("organization user limit reached");
  }

  return { ...user, organizationId, authProvider: providerId };
}
