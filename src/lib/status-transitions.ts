import type { Prisma } from "@prisma/client";

/**
 * `status_transitions` has no organizationId of its own; it links two
 * statusType rows, and those carry one. A transition belongs to an
 * organization only when BOTH of its statuses do, so every read, count and
 * delete goes through this filter.
 */
export function transitionsOfOrganization(
  organizationId: string,
): Prisma.status_transitionsWhereInput {
  return {
    fromStatus: { organizationId },
    toStatus: { organizationId },
  };
}
