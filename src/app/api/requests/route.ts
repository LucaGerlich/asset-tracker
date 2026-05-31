import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { logger, logCatchError } from "@/lib/logger";
import {
  getOrganizationContext,
  verifyEntityOrgOwnership,
} from "@/lib/organization-context";

// Transaction client type — works with both the full PrismaClient and the
// transaction-scoped client that Prisma passes into $transaction callbacks.
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");
    const limit = searchParams.get("limit");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    // Scope all requests to user's organization
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    if (orgId) {
      where.user = { organizationId: orgId };
    }

    // Non-admins only see their own requests
    if (!user.isAdmin || mine === "true") {
      where.userId = user.id;
    }

    const requests = await prisma.itemRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : 50,
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        approver: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });

    // Batch-resolve entity names (avoids N+1 queries)
    const assetIds = [
      ...new Set(
        requests.filter((r) => r.entityType === "asset").map((r) => r.entityId),
      ),
    ];
    const accessoryIds = [
      ...new Set(
        requests
          .filter((r) => r.entityType === "accessory")
          .map((r) => r.entityId),
      ),
    ];
    const consumableIds = [
      ...new Set(
        requests
          .filter((r) => r.entityType === "consumable")
          .map((r) => r.entityId),
      ),
    ];
    const licenceIds = [
      ...new Set(
        requests
          .filter((r) => r.entityType === "licence")
          .map((r) => r.entityId),
      ),
    ];

    const [assets, accessories, consumables, licences] = await Promise.all([
      assetIds.length
        ? prisma.asset.findMany({
            where: { assetid: { in: assetIds } },
            select: { assetid: true, assetname: true, assettag: true },
          })
        : [],
      accessoryIds.length
        ? prisma.accessories.findMany({
            where: { accessorieid: { in: accessoryIds } },
            select: { accessorieid: true, accessoriename: true },
          })
        : [],
      consumableIds.length
        ? prisma.consumable.findMany({
            where: { consumableid: { in: consumableIds } },
            select: { consumableid: true, consumablename: true },
          })
        : [],
      licenceIds.length
        ? prisma.licence.findMany({
            where: { licenceid: { in: licenceIds } },
            select: { licenceid: true, licencekey: true },
          })
        : [],
    ]);

    const nameMap = new Map<string, string>();
    for (const a of assets)
      nameMap.set(a.assetid, `${a.assetname} (${a.assettag})`);
    for (const a of accessories) nameMap.set(a.accessorieid, a.accessoriename);
    for (const c of consumables) nameMap.set(c.consumableid, c.consumablename);
    for (const l of licences)
      nameMap.set(l.licenceid, l.licencekey || "Unnamed licence");

    const enriched = requests.map((r) => ({
      ...r,
      entityName: nameMap.get(r.entityId) || "Unknown",
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/requests error", { error });
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}

// POST /api/requests — create a new request
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();

    const body = await req.json();
    const { entityType, entityId, startDate, endDate, notes, quantity } = body;
    const initialStatus =
      body.status === "return_pending" ? "return_pending" : "pending";

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId required" },
        { status: 400 },
      );
    }

    const validTypes = ["asset", "accessory", "consumable", "licence"];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: "Invalid entity type" },
        { status: 400 },
      );
    }

    // Verify the target entity belongs to the requester's organization
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const entityOwned = await verifyEntityOrgOwnership(
      entityType,
      entityId,
      orgId,
    );
    if (!entityOwned) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Atomic duplicate check + create inside a serializable transaction
    // to prevent the TOCTOU race where two concurrent POSTs both pass the
    // duplicate check and insert two rows.
    let request;
    try {
      request = await prisma.$transaction(
        async (tx) => {
          const existingRequest = await tx.itemRequest.findFirst({
            where: {
              entityType,
              entityId,
              userId: user.id,
              status: { notIn: ["returned", "rejected", "cancelled"] },
            },
          });

          if (initialStatus === "return_pending") {
            // Return requests are only valid if user has an approved request
            if (existingRequest && existingRequest.status !== "approved") {
              throw new Error("DUPLICATE_PENDING");
            }
          } else {
            // Regular requests blocked if any active record exists
            if (existingRequest) {
              throw new Error("DUPLICATE_ACTIVE");
            }
          }

          const created = await tx.itemRequest.create({
            data: {
              entityType,
              entityId,
              userId: user.id,
              status: initialStatus,
              startDate: startDate ? new Date(startDate) : null,
              endDate: endDate ? new Date(endDate) : null,
              notes: notes || null,
              quantity: quantity || 1,
              updatedAt: new Date(),
            },
          });

          // Set item status to "Pending" while request is being reviewed
          if (initialStatus === "pending" && entityType === "asset") {
            const pendingStatus = await tx.statusType.findFirst({
              where: {
                statustypename: { equals: "Pending", mode: "insensitive" },
              },
            });
            if (pendingStatus) {
              await tx.asset.update({
                where: { assetid: entityId },
                data: {
                  statustypeid: pendingStatus.statustypeid,
                  change_date: new Date(),
                },
              });
            }
          }

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "DUPLICATE_PENDING") {
          return NextResponse.json(
            { error: "You already have a pending request for this item" },
            { status: 409 },
          );
        }
        if (error.message === "DUPLICATE_ACTIVE") {
          return NextResponse.json(
            { error: "You already have an active request for this item" },
            { status: 409 },
          );
        }
      }
      throw error;
    }

    // Audit log
    const entityName = await getEntityName(entityType, entityId);
    await createAuditLog({
      userId: user.id,
      action:
        initialStatus === "return_pending"
          ? "RETURN_REQUEST"
          : AUDIT_ACTIONS.REQUEST,
      entity: entityType,
      entityId,
      details: { entityName, status: initialStatus, notes: notes || null },
    }).catch(logCatchError("Audit log failed"));

    // Notify all admins (in-app via notification_queue)
    try {
      const admins = await prisma.user.findMany({
        where: { isadmin: true, isActive: true },
        select: { userid: true, email: true },
      });
      const entityName = await getEntityName(entityType, entityId);
      for (const admin of admins) {
        await prisma.notification_queue.create({
          data: {
            userId: admin.userid,
            type: "request",
            recipient: admin.email || "",
            subject: `New ${entityType} request`,
            body: `${user.name || user.email || "A user"} requested ${entityName}`,
            status: "pending",
          },
        });
      }
    } catch {
      // notification failures shouldn't block the request
    }

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/requests error", { error });
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 },
    );
  }
}

