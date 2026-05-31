import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";

export type OrgStatus = "active" | "read_only" | "locked_out";

const GRACE_PERIOD_DAYS = 14;

interface OrgSuspensionFields {
  isActive: boolean;
  suspendedAt: Date | null;
}

/**
 * Determine the current status of an organization based on its suspension state.
 * - active: fully operational
 * - read_only: suspended within grace period (14 days) — reads allowed, writes blocked
 * - locked_out: suspended past grace period — all access blocked
 */
export function getOrgStatus(org: OrgSuspensionFields): OrgStatus {
  if (org.isActive && !org.suspendedAt) return "active";

  // If isActive is false but no suspendedAt, treat as immediate lockout (admin-triggered)
  if (!org.isActive && !org.suspendedAt) return "locked_out";

  // Has a suspendedAt date — check grace period
  if (org.suspendedAt) {
    const daysSinceSuspension =
      (Date.now() - org.suspendedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSuspension <= GRACE_PERIOD_DAYS) return "read_only";
    return "locked_out";
  }

  return "active";
}

export function requireActiveOrg(status: OrgStatus): Response | null {
  if (status === "active" || status === "read_only") return null;

  return NextResponse.json(
    {
      error:
        "Organization suspended. Please reactivate your subscription to regain access.",
    },
    { status: 403 },
  );
}

export function requireWriteAccess(status: OrgStatus): Response | null {
  if (status === "active") return null;

  if (status === "read_only") {
    return NextResponse.json(
      {
        error:
          "Organization is in read-only mode. Please reactivate your subscription within the grace period to restore full access.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { error: "Organization suspended." },
    { status: 403 },
  );
}

/**
 * Fetch org suspension status for a given organizationId.
 * Returns "active" if org not found, orgId is null, or self-hosted mode.
 */
export async function getOrgSuspensionStatus(
  organizationId: string | null | undefined,
): Promise<OrgStatus> {
  if (isSelfHosted()) return "active";
  if (!organizationId) return "active";

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true, suspendedAt: true },
  });

  if (!org) return "active";
  return getOrgStatus(org);
}
