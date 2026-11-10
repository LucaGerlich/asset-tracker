import type { Prisma } from "@prisma/client";

/**
 * Columns of a user row that are safe to hand to a Server Component's props
 * (and therefore to the browser). Deliberately excludes the password hash and
 * the LDAP / SCIM / SSO bookkeeping columns (ldapDN, externalId,
 * scimProviderId, scimLastSync, lastSyncedAt, ...). Never spread a full user
 * row into a client component: add the column here when a page needs it.
 */
export const publicUserSelect = {
  userid: true,
  username: true,
  firstname: true,
  lastname: true,
  email: true,
  isadmin: true,
  canrequest: true,
  lan: true,
  organizationId: true,
  departmentId: true,
  accessExpiresAt: true,
  creation_date: true,
  change_date: true,
} satisfies Prisma.userSelect;

/**
 * What a non-admin member sees of a colleague (user pickers, directories).
 * Like `publicUserSelect` without the access-expiry date, which is an
 * administrative detail.
 */
export const memberUserSelect = {
  ...publicUserSelect,
  accessExpiresAt: false,
} satisfies Prisma.userSelect;
