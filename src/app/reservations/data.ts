import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

interface ReservationViewer {
  userId: string;
  isAdmin: boolean;
  organizationId: string | null;
}

/**
 * Active reservations visible to the viewer: an admin sees every reservation on
 * their organization's assets (reservations carry no organizationId, so the
 * scope goes through the asset); anyone else sees only their own. An admin
 * without an organization owns no assets, so no query runs.
 */
export async function getReservations(viewer: ReservationViewer) {
  let scope: Prisma.AssetReservationWhereInput;
  if (!viewer.isAdmin) {
    scope = { userId: viewer.userId };
  } else if (viewer.organizationId) {
    scope = { asset: { organizationId: viewer.organizationId } };
  } else {
    return [];
  }

  return prisma.assetReservation.findMany({
    where: {
      ...scope,
      status: { notIn: ["cancelled", "rejected"] },
    },
    include: {
      asset: {
        select: { assetid: true, assetname: true, assettag: true },
      },
      user: {
        select: { userid: true, firstname: true, lastname: true },
      },
    },
    orderBy: { startDate: "desc" },
  });
}
