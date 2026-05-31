import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find approved requests with endDate in the past that haven't been returned
    const overdueRequests = await prisma.itemRequest.findMany({
      where: {
        status: "approved",
        endDate: { lt: now },
        returnedAt: null,
      },
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
            organizationId: true,
          },
        },
      },
    });

    let notified = 0;

    for (const request of overdueRequests) {
      // BUG 19 fix: Verify the item is still actually assigned to the user
      // before sending notifications. Skip if no longer assigned.
      const stillAssigned = await isItemStillAssigned(
        request.entityType,
        request.entityId,
        request.user.userid,
      );
      if (!stillAssigned) {
        // Item was already returned or unassigned; mark as overdue silently
        await prisma.itemRequest.update({
          where: { id: request.id },
          data: { status: "overdue", updatedAt: new Date() },
        });
        continue;
      }

      const entityName = await getEntityName(
        request.entityType,
        request.entityId,
      );

      // Notify the user to return the item
      await prisma.notification_queue.create({
        data: {
          userId: request.user.userid,
          type: "overdue_return",
          recipient: request.user.email || "",
          subject: `Overdue: Please return ${entityName}`,
          body: `Your loan of ${entityName} was due on ${request.endDate?.toLocaleDateString()}. Please return it as soon as possible.`,
          status: "pending",
        },
      });

      // BUG 2 fix: Only notify admins within the same organization
      const adminWhere: Record<string, unknown> = {
        isadmin: true,
        isActive: true,
      };
      if (request.user.organizationId) {
        adminWhere.organizationId = request.user.organizationId;
      }
      const admins = await prisma.user.findMany({
        where: adminWhere,
        select: { userid: true, email: true },
      });

      for (const admin of admins) {
        await prisma.notification_queue.create({
          data: {
            userId: admin.userid,
            type: "overdue_return_admin",
            recipient: admin.email || "",
            subject: `Overdue item: ${entityName}`,
            body: `${request.user.firstname} ${request.user.lastname} has not returned ${entityName} (due ${request.endDate?.toLocaleDateString()}). Please follow up.`,
            status: "pending",
          },
        });
      }

      // Mark request as overdue to avoid re-notifying
      await prisma.itemRequest.update({
        where: { id: request.id },
        data: { status: "overdue", updatedAt: new Date() },
      });

      notified++;
    }

    logger.info("Overdue returns cron completed", {
      overdueCount: overdueRequests.length,
      notified,
    });

    return NextResponse.json({
      success: true,
      overdueCount: overdueRequests.length,
      notified,
    });
  } catch (error) {
    logger.error("Overdue returns cron error", { error });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

async function isItemStillAssigned(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<boolean> {
  try {
    switch (entityType) {
      case "asset": {
        const ua = await prisma.userAssets.findFirst({
          where: { assetid: entityId, userid: userId },
        });
        return !!ua;
      }
      case "accessory": {
        const ua = await prisma.userAccessoires.findFirst({
          where: { accessorieid: entityId, userid: userId },
        });
        return !!ua;
      }
      case "licence": {
        const l = await prisma.licence.findFirst({
          where: { licenceid: entityId, licenceduserid: userId },
        });
        return !!l;
      }
    }
  } catch {
    /* DB lookup failure treated as not assigned */
  }
  return false;
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
