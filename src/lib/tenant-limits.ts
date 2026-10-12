import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { isSelfHosted } from "@/lib/deployment-mode";

/**
 * The org to check: an explicit `organizationId` wins (callers acting for an
 * org other than the session's, e.g. accepting an invitation), otherwise the
 * org of the current session.
 */
async function resolveOrgId(
  organizationId?: string,
): Promise<string | undefined> {
  if (organizationId) return organizationId;
  const ctx = await getOrganizationContext();
  return ctx?.organization?.id;
}

export async function checkAssetLimit(organizationId?: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
}> {
  if (isSelfHosted()) return { allowed: true, current: 0, max: -1 };

  const orgId = await resolveOrgId(organizationId);
  if (!orgId) return { allowed: true, current: 0, max: -1 };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxAssets: true },
  });
  if (!org || org.maxAssets === -1)
    return { allowed: true, current: 0, max: -1 };

  const count = await prisma.asset.count({ where: { organizationId: orgId } });
  return { allowed: count < org.maxAssets, current: count, max: org.maxAssets };
}

export async function checkUserLimit(organizationId?: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
}> {
  if (isSelfHosted()) return { allowed: true, current: 0, max: -1 };

  const orgId = await resolveOrgId(organizationId);
  if (!orgId) return { allowed: true, current: 0, max: -1 };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxUsers: true },
  });
  if (!org || org.maxUsers === -1)
    return { allowed: true, current: 0, max: -1 };

  const count = await prisma.user.count({ where: { organizationId: orgId } });
  return { allowed: count < org.maxUsers, current: count, max: org.maxUsers };
}
