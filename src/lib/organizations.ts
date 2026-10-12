import type { Prisma } from "@prisma/client";

/**
 * The organization columns tenant-facing routes may return. Billing columns,
 * entitlements, lockedAt and suspendedAt never leave the server through them.
 */
export const organizationApiSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  settings: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;
