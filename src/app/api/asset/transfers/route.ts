import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isSuperAdmin } from "@/lib/super-admin";
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
// Body: { assetId, transferType, toUserId?, toLocationId?, toOrgId?, reason? }
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const transferredBy = user.id!;
    const validated = validateBody(createTransferSchema, await req.json());
    if (validated instanceof NextResponse) return validated;
    const { assetId, transferType, toUserId, toLocationId, toOrgId, reason } =
      validated;

    // Validate that the target field is provided for the given type
    if (transferType === "user" && !toUserId) {
      return NextResponse.json(
        { error: "toUserId is required for user transfers" },
        { status: 400 },
      );
    }
    if (transferType === "location" && !toLocationId) {
      return NextResponse.json(
        { error: "toLocationId is required for location transfers" },
        { status: 400 },
      );
    }
    const orgId = user.organizationId ?? null;

    // The source asset must belong to the admin's organization.
    const asset = await prisma.asset.findFirst({
      where: { assetid: assetId, organizationId: orgId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // User/location targets must belong to the admin's organization. Moving an
    // asset into another organization crosses tenants, so only a super-admin
    // may do it, and only into an organization that exists.
    if (transferType === "organization") {
      if (!toOrgId) {
        return NextResponse.json(
          { error: "toOrgId is required for organization transfers" },
          { status: 400 },
        );
      }
      if (!(await isSuperAdmin(user))) {
        return NextResponse.json(
          {
            error:
              "Only platform administrators can transfer assets between organizations",
          },
          { status: 403 },
        );
      }
      if (toOrgId === asset.organizationId) {
        return NextResponse.json(
          { error: "Asset already belongs to that organization" },
          { status: 400 },
        );
      }
      const target = await prisma.organization.findUnique({
        where: { id: toOrgId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Target organization not found" },
          { status: 404 },
        );
      }
    } else if (transferType === "user") {
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
    } else if (transferType === "location") {
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
    }

    let transfer;

    if (transferType === "user") {
      // Find the current userAssets entry for this asset
      const currentAssignment = await prisma.userAssets.findFirst({
        where: { assetid: assetId },
      });

      const fromUserId = currentAssignment?.userid ?? null;

      transfer = await prisma.$transaction(async (tx) => {
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

        const record = await tx.assetTransfer.create({
          data: {
            assetId,
            transferType,
            fromUserId,
            toUserId,
            reason: reason ?? null,
            transferredBy,
          },
        });

        return record;
      });
    } else if (transferType === "location") {
      const fromLocationId = asset.locationid ?? null;

      transfer = await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { assetid: assetId },
          data: {
            locationid: toLocationId,
            change_date: new Date(),
          },
        });

        const record = await tx.assetTransfer.create({
          data: {
            assetId,
            transferType,
            fromLocationId,
            toLocationId,
            reason: reason ?? null,
            transferredBy,
          },
        });

        return record;
      });
    } else {
      // organization transfer
      const fromOrgId = asset.organizationId ?? null;

      transfer = await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { assetid: assetId },
          data: {
            organizationId: toOrgId,
            change_date: new Date(),
          },
        });

        const record = await tx.assetTransfer.create({
          data: {
            assetId,
            transferType,
            fromOrgId,
            toOrgId,
            reason: reason ?? null,
            transferredBy,
          },
        });

        return record;
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
