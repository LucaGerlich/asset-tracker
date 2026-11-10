import type { Prisma } from "@prisma/client";

export type LicenceSeatOutcome =
  "assigned" | "reactivated" | "already_assigned";

export interface LicenceSeatResult {
  outcome: LicenceSeatOutcome;
  id: string;
  seatNumber: number;
}

interface AssignLicenceSeatInput {
  licenceId: string;
  userId: string;
  assignedBy: string | null;
  notes?: string | null;
}

/**
 * Give a user a seat on a licence inside the caller's transaction.
 *
 * `licence_seat_assignments` is unique on (licenceId, userId) and on
 * (licenceId, seatNumber) across soft-deleted rows too, so:
 * - a user who already has an active seat is reported, never inserted again;
 * - a user whose seat was released gets that same row reactivated;
 * - a new row takes max(seatNumber) + 1 over ALL rows, not "active count + 1",
 *   which collides with a seat that is still held after an earlier unassign.
 *
 * The caller checks the licence's seat capacity.
 */
export async function assignLicenceSeat(
  tx: Prisma.TransactionClient,
  { licenceId, userId, assignedBy, notes }: AssignLicenceSeatInput,
): Promise<LicenceSeatResult> {
  const existing = await tx.licenceSeatAssignment.findUnique({
    where: { licenceId_userId: { licenceId, userId } },
    select: { id: true, seatNumber: true, unassignedAt: true },
  });

  if (existing) {
    if (existing.unassignedAt === null) {
      return {
        outcome: "already_assigned",
        id: existing.id,
        seatNumber: existing.seatNumber,
      };
    }
    const reactivated = await tx.licenceSeatAssignment.update({
      where: { id: existing.id },
      data: {
        unassignedAt: null,
        assignedAt: new Date(),
        assignedBy,
        notes: notes ?? null,
      },
      select: { id: true, seatNumber: true },
    });
    return { outcome: "reactivated", ...reactivated };
  }

  const maxSeat = await tx.licenceSeatAssignment.aggregate({
    where: { licenceId },
    _max: { seatNumber: true },
  });
  const created = await tx.licenceSeatAssignment.create({
    data: {
      licenceId,
      userId,
      seatNumber: (maxSeat._max?.seatNumber ?? 0) + 1,
      assignedBy,
      notes: notes ?? null,
    },
    select: { id: true, seatNumber: true },
  });
  return { outcome: "assigned", ...created };
}