// PUT /api/requests — approve/reject/cancel
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();

    const { id, status, notes, _expectedVersion } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status required" },
        { status: 400 },
      );
    }

    const existing = await prisma.itemRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Verify the request's entity belongs to admin's org
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const entityOwned = await verifyEntityOrgOwnership(
      existing.entityType,
      existing.entityId,
      orgId,
    );
    if (!entityOwned) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (
      _expectedVersion &&
      existing.updatedAt &&
      new Date(_expectedVersion).getTime() !==
        new Date(existing.updatedAt).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "This request was modified by another user. Please refresh and try again.",
        },
        { status: 409 },
      );
    }

    // Only admins can approve/reject/confirm returns
    if (
      (status === "approved" ||
        status === "rejected" ||
        status === "returned") &&
      !user.isAdmin
    ) {
      return NextResponse.json(
        { error: "Only admins can approve, reject, or confirm returns" },
        { status: 403 },
      );
    }

    // Only requester can cancel (or admin)
    if (
      status === "cancelled" &&
      existing.userId !== user.id &&
      !user.isAdmin
    ) {
      return NextResponse.json(
        { error: "You can only cancel your own requests" },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (notes !== undefined) updateData.notes = notes;

      if (status === "approved" || status === "rejected") {
        updateData.approvedBy = user.id;
        updateData.approvedAt = new Date();
      }

      if (status === "returned") {
        updateData.returnedAt = new Date();
      }

      await tx.itemRequest.update({
        where: { id },
        data: updateData,
      });

      // On reject/cancel, revert asset status to "Available"
      if (
        (status === "rejected" || status === "cancelled") &&
        existing.entityType === "asset" &&
        existing.status === "pending"
      ) {
        const available = await tx.statusType.findFirst({
          where: {
            statustypename: { equals: "Available", mode: "insensitive" },
          },
        });
        if (available) {
          await tx.asset.update({
            where: { assetid: existing.entityId },
            data: {
              statustypeid: available.statustypeid,
              change_date: new Date(),
            },
          });
        }
      }

      // On return, unassign the item
      if (status === "returned") {
        await unassignItem(
          tx,
          existing.entityType,
          existing.entityId,
          existing.userId,
        );
      }

      // On approval, auto-assign the item
      if (status === "approved") {
        await autoAssignItem(
          tx,
          existing.entityType,
          existing.entityId,
          existing.userId,
          existing.quantity,
        );
      }

      // Clean up old terminal records (keep recent ones so user sees the outcome)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await tx.itemRequest.deleteMany({
        where: {
          entityType: existing.entityType,
          entityId: existing.entityId,
          userId: existing.userId,
          status: { in: ["returned", "rejected", "cancelled"] },
          updatedAt: { lt: oneDayAgo },
        },
      });
    });

    // Audit log for status change
    const actionMap: Record<string, string> = {
      approved: AUDIT_ACTIONS.APPROVE,
      rejected: AUDIT_ACTIONS.REJECT,
      returned: "RETURN_CONFIRMED",
      cancelled: "CANCELLED",
    };
    const entityName = await getEntityName(
      existing.entityType,
      existing.entityId,
    );
    await createAuditLog({
      userId: user.id,
      action: actionMap[status] || status,
      entity: existing.entityType,
      entityId: existing.entityId,
      details: {
        entityName,
        previousStatus: existing.status,
        newStatus: status,
        notes: notes || null,
      },
    }).catch(logCatchError("Audit log failed"));

    try {
      const requester = await prisma.user.findUnique({
        where: { userid: existing.userId },
        select: { userid: true, email: true },
      });
      if (requester) {
        const reqEntityName = await getEntityName(
          existing.entityType,
          existing.entityId,
        );
        await prisma.notification_queue.create({
          data: {
            userId: requester.userid,
            type: "request_decision",
            recipient: requester.email || "",
            subject: `Request ${status}`,
            body: `Your request for ${reqEntityName} has been ${status}`,
            status: "pending",
          },
        });
      }
    } catch {
      // notification failures shouldn't block
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("PUT /api/requests error", { error });
    return NextResponse.json(
      { error: "Failed to update request" },
      { status: 500 },
    );
  }
}

