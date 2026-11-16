/**
 * Guard for removing admin rights. An organization must always keep at least
 * one active admin, and an admin must not demote themself (a mis-click would
 * otherwise lock the tenant out of its own settings).
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { scopeToOrganization } from "@/lib/organization-context";

export const SELF_DEMOTION_MESSAGE =
  "You cannot remove your own admin rights. Ask another administrator.";
export const LAST_ADMIN_MESSAGE =
  "This change would leave the organization without an active administrator.";

export const DEMOTION_CONFLICT_MESSAGE =
  "Another administrator change happened at the same time. Please try again.";

interface DemotionParams {
  callerId: string | null | undefined;
  targetUserIds: string[];
  organizationId: string | null | undefined;
}

/**
 * Returns an error message when demoting `targetUserIds` is not allowed, or
 * null when it is. Pass the transaction client when the check and the update
 * run in one transaction (see guardedAdminDemotion).
 */
export async function findAdminDemotionViolation(
  params: DemotionParams,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string | null> {
  const { callerId, targetUserIds, organizationId } = params;

  if (callerId && targetUserIds.includes(callerId)) {
    return SELF_DEMOTION_MESSAGE;
  }

  const remainingAdmins = await client.user.count({
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

export type GuardedDemotion<T> =
  | { status: "ok"; result: T }
  | { status: "violation"; message: string }
  | { status: "conflict"; message: string };

/**
 * Runs the last-admin check and the demoting write in one Serializable
 * transaction. Counting and updating separately let two admins who demote each
 * other at the same moment both pass the check; under Serializable one of the
 * two transactions aborts (P2034), which is reported as a conflict to retry.
 */
export async function guardedAdminDemotion<T>(
  params: DemotionParams,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<GuardedDemotion<T>> {
  try {
    return await prisma.$transaction(
      async (tx): Promise<GuardedDemotion<T>> => {
        const message = await findAdminDemotionViolation(params, tx);
        if (message) return { status: "violation", message };
        return { status: "ok", result: await write(tx) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return { status: "conflict", message: DEMOTION_CONFLICT_MESSAGE };
    }
    throw error;
  }
}

/** 400 for a rejected demotion, 409 for a lost serialization race. */
export function demotionFailureResponse(
  outcome: Exclude<GuardedDemotion<unknown>, { status: "ok" }>,
): NextResponse {
  return NextResponse.json(
    { error: outcome.message },
    { status: outcome.status === "conflict" ? 409 : 400 },
  );
}
