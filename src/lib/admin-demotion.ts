/**
 * Guard for removing admin rights. An organization must always keep at least
 * one active admin, and an admin must not demote themself (a mis-click would
 * otherwise lock the tenant out of its own settings).
 */

import prisma from "@/lib/prisma";
import { scopeToOrganization } from "@/lib/organization-context";

export const SELF_DEMOTION_MESSAGE =
  "You cannot remove your own admin rights. Ask another administrator.";
export const LAST_ADMIN_MESSAGE =
  "This change would leave the organization without an active administrator.";

/**
 * Returns an error message when demoting `targetUserIds` is not allowed, or
 * null when it is.
 */
export async function findAdminDemotionViolation(params: {
  callerId: string | null | undefined;
  targetUserIds: string[];
  organizationId: string | null | undefined;
}): Promise<string | null> {
  const { callerId, targetUserIds, organizationId } = params;

  if (callerId && targetUserIds.includes(callerId)) {
    return SELF_DEMOTION_MESSAGE;
  }

  const remainingAdmins = await prisma.user.count({
    where: scopeToOrganization(
      {
        isadmin: true,
        isActive: true,
        userid: { notIn: targetUserIds },
      },
      organizationId,
    ),
  });

  return remainingAdmins === 0 ? LAST_ADMIN_MESSAGE : null;
}
