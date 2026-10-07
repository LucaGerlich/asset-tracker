import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";

export type OrgStatus = "active" | "read_only" | "locked_out";

const GRACE_PERIOD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OrgSuspensionFields {
  isActive: boolean;
  suspendedAt: Date | null;
}

/**
 * Precedence: an inactive org is locked out first; a suspension is read-only
 * for 14 days and locked out afterwards.
 */
export function getOrgStatus(org: OrgSuspensionFields): OrgStatus {
  if (!org.isActive) return "locked_out";
  if (!org.suspendedAt) return "active";
  const days = (Date.now() - org.suspendedAt.getTime()) / DAY_MS;
  return days <= GRACE_PERIOD_DAYS ? "read_only" : "locked_out";
}

/** Status for an org row that may be missing; self-hosted is always active. */
export function resolveOrgStatus(org: OrgSuspensionFields | null): OrgStatus {
  if (isSelfHosted() || !org) return "active";
  return getOrgStatus(org);
}

/** One-query lookup for callers without a loaded user (proxy, SCIM). */
export async function getOrgSuspensionStatus(
  organizationId: string | null | undefined,
): Promise<OrgStatus> {
  if (isSelfHosted() || !organizationId) return "active";
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, suspendedAt: true },
  });
  return resolveOrgStatus(org);
}
