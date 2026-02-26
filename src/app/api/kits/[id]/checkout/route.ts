import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/kits/[id]/checkout — Checkout kit to a user
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:checkout");
    const { id } = await params;

    const body = await req.json();
    const { userId, notes } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Verify kit exists and is active
    const kit = await prisma.kit.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    if (!kit.isActive) {
      return NextResponse.json({ error: "Kit is inactive" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { userid: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 },
      );
    }

    const results: { entityType: string; entityId: string; status: string; detail?: string }[] = [];

    // Process each kit item
    await prisma.$transaction(async (tx) => {
      for (const item of kit.items) {
        if (item.entityType === "asset_category") {
          // Find an available asset in this category
          const asset = await tx.asset.findFirst({
            where: {
              assetcategorytypeid: item.entityId,
              // Check no active checkout
              checkouts: { none: { status: "checked_out" } },
            },
          });

          if (asset) {
            await tx.assetCheckout.create({
              data: {
                assetId: asset.assetid,
                checkedOutToType: "user",
                checkedOutTo: userId,
                checkedOutBy: authUser.id,
                notes: notes || `Kit checkout: ${kit.name}`,
                status: "checked_out",
              },
            });
            results.push({
              entityType: item.entityType,
              entityId: asset.assetid,
              status: "checked_out",
              detail: asset.assetname,
            });
          } else {
            results.push({
              entityType: item.entityType,
              entityId: item.entityId,
              status: "unavailable",
              detail: "No available asset in category",
            });
          }
        } else if (item.entityType === "accessory") {
          // Assign accessory to user
          await tx.userAccessoires.create({
            data: {
              userid: userId,
              accessorieid: item.entityId,
              creation_date: new Date(),
            },
          });
          results.push({
            entityType: item.entityType,
            entityId: item.entityId,
            status: "assigned",
          });
        } else if (item.entityType === "licence") {
          // Assign a licence seat
          const licence = await tx.licence.findUnique({
            where: { licenceid: item.entityId },
            include: {
              seatAssignments: { where: { unassignedAt: null } },
            },
          });

          if (licence && licence.seatAssignments.length < licence.seatCount) {
            const nextSeat = licence.seatAssignments.length + 1;
            await tx.licenceSeatAssignment.create({
              data: {
                licenceId: licence.licenceid,
                userId,
                seatNumber: nextSeat,
                assignedBy: authUser.id,
              },
            });
            results.push({
              entityType: item.entityType,
              entityId: licence.licenceid,
              status: "assigned",
              detail: `Seat ${nextSeat}`,
            });
          } else {
            results.push({
              entityType: item.entityType,
              entityId: item.entityId,
              status: "unavailable",
              detail: "No available licence seats",
            });
          }
        } else if (item.entityType === "component") {
          // Checkout component quantity — needs an asset target, skip for kit checkout to user
          results.push({
            entityType: item.entityType,
            entityId: item.entityId,
            status: "skipped",
            detail: "Components require asset target",
          });
        }
      }
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.KIT,
      entityId: id,
      details: {
        type: "kit_checkout",
        kitName: kit.name,
        targetUser: `${targetUser.firstname} ${targetUser.lastname}`,
        results,
      },
    });

    // Webhooks + integrations
    triggerWebhook("kit.checked_out", {
      kitId: id,
      kitName: kit.name,
      userId,
      userName: `${targetUser.firstname} ${targetUser.lastname}`,
      results,
    }).catch(() => {});
    notifyIntegrations("kit.checked_out", {
      kitName: kit.name,
      userName: `${targetUser.firstname} ${targetUser.lastname}`,
    }).catch(() => {});

    return NextResponse.json({ kitId: id, results }, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/kits/[id]/checkout error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to checkout kit" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
