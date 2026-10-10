import prisma from "./prisma";
import { countUsersByEmail } from "./user-email-query";

/**
 * Platform super-admin detection.
 *
 * Super-admins gate platform-wide configuration (SSO, LDAP, Freshdesk,
 * integrations, organization management) that affects every tenant. They are
 * identified by email via SUPER_ADMIN_EMAILS (comma-separated).
 */

/** Parse SUPER_ADMIN_EMAILS: trimmed, lower-cased, empty entries dropped. */
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Whether the given user is a platform super-admin. Fails closed:
 *
 * - SUPER_ADMIN_EMAILS set: the email must be listed AND held by exactly one
 *   user. Emails are unique case-sensitively in the database, so a case-variant
 *   duplicate ("Root@x.io" next to "root@x.io") must never inherit the rights
 *   of the listed address. Holders are counted with an exact lower()
 *   comparison, so "_" and "%" in an address are never wildcards.
 * - SUPER_ADMIN_EMAILS unset: only while the platform has at most one
 *   organization (a self-hosted single-tenant install). Creating a second
 *   organization closes this, so admins of a tenant never become platform
 *   admins by default.
 *
 * The caller must pass the email stored in the database, not one taken from
 * the session or from request input. An untrimmed stored value never equals a
 * listed (trimmed) address.
 */
export async function isSuperAdmin(user: {
  id?: string;
  email?: string | null;
}): Promise<boolean> {
  const listed = getSuperAdminEmails();

  if (listed.length === 0) {
    return (await prisma.organization.count()) <= 1;
  }

  if (!user.email || !listed.includes(user.email.toLowerCase())) {
    return false;
  }

  return (await countUsersByEmail(user.email)) === 1;
}
