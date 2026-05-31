import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

/**
 * POST /api/requests/self-return
 * Allows a non-admin user to return an asset that is assigned to them
 * even if no ItemRequest exists (e.g. admin-assigned assets).
 * Creates a "returned" ItemRequest record for audit trail and unassigns the item.
 */
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    const { entityType, entityId, notes } = await req.json();

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId required" },
        { status: 400 },
      );
    }

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify the item is actually assigned to this user and belongs to the same org
    let isAssigned = false;
    switch (entityType) {
      case "asset": {
        const asset = await prisma.asset.findFirst({
          where: scopeToOrganization({ assetid: entityId }, orgId),
        });
        if (!asset) break;
        const ua = await prisma.userAssets.findFirst({
          where: { assetid: entityId, userid: user.id },
        });
        isAssigned = !!ua;
        break;
      }
      case "accessory": {
        const acc = await prisma.accessories.findFirst({
          where: scopeToOrganization({ accessorieid: entityId }, orgId),
        });
        if (!acc) break;
        const ua = await prisma.userAccessoires.findFirst({
          where: { accessorieid: entityId, userid: user.id },
        });
        isAssigned = !!ua;
        break;
      }
      case "licence": {
        const lic = await prisma.licence.findFirst({
          where: scopeToOrganization({ licenceid: entityId }, orgId),
        });
        if (!lic) break;
        const l = await prisma.licence.findFirst({
          where: { licenceid: entityId, licenceduserid: user.id },
        });
        isAssigned = !!l;
        break;
      }
      default:
        return NextResponse.json(
          { error: "Invalid entity type for self-return" },
          { status: 400 },
        );
    }

    if (!isAssigned) {
      return NextResponse.json(
        { error: "This item is not assigned to you" },
        { status: 403 },
      );
    }

    // Create a "returned" ItemRequest for audit trail and unassign in a transaction
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const createData: Record<string, unknown> = {
        entityType,
        entityId,
        userId: user.id!,
        status: "returned",
        notes: notes || null,
        quantity: 1,
        returnedAt: now,
        updatedAt: now,
      };
      const request = await tx.itemRequest.create({
        data: createData as never,
      });

      switch (entityType) {
        case "asset": {
          await tx.userAssets.deleteMany({
            where: { assetid: entityId, userid: user.id },
          });
          // Returns always set status to Available, bypassing workflow transition rules (intentional)
          const available = await tx.statusType.findFirst({
            where: {
              statustypename: { equals: "Available", mode: "insensitive" },
            },
          });
          if (available) {
            await tx.asset.update({
              where: { assetid: entityId },
              data: {
                statustypeid: available.statustypeid,
                change_date: new Date(),
              },
            });
          }
          break;
        }
        case "accessory": {
          await tx.userAccessoires.deleteMany({
            where: { accessorieid: entityId, userid: user.id },
          });
          break;
        }
        case "licence": {
          await tx.licence.update({
            where: { licenceid: entityId },
            data: { licenceduserid: null },
          });
          break;
        }
      }

      return request;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/requests/self-return error", { error });
    return NextResponse.json(
      { error: "Failed to process return" },
      { status: 500 },
    );
  }
}
