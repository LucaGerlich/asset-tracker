import prisma from '@/lib/prisma';
import { getOrganizationContext } from '@/lib/organization-context';

export async function checkAssetLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  const ctx = await getOrganizationContext();
  const orgId = ctx?.organization?.id;
  if (!orgId) return { allowed: true, current: 0, max: -1 };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxAssets: true },
  });
  if (!org || org.maxAssets === -1) return { allowed: true, current: 0, max: -1 };

  const count = await prisma.asset.count({ where: { organizationId: orgId } });
  return { allowed: count < org.maxAssets, current: count, max: org.maxAssets };
}

export async function checkUserLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  const ctx = await getOrganizationContext();
  const orgId = ctx?.organization?.id;
  if (!orgId) return { allowed: true, current: 0, max: -1 };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxUsers: true },
  });
  if (!org || org.maxUsers === -1) return { allowed: true, current: 0, max: -1 };

  const count = await prisma.user.count({ where: { organizationId: orgId } });
  return { allowed: count < org.maxUsers, current: count, max: org.maxUsers };
}