async function getEntityName(
  entityType: string,
  entityId: string,
): Promise<string> {
  try {
    switch (entityType) {
      case "asset": {
        const a = await prisma.asset.findUnique({
          where: { assetid: entityId },
          select: { assetname: true },
        });
        return a?.assetname || "Unknown";
      }
      case "accessory": {
        const a = await prisma.accessories.findUnique({
          where: { accessorieid: entityId },
          select: { accessoriename: true },
        });
        return a?.accessoriename || "Unknown";
      }
      case "consumable": {
        const c = await prisma.consumable.findUnique({
          where: { consumableid: entityId },
          select: { consumablename: true },
        });
        return c?.consumablename || "Unknown";
      }
      case "licence": {
        const l = await prisma.licence.findUnique({
          where: { licenceid: entityId },
          select: { licencekey: true },
        });
        return l?.licencekey || "Unknown";
      }
    }
  } catch {
    /* DB lookup failure falls back to "Unknown" */
  }
  return "Unknown";
}

/**
 * Idempotent auto-assignment of an item to a user.
 * Uses upsert / existence checks so calling this multiple times for the same
 * entity+user combination is a safe no-op.
 */
async function autoAssignItem(
  tx: TxClient,
  entityType: string,
  entityId: string,
  userId: string,
  quantity: number,
): Promise<void> {
  switch (entityType) {
    case "asset": {
      const existingAssignment = await tx.userAssets.findFirst({
        where: { assetid: entityId, userid: userId },
      });

      if (!existingAssignment) {
        await tx.userAssets.deleteMany({
          where: { assetid: entityId },
        });
        await tx.userAssets.create({
          data: {
            assetid: entityId,
            userid: userId,
            creation_date: new Date(),
          },
        });
      }

      // Always ensure the asset status is "Active"
      const active = await tx.statusType.findFirst({
        where: { statustypename: { equals: "Active", mode: "insensitive" } },
      });
      if (active) {
        await tx.asset.update({
          where: { assetid: entityId },
          data: {
            statustypeid: active.statustypeid,
            change_date: new Date(),
          },
        });
      }
      break;
    }
    case "accessory": {
      const existingAccessory = await tx.userAccessoires.findFirst({
        where: { accessorieid: entityId, userid: userId },
      });
      if (!existingAccessory) {
        await tx.userAccessoires.create({
          data: {
            accessorieid: entityId,
            userid: userId,
            creation_date: new Date(),
          },
        });
      }
      break;
    }
    case "consumable": {
      // Check current quantity before decrementing to prevent going negative
      const consumable = await tx.consumable.findUnique({
        where: { consumableid: entityId },
        select: { quantity: true },
      });
      if (!consumable || consumable.quantity < quantity) {
        throw new Error("Insufficient consumable quantity");
      }
      await tx.consumable.update({
        where: { consumableid: entityId },
        data: { quantity: { decrement: quantity } },
      });
      await tx.consumable_checkouts.create({
        data: { consumableId: entityId, userId, quantity },
      });
      break;
    }
    case "licence": {
      await tx.licence.update({
        where: { licenceid: entityId },
        data: { licenceduserid: userId },
      });
      break;
    }
  }
}

/**
 * Idempotent un-assignment of an item from a user.
 * If the item is already unassigned, this is a no-op (deleteMany returns 0,
 * and licence update sets null on an already-null field).
 */
async function unassignItem(
  tx: TxClient,
  entityType: string,
  entityId: string,
  userId: string,
): Promise<void> {
  switch (entityType) {
    case "asset": {
      // deleteMany is inherently idempotent — returns count 0 if nothing to delete
      await tx.userAssets.deleteMany({
        where: { assetid: entityId, userid: userId },
      });
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
      // deleteMany is inherently idempotent
      await tx.userAccessoires.deleteMany({
        where: { accessorieid: entityId, userid: userId },
      });
      break;
    }
    case "consumable": {
      // Consumables are consumed, no return — intentional no-op
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
}
