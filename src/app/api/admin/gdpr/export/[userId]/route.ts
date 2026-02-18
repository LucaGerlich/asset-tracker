import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/admin/gdpr/export/[userId]
 * Export all data associated with a user (GDPR data subject access request).
 * Returns a JSON file download.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requireApiAdmin();
    const { userId } = await params;

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { userid: userId },
      select: {
        userid: true,
        username: true,
        firstname: true,
        lastname: true,
        email: true,
        lan: true,
        isadmin: true,
        canrequest: true,
        organizationId: true,
        departmentId: true,
        creation_date: true,
        change_date: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Collect all data associated with this user
    const [
      userAssets,
      userHistory,
      auditLogs,
      userPreferences,
      consumableCheckouts,
      assetReservations,
      assetTransfers,
      approvalRequests,
    ] = await Promise.all([
      prisma.userAssets.findMany({
        where: { userid: userId },
        include: {
          asset: {
            select: {
              assetid: true,
              assetname: true,
              assettag: true,
              serialnumber: true,
            },
          },
        },
      }),
      prisma.userHistory.findMany({
        where: { userid: userId },
        orderBy: { creation_date: "desc" },
      }),
      prisma.audit_logs.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user_preferences.findUnique({
        where: { userId },
      }),
      prisma.consumable_checkouts.findMany({
        where: { userId },
        include: {
          consumable: {
            select: {
              consumableid: true,
              consumablename: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.assetReservation.findMany({
        where: { userId },
        include: {
          asset: {
            select: {
              assetid: true,
              assetname: true,
              assettag: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.assetTransfer.findMany({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
        },
        orderBy: { transferredAt: "desc" },
      }),
      prisma.approvalRequest.findMany({
        where: {
          OR: [
            { requesterId: userId },
            { approverId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      dataSubject: user,
      userAssets,
      userHistory,
      auditLogs,
      userPreferences,
      consumableCheckouts,
      assetReservations,
      assetTransfers,
      approvalRequests,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gdpr-export-${userId}.json"`,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/gdpr/export/[userId] error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to export user data" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
