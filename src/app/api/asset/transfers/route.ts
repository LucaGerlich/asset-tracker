import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { validateBody, createTransferSchema } from "@/lib/validation";

// Optional query: ?assetId=<uuid> to filter by asset
export async function GET(req: Request) {
  try {
    const user = await requireApiAdmin();

    const url = new URL(req.url);
    const assetId = url.searchParams.get("assetId");

    // AssetTransfer has no organizationId column; scope via the asset relation.
    const transfers = await prisma.assetTransfer.findMany({
      where: {
        asset: { organizationId: user.organizationId ?? null },
        ...(assetId ? { assetId } : {}),
      },
      orderBy: { transferredAt: "desc" },
    });

    return NextResponse.json(transfers, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/asset/transfers error", { error });
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      { status: 500 },
    );
  }
}

// POST /api/asset/transfers
// Body: { assetId, transferType: "user", toUserId, reason? }
//    or { assetId, transferType: "location", toLocationId, reason? }
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const transferredBy = user.id!;
    const validated = validateBody(createTransferSchema, await req.json());
    if (validated instanceof NextResponse) return validated;
    const { assetId, reason } = validated;

    const orgId = user.organizationId ?? null;

    // The source asset must belong to the admin's organization.
    const asset = await prisma.asset.findFirst({
      where: { assetid: assetId, organizationId: orgId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    let transfer;

    if (validated.transferType === "user") {
      const { toUserId } = validated;
      const target = await prisma.user.findFirst({
        where: { userid: toUserId, organizationId: orgId },
        select: { userid: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 },
        );
      }

      transfer = await prisma.$transaction(async (tx) => {
        // Read the current assignment inside the transaction it is replaced in.
        const currentAssignment = await tx.userAssets.findFirst({
          where: { assetid: assetId },
        });

        if (currentAssignment) {
          await tx.userAssets.delete({
            where: { userassetsid: currentAssignment.userassetsid },
          });
        }

        await tx.userAssets.create({
          data: {
            userid: toUserId,
            assetid: assetId,
            creation_date: new Date(),
          },
        });

        return tx.assetTransfer.create({
          data: {
            assetId,
            transferType: "user",
            fromUserId: currentAssignment?.userid ?? null,
            toUserId,
            reason: reason ?? null,
            transferredBy,
          },
        });
      });
    } else {
      const { toLocationId } = validated;
      const target = await prisma.location.findFirst({
        where: { locationid: toLocationId, organizationId: orgId },
        select: { locationid: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Target location not found" },
          { status: 404 },
        );
      }

      const fromLocationId = asset.locationid ?? null;

      transfer = await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { assetid: assetId, organizationId: orgId },
          data: {
            locationid: toLocationId,
            change_date: new Date(),
          },
        });

        return tx.assetTransfer.create({
          data: {
            assetId,
            transferType: "location",
            fromLocationId,
            toLocationId,
            reason: reason ?? null,
            transferredBy,
          },
        });
      });
    }

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/asset/transfers error", { error });
    return NextResponse.json(
      { error: "Failed to create transfer" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
